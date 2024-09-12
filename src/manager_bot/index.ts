import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
    messagingApi,
    LINE_SIGNATURE_HTTP_HEADER_NAME,
    validateSignature,
    WebhookRequestBody,
} from '@line/bot-sdk'
import {
    getErrorBody,
    getHeaders,
    getSsmParameter,
    isBeforeToday,
    isTimeABeforeTimeB,
} from '../common/utils'
import { EventType, logger, writePracticesChangeLog } from '../common/logger'
import { deleteUserByID, getUserByID, putInitialUserItem } from './dynamodb'
import {
    UserAddPracticePhase,
    UserMode,
    UserNotifyPracticesWithdrawGroupPhase,
} from '../common/users_groups.js'
import {
    createPractice,
    deleteRelationItem,
    getGroupByID,
    getPracticesByGroupID,
    getUsersByGroupID,
    isSamePracticeItemExists,
    putRelationItem,
} from '../common/dynamodb'
import { updateUserBelongingGroups, updateUserSession } from './dynamodb.js'
import { JOINABLE_GROUP_COUNT, UserSession } from '../common/users_groups.js'
import { Practice } from '../common/practices.js'
import {
    CAROUSEL_COLUMN_MAX,
    createAddPracticeAskGroupMessage,
    createAddPracticeAskPlaceMessage,
    createNotifyPracticesConfirmMessage,
    createWithdrawGroupButtonMessage,
    getPushMessageCount,
    ConfirmTemplateAction,
    createWithdrawGroupConfirmMessage,
    createAddPracticeAskDateMessage,
    createAddPracticeAskTimeMessage,
} from './messages.js'
import {
    communityCenters,
    getCommunityCenterByAreaAndName,
} from '../common/community_centers.js'
import { CommunityCenter } from '../common/type.js'
import { getMessageDateFormat } from '../common/utils.js'

// exportされていないので自分で宣言する
// https://github.com/line/line-bot-sdk-nodejs/blob/5b21bc4624bbfcf54c79f7785394d55f3670870e/lib/types.ts#L601
type DateTimePostback = {
    date?: string
    time?: string
    datetime?: string
}

