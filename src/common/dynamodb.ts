import {
    DeleteItemCommand,
    DeleteItemInput,
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput,
    PutItemCommand,
    PutItemInput,
    QueryCommand,
    QueryCommandInput,
    QueryInput,
} from '@aws-sdk/client-dynamodb'
import { plainToClass } from 'class-transformer'
import { EntityType, Group } from './users_groups'
import { Practice } from './practices'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import dayjs from 'dayjs'

// AWSリソース
const client = new DynamoDBClient({ region: 'ap-northeast-1' })

// 定数
const DATE_STRING_FORMAT = '%Y-%m-%d'
export const TABLE_CONSTANT = {
    practices_table: 'keikoba_practices',
    users_groups_table: 'keikoba_users_groups',
    index_name: 'type-group_id-index',
}

//============================================
// グループに関する関数
//============================================
/**
 * IDを元に任意のグループの情報を取得する関数
 * @param groupId グループID
 * @return Group | null
 */
export const getGroupByID = async (groupId: string): Promise<Group | null> => {
    const getItemRequest: GetItemCommandInput = {
        TableName: TABLE_CONSTANT.practices_table,
        Key: marshall({
            group_id: groupId,
            user_id: groupId,
        }),
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
 * グループに所属するユーザーのIDを取得する関数
 * @param groupId グループID
 * @returns string[] ユーザーIDの配列
 */
export const getUsersByGroupID = async (groupId: string): Promise<string[]> => {
    const queryItemRequest: QueryInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        IndexName: TABLE_CONSTANT.index_name,
        KeyConditionExpression: '#t = :r AND group_id = :id',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: marshall({
            ':id': groupId,
            ':r': EntityType.relation,
        }),
    }
    const command = new QueryCommand(queryItemRequest)
    const response = await client.send(command)

    if (response.Items) {
        return response.Items.map((item) => {
            return unmarshall(item).user_id
        })
    } else {
        return []
    }
}

/**
 * グループの一覧を取得する関数
 * @returns Group[]
 */
export const listGroups = async (): Promise<Group[]> => {
    const queryItemRequest: QueryCommandInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        IndexName: TABLE_CONSTANT.index_name,
        KeyConditionExpression: '#t = :g',
        ExpressionAttributeNames: {
            '#t': 'type',
        },
        ExpressionAttributeValues: marshall({
            ':g': EntityType.group,
        }),
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

//============================================
// Relationに関する関数
//============================================
/**
 * GroupとUserのrelationレコードを追加する関数
 * @param userId ユーザID
 * @param groupId グループID
 */
export const putRelationItem = async (userId: string, groupId: string) => {
    const putItemRequest: PutItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Item: marshall({
            user_id: userId,
            group_id: groupId,
            type: EntityType.relation,
        }),
    }
    const command = new PutItemCommand(putItemRequest)
    await client.send(command)
}

/**
 * GroupとUserのrelationレコードを削除する関数
 * @param userId
 * @param groupId
 */
export const deleteRelationItem = async (userId: string, groupId: string) => {
    const deleteItemRequest: DeleteItemInput = {
        TableName: TABLE_CONSTANT.users_groups_table,
        Key: marshall({
            user_id: userId,
            group_id: groupId,
        }),
    }
    const command = new DeleteItemCommand(deleteItemRequest)
    await client.send(command)
}

//============================================
// 稽古に関する関数
//============================================
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
        Key: marshall({
            group_id: groupId,
            date_start_place: dateStartPlace,
        }),
    }

    const command = new GetItemCommand(getItemRequest)
    const item = await client.send(command)

    return !!item.Item
}

/**
 * グループIDで本日以降に予定されている稽古一覧を取得する関数
 * @param groupId グループID
 * @returns Practice[] 稽古予定の配列
 */
export const getPracticesByGroupID = async (
    groupId: string
): Promise<Practice[]> => {
    // 今日の日付を取得
    const today = dayjs().format(DATE_STRING_FORMAT)
    // 稽古予定を取得
    const queryItemRequest: QueryInput = {
        TableName: TABLE_CONSTANT.practices_table,
        KeyConditionExpression: 'group_id = :id',
        FilterExpression: '#d >= :today',
        ExpressionAttributeNames: {
            '#d': 'date',
        },
        ExpressionAttributeValues: marshall({
            ':id': groupId,
            ':today': today,
        }),
    }
    const command = new QueryCommand(queryItemRequest)
    const response = await client.send(command)

    if (response.Items && response.Items.length > 0) {
        return response.Items.map((item) => {
            return plainToClass(Practice, {
                group_id: item.group_id,
                date_start_place: item.date_start_place,
                address: item.address,
                date: item.date,
                end_time: item.end_time,
                group_name: item.group_name,
                image: item.image,
                latitude: item.latitude,
                longtitude: item.longtitude,
                name: item.name,
                place: item.place,
                start_time: item.start_time,
            })
        })
    } else {
        return []
    }
}

/**
 * 稽古予定を作成する関数
 * @param groupId グループID
 * @param groupName グループ名
 * @param date 稽古日付
 * @param startTime 稽古開始時間
 * @param endTime 稽古終了時間
 * @param place 稽古場所
 */
export const createPractice = async (
    groupId: string,
    groupName: string,
    date: string,
    startTime: string,
    endTime: string,
    place: string
) => {
    // ソートキー
    const dateStartPlace = `${date}#${startTime}#${place}`
    // 稽古予定を追加
    const putItemRequest: PutItemInput = {
        TableName: TABLE_CONSTANT.practices_table,
        Item: marshall({
            group_id: groupId,
            group_name: groupName,
            date_start_place: dateStartPlace,
            date: date,
            start_time: startTime,
            end_time: endTime,
            place: place,
        }),
    }
    const command = new PutItemCommand(putItemRequest)
    await client.send(command)
}
