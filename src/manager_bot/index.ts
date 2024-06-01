import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
    messagingApi,
    LINE_SIGNATURE_HTTP_HEADER_NAME,
    validateSignature,
    WebhookRequestBody,
} from '@line/bot-sdk'
import { getErrorBody, getHeaders, getSsmParameter } from '../common/utils'
import { logger } from '../common/logger'
import { deleteUserByID, getUserByID, putInitialUserItem } from './dynamodb'

export const lambdaHandler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    // LINEパラメータ取得
    const channelAccessToken = await getSsmParameter(
        'KeikobaLineBot-LINE_CHANNEL_ACCESS_TOKEN'
    )
    const chennelSecret = await getSsmParameter(
        'KeikobaLineBot-LINE_CHANNEL_SECRET'
    )

    // apiクライアントの生成
    const client = new messagingApi.MessagingApiClient({
        channelAccessToken: channelAccessToken,
    })

    if (!event.body) {
        return {
            statusCode: 400,
            headers: getHeaders(),
            body: JSON.stringify(getErrorBody(400, '"body" is empty.')),
        }
    }

    // シグネチャの取得
    const signature = event.headers[LINE_SIGNATURE_HTTP_HEADER_NAME]

    // Line の署名認証
    if (
        !signature ||
        !validateSignature(event.body, chennelSecret, signature)
    ) {
        logger.info('LINE signature error')
        return {
            statusCode: 403,
            headers: getHeaders(),
            body: JSON.stringify(getErrorBody(403, 'Forbidden')),
        }
    }

    // イベントとユーザの取得
    const requestBody: WebhookRequestBody = JSON.parse(event.body)
    const lineEvent = requestBody.events[0]
    const userId = lineEvent.source.userId!
    const user = await getUserByID(userId)

    if (user && lineEvent.type === 'follow') {
        logger.error('This user is already exists.')
        process.exit(1)
    }

    //============================================
    // 新規フォロー
    //============================================
    if (lineEvent.type === 'follow') {
        logger.info('Follow Event')
        // ユーザーオブジェクト追加
        await putInitialUserItem(userId)
        // プロフィールの取得
        const profile = await client.getProfile(userId)
        const userName = profile.displayName
        // メッセージ
        const text = `こんにちは！　稽古管理Botです\n${userName}さん、これからよろしくね`
        await client.replyMessage({
            replyToken: lineEvent.replyToken,
            messages: [{ type: 'text', text: text }],
        })
    }

    //============================================
    // ブロック
    //============================================
    if (lineEvent.type === 'unfollow') {
        logger.info('Unfollow Event (This account is blocked.)')
        await deleteUserByID(userId)
    }

    //============================================
    // テキストメッセージ
    //============================================

    //============================================
    // ボタン押下
    //============================================

    return {
        statusCode: 200,
        headers: getHeaders(),
        body: JSON.stringify({ message: 'ok' }),
    }
}
