import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PracticeRequest } from '../common/type'
import { createGroupOne, listGroups, updateGroupOne } from './groups'
import { getGroupByID, isSamePracticeItemExists } from '../common/dynamodb'
import { getErrorBody, getHeaders } from '../common/utils'
import { CreateGroupRequest } from './type'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { EventType, logger, writePracticesChangeLog } from '../common/logger'

export const lambdaHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    // request
    const httpMethod = event.httpMethod
    const resourcePath = event.requestContext.resourcePath

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
    }

    // POSTメソッド
    if (httpMethod === 'POST') {
        // POST /groups
        if (resourcePath === '/groups') {
            if (!event.body) {
                console.info("'body' is empty.")
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
                'body': JSON.stringify(createGroupOne(requestBody.name)),
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
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                } else {
                    const errorMessage = 'Unexpected error has occured.'
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
            const requiredKeys = ['place', 'date', 'start_time', 'end_time']
            if (
                !requiredKeys.every((k) => Object.keys(requestBody).includes(k))
            ) {
                return {
                    'statusCode': 400,
                    'headers': getHeaders(),
                    'body': JSON.stringify(
                        getErrorBody(
                            400,
                            `${requiredKeys.join(',')} are required.`
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
                        EventType.Delete,
                        requestBody
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
                    return {
                        'statusCode': 400,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(400, errorMessage)),
                    }
                } else {
                    const errorMessage = 'Unexpected error has occured.'
                    logger.error(errorMessage)
                    return {
                        'statusCode': 500,
                        'headers': getHeaders(),
                        'body': JSON.stringify(getErrorBody(500, errorMessage)),
                    }
                }
            }
        }
    }

    return {
        statusCode: 400,
        headers: getHeaders(),
        body: JSON.stringify(
            getErrorBody(400, `${httpMethod} method is not supported.`)
        ),
    }
}