export const lambdaHandler = async (
    event: APIGatewayEvent
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

    // リクエストボディの取得
    const requestBody: WebhookRequestBody = JSON.parse(event.body)

    // LINE Webhookイベントの検証
    if (
        event.requestContext.identity.userAgent === 'LineBotWebhook/2.0' &&
        requestBody.events.length === 0
    ) {
        return {
            statusCode: 200,
            headers: getHeaders(),
            body: JSON.stringify({ message: 'ok' }),
        }
    }

    // イベントとユーザの取得
    const lineEvent = requestBody.events[0]
    const userId = lineEvent.source.userId!
    const user = await getUserByID(userId)

    if (user && lineEvent.type === 'follow') {
        logger.error('This user is already exist.')
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
        const text = `こんにちは！ 稽古管理Botです\n${userName}さん、これからよろしくね`
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
            logger.info('座組ID入力以外のテキストメッセージ')
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
                    // 参加最大可能座組数を超える場合
                    // メッセージ送信
                    const text = `参加できる座組は${JOINABLE_GROUP_COUNT}組までです。\n「座組を抜ける」ボタンから座組を抜けたのち、もう一度お試しください`
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else {
                    // 正常ケース
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
                    // 参加している座組がない場合
                    // メッセージ送信
                    const text = '参加している座組がありません'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                } else {
                    // 座組に参加している場合
                    const groupIds = user?.groups.map((g) => g.group_id)
                    logger.info(groupIds)
                    let practiceGroupItems: Practice[][] = []
                    // 稽古予定の取得
                    for (let groupId of groupIds!) {
                        practiceGroupItems.push(
                            await getPracticesByGroupID(groupId)
                        )
                    }
                    const practiceGroups = practiceGroupItems.filter(
                        (p) => p.length !== 0
                    )

                    if (practiceGroups.length === 0) {
                        // 予定されている稽古がない場合
                        // メッセージ送信
                        const text = '予定されている稽古はありません'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // 予定されている稽古がある場合
                        let practices_text = ''
                        practiceGroups.forEach((x, i, self) => {
                            practices_text += `【${x[0].group_name}】\n`
                            x.forEach((y) => {
                                practices_text += `${getMessageDateFormat(y.date)} ${y.start_time}〜${y.end_time}@${y.place}\n`
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
            // if (user?.groups.length === 0) {
            //     // 参加している座組がない場合
            //     // メッセージ送信
            //     const text = '参加している座組がありません'
            //     await client.replyMessage({
            //         replyToken: lineEvent.replyToken,
            //         messages: [{ type: 'text', text: text }],
            //     })
            // } else if (user?.groups.length === 1) {
            //     // 参加している座組が1つの場合
            //     const group = user.groups[0]
            //     // セッションの更新
            //     const session: UserSession = {
            //         mode: UserMode.NotifyPractices,
            //         phase: UserNotifyPracticesWithdrawGroupPhase.Confirm,
            //         data: {
            //             group_id: group.group_id,
            //             group_name: group.group_name,
            //         },
            //     }
            //     await updateUserSession(session, userId)
            //     // メッセージ送信
            //     await client.replyMessage({
            //         replyToken: lineEvent.replyToken,
            //         messages: [createNotifyPracticesConfirmMessage(group)],
            //     })
            // } else {
            //     // 参加している座組が2つ以上の場合
            //     // セッションの更新
            //     const session: UserSession = {
            //         mode: UserMode.NotifyPractices,
            //         phase: UserNotifyPracticesWithdrawGroupPhase.AskGroup,
            //     }
            //     await updateUserSession(session, userId)
            //     // メッセージ送信
            //     await client.replyMessage({
            //         replyToken: lineEvent.replyToken,
            //         messages: [
            //             createNotifyPracticesAskGroupButtonMessage(
            //                 user!.groups
            //             ),
            //         ],
            //     })
            // }

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
                                await createAddPracticeAskPlaceMessage(
                                    places,
                                    i
                                )
                            )
                        } else {
                            carouselMessages.push(
                                await createAddPracticeAskPlaceMessage(
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
            // 稽古予定の通知
            /*
            if (user?.session?.mode === UserMode.NotifyPractices) {
                logger.info(UserMode.NotifyPractices)
                logger.info(user.session.phase)
                if (
                    user.session.phase ===
                    UserNotifyPracticesWithdrawGroupPhase.AskGroup
                ) {
                    // 通知先の座組の指定
                    const groupId = lineEvent.postback.data.replace(
                        'group_id=',
                        ''
                    )
                    const group = user.groups.find(
                        (g) => g.group_id === groupId
                    )
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.NotifyPractices,
                        phase: UserNotifyPracticesWithdrawGroupPhase.Confirm,
                        data: {
                            group_id: groupId,
                            group_name: group?.group_name,
                        },
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [createNotifyPracticesConfirmMessage(group!)],
                    })
                } else if (
                    user.session.phase ===
                    UserNotifyPracticesWithdrawGroupPhase.Confirm
                ) {
                    // 通知を送るかどうかの確認
                    const action = lineEvent.postback.data.replace(
                        'action=',
                        ''
                    )
                    if (action === ConfirmTemplateAction.approve) {
                        // 通知を送る
                        // 稽古予定を取得
                        const groupId = user.session.data!.group_id!
                        const practices = await getPracticesByGroupID(groupId)
                        // 送信対象の取得
                        const targets = await getUsersByGroupID(groupId)
                        // メッセージ生成
                        let text = ''
                        const userName = await client.getProfile(userId)
                        const groupName = user.session.data!.group_name!
                        if (practices.length === 0) {
                            // 予定されている稽古がない場合
                            text = `${userName}さんからのお知らせです。\n「${groupName}」で予定されている稽古はありません`
                        } else {
                            // 予定されている稽古がある場合
                            text = `${userName}さんからのお知らせです。\n「${groupName}」予定されている稽古は以下の通りです。\n\n`
                            practices.forEach((p) => {
                                text += `${getMessageDateFormat(p.date)} ${p.start_time}〜${p.end_time}@${p.place}`
                            })
                        }

                        // メッセージ送信
                        targets.forEach(async (t) => {
                            await client.pushMessage({
                                to: t,
                                messages: [{ type: 'text', text: text }],
                            })
                        })
                    } else if (action === ConfirmTemplateAction.cancel) {
                        // 通知をキャンセルする
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text = 'かしこまりました。通知は行いません'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // 予期しないアクションの場合
                        // エラーログ出力
                        logger.error(
                            `An error has occurred on ${UserMode.NotifyPractices} mode.`
                        )
                        logger.error(
                            `An error has occurred on {UserNotifyPracticesWithdrawGroupPhase.Confirm} phase.`
                        )
                        logger.error(`Unexpected action has sent: ${action}`)
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text =
                            'エラーが発生しました。最初からやり直してください'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    }
                }
            }
            */

            // 稽古予定の追加
            if (user?.session?.mode === UserMode.AddPractice) {
                logger.info(UserMode.AddPractice)
                logger.info(user.session.phase)
                if (user.session.phase === UserAddPracticePhase.AskGroup) {
                    // 座組の指定
                    const groupId = lineEvent.postback.data.replace(
                        'group_id=',
                        ''
                    )
                    const group = user.groups.find(
                        (g) => g.group_id === groupId
                    )
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.AddPractice,
                        phase: UserAddPracticePhase.AskPlace,
                        data: {
                            group_id: group?.group_id,
                            group_name: group?.group_name,
                        },
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    const places: CommunityCenter[] =
                        communityCenters[group!.area]
                    const carouselMessageCount = getPushMessageCount(
                        places.length
                    )
                    const text =
                        '稽古予定を追加（1/4）\n稽古場所を指定してください'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                    for (let i = 0; i < carouselMessageCount; i++) {
                        await client.pushMessage({
                            to: userId,
                            messages: [
                                await createAddPracticeAskPlaceMessage(
                                    places,
                                    carouselMessageCount * i
                                ),
                            ],
                        })
                    }
                } else if (
                    user.session.phase === UserAddPracticePhase.AskPlace
                ) {
                    // 場所の指定
                    const place = lineEvent.postback.data.replace('place=', '')
                    // 座組情報を取得
                    const group = await getGroupByID(
                        user.session.data?.group_id!
                    )
                    // 施設情報を取得
                    const communityCenter = getCommunityCenterByAreaAndName(
                        group?.area!,
                        place
                    )
                    if (!communityCenter) {
                        // 指定された施設が存在しない場合
                        throw new Error('Missing Place')
                    }
                    // セッション更新
                    const session: UserSession = {
                        mode: UserMode.AddPractice,
                        phase: UserAddPracticePhase.AskDate,
                        data: {
                            group_id: group?.group_id,
                            group_name: group?.group_name,
                            place: place,
                        },
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [createAddPracticeAskDateMessage()],
                    })
                } else if (
                    user.session.phase === UserAddPracticePhase.AskDate
                ) {
                    const params = lineEvent.postback.params as DateTimePostback
                    const date = params.date!
                    if (isBeforeToday(date)) {
                        // 日付が今日より前の場合
                        // メッセージ送信
                        const text =
                            '【エラー】\n日付には今日以降の日付を指定してください'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // 日付が今日以降の場合
                        // セッション更新
                        const session: UserSession = {
                            mode: UserMode.AddPractice,
                            phase: UserAddPracticePhase.AskStart,
                            data: {
                                group_id: user.session.data?.group_id,
                                group_name: user.session.data?.group_name,
                                place: user.session.data?.place,
                                date: date,
                            },
                        }
                        await updateUserSession(session, userId)
                        // メッセージ送信
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [
                                createAddPracticeAskTimeMessage(
                                    UserAddPracticePhase.AskStart
                                ),
                            ],
                        })
                    }
                } else if (
                    user.session.phase === UserAddPracticePhase.AskStart
                ) {
                    const params = lineEvent.postback.params as DateTimePostback
                    const startTime = params.time!
                    const dateStartPlace = `${user.session.data?.date}#${startTime}#${user.session.data?.place}`
                    if (
                        await isSamePracticeItemExists(
                            user.session.data?.group_id!,
                            dateStartPlace
                        )
                    ) {
                        // 同じ稽古データが登録済みの場合
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text =
                            '一つの座組の稽古予定に、同じ稽古場で同じ日付、同じ開始時間の稽古は二つ以上登録できません。\n初めからやりなおしてください'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // セッション更新
                        const session: UserSession = {
                            mode: UserMode.AddPractice,
                            phase: UserAddPracticePhase.AskEnd,
                            data: {
                                date: user.session.data?.date,
                                group_id: user.session.data?.group_id,
                                group_name: user.session.data?.group_name,
                                place: user.session.data?.place,
                                start_time: startTime,
                            },
                        }
                        await updateUserSession(session, userId)
                        // メッセージ送信
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [
                                createAddPracticeAskTimeMessage(
                                    UserAddPracticePhase.AskEnd
                                ),
                            ],
                        })
                    }
                } else if (user.session.phase === UserAddPracticePhase.AskEnd) {
                    // 登録完了（終了時間入力）
                    const params = lineEvent.postback.params as DateTimePostback
                    const endTime = params.time!
                    if (
                        !isTimeABeforeTimeB(
                            user.session.data?.start_time!,
                            endTime
                        )
                    ) {
                        // 終了時間が開始時間より前の場合
                        // メッセージ送信
                        const text =
                            '【エラー】\n終了時間には、開始時間より後の時間を指定してください'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // 正常系
                        const data = Object.assign(user.session.data!, {
                            end_time: endTime,
                        })
                        const groupId = user.session.data?.group_id
                        const practiceInfo = `[座組]\n${data.group_name}\n[場所]\n${data.place}\n[日付]\n${data.date}\n[時間]\n${data.start_time}~${data.end_time}`
                        // データの格納
                        await createPractice(
                            groupId!,
                            data.group_name!,
                            data.date!,
                            data.start_time!,
                            endTime!,
                            data.place!
                        )
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text = `以下の内容で登録しました。\n${practiceInfo}`
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                        // ログの保存
                        const userName = (await client.getProfile(userId))
                            .displayName
                        await writePracticesChangeLog(
                            groupId!,
                            userName,
                            EventType.Add,
                            data
                        )
                    }
                } else {
                    // セッションに予期しないフェーズが格納されていた場合
                    // エラーログ出力
                    logger.error(
                        `An error has occurred on ${UserMode.AddPractice} mode.`
                    )
                    logger.error(
                        `Unexpected phase in session: ${user.session.phase}`
                    )
                    // セッション情報のクリア
                    await updateUserSession({}, userId)
                    // メッセージ送信
                    const text =
                        'エラーが発生しました。最初からやり直してください'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                }
            }

            // 座組を抜ける
            if (user?.session?.mode === UserMode.WithdrawGroup) {
                logger.info(UserMode.WithdrawGroup)
                logger.info(user.session.phase)
                if (
                    user.session.phase ===
                    UserNotifyPracticesWithdrawGroupPhase.AskGroup
                ) {
                    // 本当に抜けるかどうかの確認
                    const groupId = lineEvent.postback.data.replace(
                        'group_id=',
                        ''
                    )
                    const group = user.groups.find(
                        (g) => g.group_id === groupId
                    )
                    // セッションの更新
                    const session: UserSession = {
                        mode: UserMode.WithdrawGroup,
                        phase: UserNotifyPracticesWithdrawGroupPhase.Confirm,
                        data: {
                            group_id: groupId,
                            group_name: group?.group_name,
                        },
                    }
                    await updateUserSession(session, userId)
                    // メッセージ送信
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [createWithdrawGroupConfirmMessage(group!)],
                    })
                } else if (
                    user.session.phase ===
                    UserNotifyPracticesWithdrawGroupPhase.Confirm
                ) {
                    // 座組を抜ける処理
                    const action = lineEvent.postback.data.replace(
                        'action=',
                        ''
                    )
                    if (action === ConfirmTemplateAction.approve) {
                        // 座組を抜ける場合
                        const groupToWithdraw = user.session.data
                        const groupId = groupToWithdraw?.group_id
                        // テーブルデータ更新
                        user.groups = user.groups.filter(
                            (g) => g.group_id !== groupId
                        )
                        await updateUserBelongingGroups(
                            userId,
                            user.groups,
                            UserMode.WithdrawGroup
                        )
                        await deleteRelationItem(userId, groupId!)
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text = `「${groupToWithdraw?.group_name}」を抜けました。お疲れさまでした`
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else if (action === ConfirmTemplateAction.cancel) {
                        // 座組を抜けない
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text =
                            '座組にはそのまま参加されるんですね。\nかしこまりました'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    } else {
                        // 予期しないアクションの場合
                        // エラーログ出力
                        logger.error(
                            `An error has occurred on ${UserMode.WithdrawGroup} mode.`
                        )
                        logger.error(
                            `An error has occurred on ${UserNotifyPracticesWithdrawGroupPhase.Confirm} phase.`
                        )
                        logger.error(`Unexpected action has sent: ${action}`)
                        // セッション情報のクリア
                        await updateUserSession({}, userId)
                        // メッセージ送信
                        const text =
                            'エラーが発生しました。最初からやり直してください'
                        await client.replyMessage({
                            replyToken: lineEvent.replyToken,
                            messages: [{ type: 'text', text: text }],
                        })
                    }
                } else {
                    // セッションに予期しないフェーズが格納されていた場合
                    // エラーログ出力
                    logger.error(
                        `An error has occurred on ${UserMode.WithdrawGroup} mode.`
                    )
                    logger.error(
                        `Unexpected phase in session: ${user.session.phase}`
                    )
                    // セッション情報のクリア
                    await updateUserSession({}, userId)
                    // メッセージ送信
                    const text =
                        'エラーが発生しました。最初からやり直してください'
                    await client.replyMessage({
                        replyToken: lineEvent.replyToken,
                        messages: [{ type: 'text', text: text }],
                    })
                }
            }
        }
    }

    return {
        statusCode: 200,
        headers: getHeaders(),
        body: JSON.stringify({ message: 'ok' }),
    }
}
