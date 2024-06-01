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
import { UserMode } from './user_sessions'
import { getGroupByID, putRelationItem } from '../common/dynamodb'
import {
    updateUserBelongingGroups,
    updateUserSession,
} from '../notification/dynamodb'

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
    if (!user && lineEvent.type === 'follow') {
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
    if (lineEvent.type === 'message' && lineEvent.message.type === 'text') {
        logger.info('Text Message Event')
        // 座組に参加
        if (user?.session && user.session.mode === UserMode.JoinGroup) {
            let text = ''

            const groupId = lineEvent.message.text
            const group = await getGroupByID(groupId)

            if (!group) {
                text += '指定された座組は存在しません'
            } else if (user.groups.includes(groupId)) {
                text += 'その座組にはすでに参加しています'
            } else {
                // 座組の設定
                await updateUserBelongingGroups(
                    userId,
                    [
                        {
                            group_id: groupId,
                            group_name: group.group_name,
                            area: group.area,
                        },
                    ],
                    UserMode.JoinGroup
                )
                await putRelationItem(userId, groupId)
                // セッション情報のクリア
                await updateUserSession({}, userId)

                text = `「${group.group_name}」に参加しました`
            }

            // メッセージ送信
            await client.replyMessage({
                replyToken: lineEvent.replyToken,
                messages: [
                    {
                        type: 'text',
                        text: text,
                    },
                ],
            })
            // 座組に参加していないユーザからのメッセージ
        } else if (user?.groups.length === 0) {
            // メッセージ送信
            const text =
                '座組に未参加です。\nメニューの「座組に参加」ボタンをタップして、座組に参加してください'
            await client.replyMessage({
                replyToken: lineEvent.replyToken,
                messages: [
                    {
                        type: 'text',
                        text: text,
                    },
                ],
            })
            // 座組ID入力以外のテキストメッセージ
        } else {
            // メッセージ送信
            const text =
                'ごめんなさい！\nこのアカウントではメッセージにお答えできません >_<'
            await client.replyMessage({
                replyToken: lineEvent.replyToken,
                messages: [
                    {
                        type: 'text',
                        text: text,
                    },
                ],
            })
        }
    }

    //============================================
    // ボタン押下
    //============================================

    return {
        statusCode: 200,
        headers: getHeaders(),
        body: JSON.stringify({ message: 'ok' }),
    }
}
