import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import { getHeaders, getSsmParameter } from '../common/utils.js'
import { logger } from '../common/logger.js'
import { getUsersByGroupID, listGroups } from '../common/dynamodb.js'
import { getTomorrowPractices } from './dynamodb'
import { Practice } from '../common/practices.js'
import * as line from '@line/bot-sdk'
import { getMessageDateFormat } from '../common/utils.js'
import { createMapUriAction, isPracticeContainsGeometry } from './utils.js'

export const lambdaHandler = async (
    event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
    logger.info(event)

    // データを格納するオブジェクトの生成
    const data: {
        [key: string]: {
            groupName: string
            practices: Practice[]
            users: string[]
        }
    } = {}

    // LINE APIとハンドラの生成
    const lineApiClient = new line.messagingApi.MessagingApiClient({
        channelAccessToken: await getSsmParameter(
            'KeikobaLineBot-LINE_CHANNEL_ACCESS_TOKEN'
        ),
    })

    // グループの取得
    const groups = await listGroups()

    // グループが存在しない場合
    if (groups.length === 0) {
        logger.info('No group is exist.')
        return {
            statusCode: 200,
            headers: getHeaders(),
            body: JSON.stringify({ message: 'No group is exist.' }),
        }
    }

    // 座組ごとに翌日の稽古予定を取得
    for (let g of groups) {
        const tomorrowPractices = await getTomorrowPractices(g.group_id)
        if (tomorrowPractices.length !== 0) {
            data[g.group_id] = {
                groupName: g.group_name,
                practices: tomorrowPractices,
                users: [],
            }
        }
    }

    // 翌日の稽古予定のある座組が0件の場合
    if (Object.keys(data).length === 0) {
        logger.info('No group has practices on tomorrow.')
        return {
            statusCode: 200,
            headers: getHeaders(),
            body: JSON.stringify({
                message: 'No group has practices on tomorrow.',
            }),
        }
    }

    // グループごとにメンバを取得
    // 所属するメンバーのいないグループを送信対象から削除
    for (let groupId of Object.keys(data)) {
        const userIds = await getUsersByGroupID(groupId)
        if (userIds.length > 0) {
            data[groupId]['users'] = userIds
        } else {
            delete data[groupId]
        }
    }

    // 明日の稽古予定があり、かつメンバーの所属するグループが0件の場合
    if (Object.keys(data).length === 0) {
        logger.info('No group has member to notify.')
        return {
            statusCode: 200,
            headers: getHeaders(),
            body: JSON.stringify({ message: 'No group has member to notify.' }),
        }
    }

    // pushする対象のユーザーを抽出
    const users = Object.keys(data)
        .map((k) => {
            return data[k].users
        })
        .flat()

    // ユーザーごとに座組, 稽古予定をサマリ
    const pushNotificationSummary: {
        [key: string]: {
            [key: string]: { group_name: string; practices: Practice[] }
        }
    } = {}
    users.forEach((user) => {
        pushNotificationSummary[user] = {}
        const belongingAndHavePracticesGroupIDs = Object.keys(data)
            .filter((groupId) => {
                return data[groupId].users.includes(user)
            })
            .map((groupId) => {
                return groupId
            })
        belongingAndHavePracticesGroupIDs.forEach((groupId) => {
            pushNotificationSummary[user][groupId] = {
                group_name: data[groupId].groupName,
                practices: data[groupId].practices,
            }
        })
    })

    // メッセージ送信
    Object.keys(pushNotificationSummary).forEach((userId) => {
        let text: string

        const summaryOfUser = pushNotificationSummary[userId]
        const groupIds = Object.keys(summaryOfUser)

        // メッセージ生成
        text =
            '明日は、以下の稽古が予定されています。\n頑張っていきましょう!\n\n'
        groupIds.forEach((groupId) => {
            text += `【${summaryOfUser[groupId].group_name}】\n`
            summaryOfUser[groupId].practices.forEach((practice) => {
                text += `${getMessageDateFormat(practice['date'])} ${practice.start_time}〜${practice.end_time}@${practice.place}\n`
            })

            if (isPracticeContainsGeometry(summaryOfUser[groupId].practices)) {
                const actions = summaryOfUser[groupId].practices
                    .map((p) => createMapUriAction(p))
                    .slice(0, 4)

                // メッセージ送信
                logger.info(`Send button template messages to ${userId}`)
                lineApiClient.pushMessage({
                    to: userId,
                    messages: [
                        {
                            type: 'template',
                            template: {
                                type: 'buttons',
                                actions: actions,
                                text: text,
                            },
                            altText: '稽古予定通知メッセージ',
                        },
                    ],
                })
            } else {
                // メッセージ送信
                logger.info(`Send text messages to ${userId}`)
                lineApiClient.pushMessage({
                    to: userId,
                    messages: [
                        {
                            type: 'text',
                            text: text,
                        },
                    ],
                })
            }
        })
    })

    // 送信後処理
    logger.info('Push notifications were successfully send.')
    return {
        statusCode: 200,
        headers: getHeaders(),
        body: JSON.stringify({
            message: 'Push notifications were successfully send.',
        }),
    }
}
