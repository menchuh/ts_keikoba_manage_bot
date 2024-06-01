import {
    DynamoDBClient,
    QueryCommand,
    QueryInput,
    UpdateItemCommand,
    UpdateItemInput,
} from '@aws-sdk/client-dynamodb'
import dayjs from 'dayjs'
import { TABLE_CONSTANT } from '../common/dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { plainToClass } from 'class-transformer'
import { Practice } from '../common/practices'
import { UserMode } from '../manager_bot/user_sessions'
import { logger } from '../common/logger'
import { Group, UserSession } from '../common/users_groups'

// 定数
const DATE_STRING_FORMAT = '%Y-%m-%d'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

//============================================
// ユーザーに関する関数
//============================================
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

//============================================
// 稽古に関する関数
//============================================
/**
 * 指定したグループの翌日の稽古予定を取得する関数
 * @param groupId グループID
 * @returns Practice[]
 */
export const getTomorrowPractices = async (
    groupId: string
): Promise<Practice[]> => {
    // 翌日の日付を取得
    const tomorrow = dayjs().add(1, 'day').format(DATE_STRING_FORMAT)

    // 稽古予定の取得
    const queryItemRequest: QueryInput = {
        TableName: TABLE_CONSTANT.practices_table,
        KeyConditionExpression: 'group_id = :id',
        FilterExpression: '#d = :t',
        ExpressionAttributeNames: {
            '#d': 'date',
        },
        ExpressionAttributeValues: marshall({
            ':id': groupId,
            ':t': tomorrow,
        }),
    }
    const command = new QueryCommand(queryItemRequest)
    const response = await client.send(command)

    if (response.Items) {
        return response.Items.map((item) => {
            return plainToClass(Practice, {
                group_id: item.group_id,
                date_start_place: item.date_start_place,
                address: item.address,
                date: item.date,
                end_time: item.end_time,
                group_name: item.group_name,
                image: item.image,
                name: item.name,
                place: item.place,
                start_time: item.start_time,
            })
        })
    } else {
        return []
    }
}
