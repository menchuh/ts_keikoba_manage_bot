import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { PracticeRequest } from '../common/type'
import { createGroupOne, updateGroupOne } from './groups'
import {
    createPractice,
    getGroupByID,
    isSamePracticeItemExists,
    listGroups,
} from '../common/dynamodb'
import { getErrorBody, getHeaders } from '../common/utils'
import { CreateGroupRequest, CreatePracticeRequest } from './type'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { EventType, logger, writePracticesChangeLog } from '../common/logger'
import dayjs from 'dayjs'
import { communityCenters } from '../common/community_centers'
import { plainToClass } from 'class-transformer'
import { Practice } from '../common/practices'

// 定数
const ADMIN_USER_NAME = '管理者'
const DATE_FORMAT_REGEXP = new RegExp('d{4}/d{2}/d{2}')
const PRACTICE_REQUIRED_KEYS = ['place', 'date', 'start_time', 'end_time']
const TIME_FORMAT = 'HH:mm'
const TIME_FORMAT_REGEXP = new RegExp('d{2}:d{2}')

console.log('console.log0')

export const handler = async (
    event: APIGatewayEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`)
    console.log(`Context: ${JSON.stringify(context, null, 2)}`)

    console.log('console.log1')
    logger.info('lambdaHandlerの内部')
    console.log('console.log2')

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
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'hello world',
        }),
    }
}
