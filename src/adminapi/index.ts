import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import dayjs from 'dayjs'
import { plainToClass } from 'class-transformer'
import { createGroupOne, updateGroupOne } from './groups'
import { PracticeRequest } from '../common/type'

export const handler = async (
    event: APIGatewayEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`)
    console.log(`Context: ${JSON.stringify(context, null, 2)}`)
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'hello world',
        }),
    }
}
