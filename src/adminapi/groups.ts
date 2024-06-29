import {
    DeleteItemCommand,
    DeleteItemInput,
    DynamoDBClient,
    PutItemCommand,
    PutItemCommandInput,
    UpdateItemCommand,
    UpdateItemInput,
} from '@aws-sdk/client-dynamodb'
import { getRandomString } from './utils.js'
import { CreateGroupResponse } from './type.js'
import { TABLE_CONSTANT } from '../common/dynamodb.js'
import { marshall } from '@aws-sdk/util-dynamodb'
import { EntityType } from '../common/users_groups.js'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

/**
 * グループを作成する関数
 * @param name グループ名
 * @returns CreateGroupResponse
 */
export const createGroupOne = async (
    name: string
): Promise<CreateGroupResponse> => {
    // グループIDの生成
    const groupId = getRandomString(6)

    // 登録
    const putItemRequest: PutItemCommandInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Item: marshall({
            user_id: groupId,
            group_id: groupId,
            group_name: name,
            area: '中央区',
            type: EntityType.group,
        }),
    }
    const command = new PutItemCommand(putItemRequest)
    await client.send(command)

    return {
        'group_id': groupId,
        'group_name': name,
        'area': '中央区',
    }
}

/**
 * グループの情報を更新する関数
 * @param groupId グループID
 * @param groupName グループ名
 */
export const updateGroupOne = async (groupId: string, groupName: string) => {
    const updateItemRequest: UpdateItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            group_id: groupId,
            user_id: groupId,
        }),
        UpdateExpression: 'SET group_name = :n',
        ConditionExpression: '#t = :g',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: marshall({
            ':g': EntityType.group,
            ':n': groupName,
        }),
    }

    const command = new UpdateItemCommand(updateItemRequest)
    await client.send(command)
}

/**
 * グループを削除する関数
 * @param groupId グループID
 */
export const deleteGroupOne = async (groupId: string) => {
    const deleteItemRequest: DeleteItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            group_id: groupId,
            user_id: groupId,
        }),
        ConditionExpression: '#t = :g',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: marshall({
            ':g': EntityType.group,
        }),
    }

    const command = new DeleteItemCommand(deleteItemRequest)
    await client.send(command)
}
