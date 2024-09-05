import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PracticeRequest } from '../common/type.js'
import { createGroupOne, deleteGroupOne, updateGroupOne } from './groups.js'
import {
    createPractice,
    getGroupByID,
    getPracticesByGroupID,
    getUsersByGroupID,
    isSamePracticeItemExists,
    listGroups,
} from '../common/dynamodb.js'
import { getErrorBody, getHeaders } from '../common/utils.js'
import { CreateGroupRequest, CreatePracticeRequest } from './type.js'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { EventType, logger, writePracticesChangeLog } from '../common/logger.js'
import dayjs from 'dayjs'
import { communityCenters } from '../common/community_centers.js'
import { plainToClass } from 'class-transformer'
import { Practice } from '../common/practices.js'

// 定数
const ADMIN_USER_NAME = '管理者'
const DATE_FORMAT_REGEXP = new RegExp('d{4}/d{2}/d{2}')
const PRACTICE_REQUIRED_KEYS = ['place', 'date', 'start_time', 'end_time']
const TIME_FORMAT = 'HH:mm'
const TIME_FORMAT_REGEXP = new RegExp('d{2}:d{2}')

export const lambdaHandler = async (
    event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
    // request
    const httpMethod = event.httpMethod
    const resourcePath = event.requestContext.resourcePath

    logger.info(`Request method: ${httpMethod}`)
    logger.info(`Request path: ${resourcePath}`)

    // GET method
    if (httpMethod === 'GET') {
        // GET /groups
        if (resourcePath === '/groups') {
            const groups = await listGroups()
            const body = groups.map((g) => {
                return {
                    id: g.group_id,
                    name: g.group_name,
                }
            })
            return {
                statusCode: 200,
                headers: getHeaders(),
                body: JSON.stringify(body),
            }
        }

        // GET /groups/{id}
        if (resourcePath === '/groups/{id}') {
            const groupId = event.pathParameters?.id
            if (!groupId) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(400, 'group_id is required')
                    ),
                }
            }

            const response = await getGroupByID(groupId)

            if (!response || !response.group_id || !response.group_name) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(
                            400,
                            `The group id ${groupId} doesn't exist`
                        )
                    ),
                }
            }

            return {
                statusCode: 200,
                headers: getHeaders(),
                body: JSON.stringify({
                    id: response.group_id,
                    name: response.group_name,
                }),
            }
        }

        // GET /practices/{id}
        if (resourcePath === '/practices/{id}') {
            const groupId = event.pathParameters?.id
            if (!groupId) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(400, 'group_id is required')
                    ),
                }
            }

            let isFutureOnly = true
            if (
                event.queryStringParameters &&
                event.queryStringParameters.isFutureOnly
            ) {
                isFutureOnly =
                    event.queryStringParameters.isFutureOnly === 'true'
                        ? true
                        : false
            }

            const practices = await getPracticesByGroupID(groupId, isFutureOnly)
            const body = practices.map((p) => {
                return {
                    place: p.place,
                    date: p.date,
                    start_time: p.start_time,
                    end_time: p.end_time,
                    group_name: p.group_name,
                }
            })

            return {
                statusCode: 200,
                headers: getHeaders(),
                body: JSON.stringify(body),
            }
        }
    }

    // POSTメソッド
    if (httpMethod === 'POST') {
        // POST /groups
        if (resourcePath === '/groups') {
            if (!event.body) {
                logger.info("'body' is empty.")
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'body' is empty.")
                    ),
                }
            }
            const requestBody: CreateGroupRequest = JSON.parse(event.body)

            if (!requestBody.name) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'name' is required.")
                    ),
                }
            }

            return {
                'statusCode': 200,
                'headers': getHeaders(),
                'body': JSON.stringify(await createGroupOne(requestBody.name)),
            }
        }

        // POST /practices/{id}
        if (resourcePath === '/practices/{id}') {
            // 異常系 #1
            if (!event.body) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'body' is empty.")
                    ),
                }
            }
            // 異常系 #2
            if (!event.pathParameters || !event.pathParameters?.id) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'groupId' is empty.")
                    ),
                }
            }

            const groupId = event.pathParameters.id
            const requestBody: CreatePracticeRequest = JSON.parse(event.body)

            // 異常系 #3
            if (
                !PRACTICE_REQUIRED_KEYS.every((k) =>
                    Object.keys(requestBody).includes(k)
                )
            ) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(
                            400,
                            `${PRACTICE_REQUIRED_KEYS.join(',')} are required.`
                        )
                    ),
                }
            }

            const group = await getGroupByID(groupId)

            // グループの有無チェック
            if (!group) {
                return {
                    statusCode: 404,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(
                            404,
                            `The group that group_id is ${groupId} is not found.`
                        )
                    ),
                }
            }

            const communityCentersOfTheArea = communityCenters[group.area]

            // 稽古場の有無チェック
            if (
                !communityCentersOfTheArea
                    .map((c) => c.name)
                    .includes(requestBody.place)
            ) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(
                            400,
                            `Practice place ${requestBody.place} is wrong.`
                        )
                    ),
                }
            }

            logger.info('Pass the place validation.')

            // 日付のチェック
            if (!DATE_FORMAT_REGEXP.test(requestBody.date)) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(
                            400,
                            `Date value format must be yyyy/MM/dd`
                        )
                    ),
                }
            }

            logger.info('Pass the date validation.')

            // 時刻のチェック
            // フォーマットのチェック
            if (
                !TIME_FORMAT_REGEXP.test(requestBody.start_time) ||
                !TIME_FORMAT_REGEXP.test(requestBody.end_time)
            ) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(
                            400,
                            `Time value formt must be ${TIME_FORMAT}`
                        )
                    ),
                }
            }

            // 開始時刻 < 終了時刻のチェック
            if (
                !dayjs(requestBody.start_time).isBefore(
                    dayjs(requestBody.end_time)
                )
            ) {
                return {
                    statusCode: 400,
                    headers: getHeaders(),
                    body: JSON.stringify(
                        getErrorBody(
                            400,
                            'End time must be after the start time.'
                        )
                    ),
                }
            }

            logger.info('Pass the time validation.')

            // 同じ稽古データがあるかどうかチェック
            const dateStartPlace = `${requestBody.date}#${requestBody.start_time}#${requestBody.place}`
            if (await isSamePracticeItemExists(groupId, dateStartPlace)) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(
                            400,
                            'Only one appointment can be created in the same group, at the same place, on the same date, and with the same start time.'
                        )
                    ),
                }
            }

            logger.info('Create practice')

            // 稽古の追加
            try {
                await createPractice(
                    groupId,
                    group.group_name,
                    requestBody.date,
                    requestBody.start_time,
                    requestBody.end_time,
                    requestBody.place
                )

                // ログの書き込み
                await writePracticesChangeLog(
                    groupId,
                    ADMIN_USER_NAME,
                    EventType.Add,
                    plainToClass(Practice, {
                        group_id: groupId,
                        group_name: group.group_name,
                        date: requestBody.date,
                        start_time: requestBody.start_time,
                        end_time: requestBody.end_time,
                        place: requestBody.place,
                    })
                )

                return {
                    statusCode: 200,
                    headers: getHeaders(),
                    body: JSON.stringify({
                        'group_id': groupId,
                        'group_name': group.group_name,
                        'place': requestBody.place,
                        'date': requestBody.date,
                        'time': `${requestBody.start_time}~${requestBody.end_time}`,
                    }),
                }
            } catch (e) {
                const errorMessage = 'Unexpected error has occured.'
                logger.error(errorMessage)
                logger.error(e)
                return {
                    'statusCode': 500,
                    'headers': getHeaders(),
                    'body': JSON.stringify(getErrorBody(500, errorMessage)),
                }
            }
        }
    }

    // PUTメソッド
    if (httpMethod === 'PUT') {
        // DELETE /groups/{id}
        if (event.requestContext.resourcePath === '/groups/{id}') {
            // 異常系 #1
            if (!event.body) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'body' is empty.")
                    ),
                }
            }
            // 異常系 #2
            if (!event.pathParameters || !event.pathParameters?.id) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'groupId' is empty.")
                    ),
                }
            }

            const groupId = event.pathParameters.id
            const requestBody = JSON.parse(event.body)

            // 異常系 #3
            if (!requestBody.name) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'name' is required.")
                    ),
                }
            }

            const groupName = requestBody.name

            // 更新処理
            try {
                await updateGroupOne(groupId, groupName)

                return {
                    'statusCode': 204,
                    'headers': getHeaders(),
                    'body': JSON.stringify({}),
                }
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) {
                    const errorMessage = `The group_id ${groupId} is not found.`
                    logger.info(errorMessage)
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                } else {
                    const errorMessage = 'Unexpected error has occured.'
                    logger.error(errorMessage)
                    logger.error(e)
                    return {
                        'statusCode': 500,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(500, errorMessage)),
                    }
                }
            }
        }
    }

    // DELETEメソッド
    if (httpMethod === 'DELETE') {
        // DELETE /groups/{group_id}
        if (event.requestContext.resourcePath === '/groups/{id}') {
            // 異常系 #1
            if (!event.pathParameters || !event.pathParameters?.id) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'groupId' is empty.")
                    ),
                }
            }

            const groupId = event.pathParameters.id

            // 削除処理
            try {
                const usersBelongingGroup = await getUsersByGroupID(groupId)
                // 所属するメンバが0人のときのみ実施可能
                if (usersBelongingGroup.length === 0) {
                    // グループの削除
                    await deleteGroupOne(groupId)
                    return {
                        'statusCode': 204,
                        'headers': getHeaders(),
                        'body': JSON.stringify({}),
                    }
                } else {
                    const errorMessage = `The group ${groupId} has some menbers, so you cant delete this group.`
                    logger.info(errorMessage)
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                }
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) {
                    const errorMessage = `The group_id ${groupId} is not found.`
                    logger.info(errorMessage)
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                } else {
                    const errorMessage = 'Unexpected error has occured.'
                    logger.error(errorMessage)
                    logger.error(e)
                    return {
                        'statusCode': 500,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(500, errorMessage)),
                    }
                }
            }
        }

        // DELETE /practices/{group_id}
        if (event.requestContext.resourcePath === '/practices/{id}') {
            // 異常系 #1
            if (!event.body) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'body' is empty.")
                    ),
                }
            }
            // 異常系 #2
            if (!event.pathParameters || !event.pathParameters?.id) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(400, "'groupId' is empty.")
                    ),
                }
            }

            const groupId = event.pathParameters.id
            const requestBody: PracticeRequest = JSON.parse(event.body)

            // 異常系 #3
            if (
                !PRACTICE_REQUIRED_KEYS.every((k) =>
                    Object.keys(requestBody).includes(k)
                )
            ) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(
                            400,
                            `${PRACTICE_REQUIRED_KEYS.join(',')} are required.`
                        )
                    ),
                }
            }

            // 正常系
            const dateStartPlace = `${requestBody.date}#${requestBody.start_time}#${requestBody.place}`
            try {
                if (await isSamePracticeItemExists(groupId, dateStartPlace)) {
                    // 稽古予定の削除
                    // ログの書き込み
                    await writePracticesChangeLog(
                        groupId,
                        ADMIN_USER_NAME,
                        EventType.Delete,
                        plainToClass(Practice, {
                            group_id: groupId,
                            date: requestBody.date,
                            start_time: requestBody.start_time,
                            end_time: requestBody.end_time,
                            place: requestBody.place,
                        })
                    )
                    return {
                        statusCode: 204,
                        headers: getHeaders(),
                        body: JSON.stringify({}),
                    }
                } else {
                    return {
                        statusCode: 404,
                        headers: getHeaders(),
                        body: JSON.stringify(
                            getErrorBody(
                                404,
                                'The specified practice is not found.'
                            )
                        ),
                    }
                }
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) {
                    const errorMessage = `The group_id ${groupId} is not found.`
                    logger.info(errorMessage)
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                } else {
                    const errorMessage = 'Unexpected error has occured.'
                    logger.error(errorMessage)
                    logger.error(e)
                    return {
                        'statusCode': 500,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(500, errorMessage)),
                    }
                }
            }
        }
    }

    const errorMessage = `${httpMethod} method is not supported.`
    logger.error(errorMessage)

    return {
        statusCode: 400,
        headers: getHeaders(),
        body: JSON.stringify(getErrorBody(400, errorMessage)),
    }
}
