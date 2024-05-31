import {
    DynamoDBClient,
    QueryCommand,
    QueryInput,
} from '@aws-sdk/client-dynamodb'
import dayjs from 'dayjs'
import { TABLE_CONSTANT } from '../common/dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { plainToClass } from 'class-transformer'
import { Practice } from '../common/practices'

// 定数
const DATE_STRING_FORMAT = '%Y-%m-%d'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

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
