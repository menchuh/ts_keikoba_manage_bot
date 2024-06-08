import {
    DynamoDBClient,
    GetItemCommand,
    GetItemInput,
    PutItemCommand,
    PutItemInput,
} from '@aws-sdk/client-dynamodb'
import { User } from '../common/users_groups'
import { TABLE_CONSTANT } from '../common/dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { EntityType } from '../common/users_groups'
import { plainToClass } from 'class-transformer'

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

export const deleteUserByID = async (userId: string) => {}
