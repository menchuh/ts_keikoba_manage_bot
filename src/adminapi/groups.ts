import {
    DynamoDBClient,
    PutItemCommand,
    PutItemCommandInput,
    QueryCommand,
    QueryCommandInput,
    UpdateItemCommand,
    UpdateItemInput,
} from '@aws-sdk/client-dynamodb'
import { getRandomString } from './common'
import { CreateGroupResponse } from './type'
import { TABLE_CONSTANT } from '../common/dynamodb'
import { EntityType } from '../common/utils'
import { plainToClass } from 'class-transformer'
import { Group } from '../common/users_groups'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

export const createGroupOne = async (
    name: string
): Promise<CreateGroupResponse> => {
    // グループIDの生成
    const groupId = getRandomString(6)

    // 登録
    const putItemRequest: PutItemCommandInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Item: {
            user_id: {
                S: groupId,
            },
            group_id: {
                S: groupId,
            },
            group_name: {
                S: name,
            },
            area: {
                S: '中央区',
            },
            type: {
                S: EntityType.group,
            },
        },
    }
    const command = new PutItemCommand(putItemRequest)
    await client.send(command)

    return {
        'group_id': groupId,
        'group_name': name,
        'area': '中央区',
    }
}

export const listGroups = async (): Promise<Group[]> => {
    const queryItemRequest: QueryCommandInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        IndexName: TABLE_CONSTANT.index_name,
        KeyConditionExpression: '#t = :g',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: {
            ':g': {
                'S': EntityType.group,
            },
        },
    }
    const command = new QueryCommand(queryItemRequest)
    const res = await client.send(command)

    if (res.Items) {
        return res.Items.map((item) => {
            return plainToClass(Group, {
                group_id: item.group_id,
                user_id: item.user_id,
                group_name: item.group_name,
                area: item.area,
                type: item.type,
            })
        })
    } else {
        return []
    }
}

export const updateGroupOne = async (groupId: string, name: string) => {
    const updateItemRequest: UpdateItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: {
            user_id: {
                S: groupId,
            },
            group_id: {
                S: groupId,
            },
        },
        UpdateExpression: 'SET group_name = :n',
        ConditionExpression: '#t = :g',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: {
            g: {
                S: groupId,
            },
            n: {
                S: name,
            },
        },
    }

    const command = new UpdateItemCommand(updateItemRequest)
    await client.send(command)
}
