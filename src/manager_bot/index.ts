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
import {
    UserAddPracticePhase,
    UserMode,
    UserNotifyPracticesWithdrawGroupPhase,
} from './user_sessions'
import {
    getGroupByID,
    getPracticesByGroupID,
    putRelationItem,
} from '../common/dynamodb'
import {
    updateUserBelongingGroups,
    updateUserSession,
} from '../notification/dynamodb'
import { JOINABLE_GROUP_COUNT, UserSession } from '../common/users_groups'
import { Practice } from '../common/practices'
import {
    CAROUSEL_COLUMN_MAX,
    createAddPracticeAskGroupMessage,
    createAddPracticeAskPlaceMessage,
    createNotifyPracticesConfirmMessage,
    createNotifyPracticesAskGroupButtonMessage,
    createWithdrawGroupButtonMessage,
    getPushMessageCount,
} from './messages'
import { communityCenters } from '../common/community_centers'
import { CommunityCenter } from '../common/type'

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
        logger.error('This user is already exist.')
        process.exit(1)
    }

    if (!user && lineEvent.type !== 'follow') {
        logger.error('This user is not exist and this is not follow event.')
        // ユーザーオブジェクト追加
        await putInitialUserItem(userId)
        // メッセージ
        const text = `エラーが発生しました。もう一度話しかけてみてください`
        await client.pushMessage({
            to: userId,
            messages: [{ type: 'text', text: text }],
        })
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
            } else if (user.groups.map((g) => g.group_id).includes(groupId)) {
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
            // 座組ID入力以外のテキストメッセージ
        } else {
            // 座組に参加していないユーザー
            if (user?.groups.length === 0) {
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
                // 座組に参加しているユーザー
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
    }

    //============================================
    // ボタン押下
    //============================================
    if (lineEvent.type === 'postback') {
        logger.info('Postback Event')

        //============================================
        // メニューボタン押下
        //============================================
        if (lineEvent.postback.data.includes('method=')) {
            const method = lineEvent.postback.data.replace('method=', '')
            logger.info(method)

            // 座組に参加
            if (method === UserMode.JoinGroup) {
                if (user!.groups.length > JOINABLE_GROUP_COUNT) {
                    // メッセージ送信
                    const text = `参加できる座組は${JOINABLE_GROUP_COUNT}組までです。\n「座組を抜ける」ボタンから座組を抜けたのち、もう一度お試しください`
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else {
                    // Sessionの更新
                    const session: UserSession = {
                        mode: UserMode.JoinGroup,
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    const text =
                        '座組に参加されるんですね！\n座組のIDを入力してください'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                }
            }

            // 稽古予定の確認
            if (method === UserMode.ListPractices) {
                if (user?.groups.length === 0) {
                    // メッセージ送信
                    const text = '参加している座組がありません'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else {
                    const groupIds = user?.groups.map((g) => g.group_id)
                    // 稽古予定の取得
                    let practices: Practice[][] = []
                    groupIds?.forEach(async (groupId) => {
                        practices.push(await getPracticesByGroupID(groupId))
                    })
                    practices = practices.filter((p) => p.length !== 0)

                    // 予定されている稽古がない場合
                    if (practices.length === 0) {
                        // メッセージ送信
                        const text = '予定されている稽古はありません'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                        // 予定されている稽古がある場合
                    } else {
                        let practices_text = ''
                        practices.forEach((x, i, self) => {
                            practices_text += `【${x[0].group_name}】\n`
                            x.forEach((y) => {
                                practices_text += `${y}\n`
                            })
                            if (i + 1 < self.length) {
                                practices_text += '\n'
                            }
                        })
                        // メッセージ送信
                        const text = `予定されている稽古は以下の通りです。\n\n${practices_text}`
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    }
                }
            }

            // 稽古予定の通知
            if (method === UserMode.NotifyPractices) {
                if (user?.groups.length === 0) {
                    // 参加している座組がない場合
                    // メッセージ送信
                    const text = '参加している座組がありません'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else if (user?.groups.length === 1) {
                    // 参加している座組が1つの場合
                    const group = user.groups[0]
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.NotifyPractices,
                        phase: UserNotifyPracticesWithdrawGroupPhase.Confirm,
                        data: {
                            group_id: group.group_id,
                            group_name: group.group_name,
                        },
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [createNotifyPracticesConfirmMessage(group)],
                    })
                } else {
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.NotifyPractices,
                        phase: UserNotifyPracticesWithdrawGroupPhase.AskGroup,
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [
                            createNotifyPracticesAskGroupButtonMessage(
                                user!.groups
                            ),
                        ],
                    })
                }
            }

            // 稽古予定の追加
            if (method === UserMode.AddPractice) {
                if (user?.groups.length === 0) {
                    // 参加している座組がない場合
                    // メッセージ送信
                    const text = '参加している座組がありません'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else if (user?.groups.length === 1) {
                    // 参加している座組が1つの場合
                    const group = user.groups[0]
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.AddPractice,
                        phase: UserAddPracticePhase.AskPlace,
                        data: {
                            group_id: group.group_id,
                            group_name: group.group_name,
                        },
                    }
                    await updateUserSession(session, userId)
                    // カルーセルメッセージ生成
                    let carouselMessages = []
                    const places: CommunityCenter[] = communityCenters['中央区']
                    const carouselMessageCount = getPushMessageCount(
                        places.length
                    )
                    for (let i = 0; i < carouselMessageCount; i++) {
                        if (i === 0) {
                            carouselMessages.push(
                                createAddPracticeAskPlaceMessage(places, i)
                            )
                        } else {
                            carouselMessages.push(
                                createAddPracticeAskPlaceMessage(
                                    places,
                                    CAROUSEL_COLUMN_MAX * i - 1
                                )
                            )
                        }
                    }

                    // メッセージ送信
                    const text =
                        '稽古予定を追加（1/4）\n稽古場所を指定してください'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [
                            { type: 'text', text: text },
                            ...carouselMessages,
                        ],
                    })
                } else {
                    // 複数の座組に参加している場合
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.AddPractice,
                        phase: UserAddPracticePhase.AskGroup,
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [
                            createAddPracticeAskGroupMessage(user!.groups),
                        ],
                    })
                }
            }

            // 稽古予定の削除
            if (method === UserMode.DeletePractice) {
                // メッセージ送信
                const text = 'ごめんなさい>_<\nこのモードはまだ使えません'
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

            // 座組を抜ける
            if (method === UserMode.WithdrawGroup) {
                if (user?.groups.length === 0) {
                    // 参加している座組がない場合
                    // メッセージ送信
                    const text = '参加している座組がありません'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else {
                    // 参加している座組がある場合
                    // session更新
                    const session: UserSession = {
                        mode: UserMode.WithdrawGroup,
                        phase: UserNotifyPracticesWithdrawGroupPhase.AskGroup,
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [
                            createWithdrawGroupButtonMessage(user!.groups),
                        ],
                    })
                }
            }

            //============================================
            // メッセージボタン押下
            //============================================
        } else {
        }
    }

    return {
        statusCode: 200,
        headers: getHeaders(),
        body: JSON.stringify({ message: 'ok' }),
    }
}
