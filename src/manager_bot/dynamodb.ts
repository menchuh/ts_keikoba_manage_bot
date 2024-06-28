import {
    DeleteItemCommand,
    DeleteItemInput,
    DynamoDBClient,
    GetItemCommand,
    GetItemInput,
    PutItemCommand,
    PutItemInput,
    QueryCommand,
    QueryInput,
    UpdateItemCommand,
    UpdateItemInput,
} from '@aws-sdk/client-dynamodb'
import { Group, User, UserMode, UserSession } from '../common/users_groups.js'
import { TABLE_CONSTANT } from '../common/dynamodb.js'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { EntityType } from '../common/users_groups.js'
import { plainToClass } from 'class-transformer'
import { logger } from '../common/logger.js'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

/**
 * IDで指定したユーザを取得する関数
 * @param userId ユーザID
 * @returns User
 */
export const getUserByID = async (userId: string): Promise<User | null> => {
    const getItemRequest: GetItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            user_id: userId,
            group_id: userId,
            type: EntityType.user,
        }),
    }
    const command = new GetItemCommand(getItemRequest)
    const response = await client.send(command)

    if (response.Item) {
        const item = unmarshall(response.Item)
        return plainToClass(User, item)
    } else {
        return null
    }
}

/**
 * ユーザの初期オブジェクトをDBに格納する関数
 * @param userId ユーザID
 */
export const putInitialUserItem = async (userId: string) => {
    const putItemRequest: PutItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Item: marshall({
            user_id: userId,
            group_id: userId,
            groups: [],
            session: null,
            type: EntityType.user,
        }),
    }
    const command = new PutItemCommand(putItemRequest)
    await client.send(command)
}

export const deleteUserByID = async (userId: string) => {
    // 削除対象の抽出
    const queryItemRequest: QueryInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: {
            '#id': 'user_id',
        },
        ExpressionAttributeValues: marshall({
            ':id': userId,
        }),
    }
    const command = new QueryCommand(queryItemRequest)
    const response = await client.send(command)

    if (response.Items && response.Items.length > 0) {
        const keys = response.Items.map((item) => unmarshall(item)).map(
            (item) => {
                return {
                    user_id: item.user_id,
                    group_id: item.group_id,
                }
            }
        )
        // アイテムの削除
        keys.forEach(async (key) => {
            const deleteItemRequest: DeleteItemInput = {
                TableName: TABLE_CONSTANT.users_groups_table,
                Key: marshall({
                    user_id: key.user_id,
                    group_id: key.group_id,
                }),
            }
            const command = new DeleteItemCommand(deleteItemRequest)
            await client.send(command)
        })
    }
}

/**
 * ユーザーの参加している座組情報を更新する関数
 * @param userId ユーザID
 * @param groups グループの配列
 * @param mode ユーザーのモード
 */
export const updateUserBelongingGroups = async (
    userId: string,
    groups: Group[],
    mode: UserMode
) => {
    // 更新条件の設定
    let updateExpression: string
    if (mode === UserMode.JoinGroup) {
        updateExpression = 'SET groups = list_append(groups, :g)'
    } else if (mode === UserMode.WithdrawGroup) {
        updateExpression = 'SET groups = :g'
    } else {
        logger.error('Unexpected mode')
        throw new Error('Unexpected mode')
    }

    // Userアイテムの更新
    const updateItemRequest: UpdateItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            user_id: userId,
            group_id: userId,
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: marshall({
            ':g': groups,
        }),
    }
    const command = new UpdateItemCommand(updateItemRequest)
    await client.send(command)
}

/**
 * 特定のユーザーのセッション情報を更新する関数
 * @param session セッション情報
 * @param userId ユーザID
 */
export const updateUserSession = async (
    session: UserSession,
    userId: string
) => {
    const updateItemRequest: UpdateItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            group_id: userId,
            user_id: userId,
        }),
        UpdateExpression: 'SET #s = :s',
        ExpressionAttributeNames: {
            '#S': 'session',
        },
        ExpressionAttributeValues: marshall({
            ':s': marshall(session),
        }),
    }
    const command = new UpdateItemCommand(updateItemRequest)
    await client.send(command)
}
