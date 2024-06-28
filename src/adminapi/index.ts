import 'reflect-metadata'
import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { PracticeRequest } from '../common/type.js'
import { createGroupOne, updateGroupOne } from './groups.js'
import {
    createPractice,
    getGroupByID,
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

export const handler = async (
    event: APIGatewayEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`)
    console.log(`Context: ${JSON.stringify(context, null, 2)}`)

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
