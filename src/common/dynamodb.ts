import {
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput,
} from '@aws-sdk/client-dynamodb'
import { plainToClass } from 'class-transformer'
import { Group } from './users_groups'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

// 定数
export const TABLE_CONSTANT = {
    practices_table: 'keikoba_practices',
    users_groups_table: 'keikoba_users_groups',
    index_name: 'type-group_id-index',
}

/**
 * IDを元に任意のグループの情報を取得する関数
 * @param groupId グループID
 * @return Group | null
 */
export const getGroupByID = async (groupId: string): Promise<Group | null> => {
    const getItemRequest: GetItemCommandInput = {
        TableName: TABLE_CONSTANT.practices_table,
        Key: {
            group_id: {
                S: groupId,
            },
            user_id: {
                S: groupId,
            },
        },
    }
    const command = new GetItemCommand(getItemRequest)
    const response = await client.send(command)

    if (response.Item) {
        return plainToClass(Group, {
            group_id: response.Item.group_id,
            user_id: response.Item.user_id,
            grooup_name: response.Item.group_name,
            area: response.Item.area,
            type: response.Item.type,
        })
    } else {
        return null
    }
}

/**
 * 任意のグループに、同じ日付、開始時刻時刻、場所の練習のレコードがすでに存在するかどうかをチェックする関数
 * @param groupId グループID
 * @param dateStartPlace 練習の日付、開始時刻、場所の文字列
 * @returns Boolean
 */
export const isSamePracticeItemExists = async (
    groupId: string,
    dateStartPlace: string
): Promise<Boolean> => {
    const getItemRequest: GetItemCommandInput = {
        TableName: TABLE_CONSTANT.practices_table,
        Key: {
            group_id: {
                S: groupId,
            },
            date_start_place: {
                S: dateStartPlace,
            },
        },
    }

    const command = new GetItemCommand(getItemRequest)
    const item = await client.send(command)

    return !!item.Item
}
