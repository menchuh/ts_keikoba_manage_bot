import {
    CarouselColumn,
    PostbackAction,
    TemplateMessage,
} from '@line/bot-sdk/dist/messaging-api/api'
import { Group } from '../common/users_groups'
import { getSsmParameter } from '../common/utils'
import { CommunityCenter } from '../common/type'
import { UserAddPracticePhase } from '../common/users_groups.js'

// 定数
export const CAROUSEL_COLUMN_MAX = 10
export enum ConfirmTemplateAction {
    approve = 'approve', // eslint-disable-line no-unused-vars
    cancel = 'cancel', // eslint-disable-line no-unused-vars
}

/**
 * 与えられたカルーセルの個数から、必要な送信メッセージの個数を算出する関数
 * @param count
 * @returns number
 */
export const getPushMessageCount = (carouselCount: number): number => {
    return Math.floor(
        (carouselCount + CAROUSEL_COLUMN_MAX - 1) / CAROUSEL_COLUMN_MAX
    )
}

/**
 * 稽古予定を通知するかどうかの確認ボタンメッセージを生成する関数
 * @param group グループ
 * @returns TemplateMessage
 */
export const createNotifyPracticesConfirmMessage = (
    group: Group
): TemplateMessage => {
    return {
        type: 'template',
        altText: '稽古予定通知の確認',
        template: {
            type: 'confirm',
            text: `「${group.group_name}」のメンバーに稽古予定を通知します。\nよろしいですか？`,
            actions: [
                {
                    type: 'postback',
                    label: '通知する',
                    text: '通知する',
                    data: `action=${ConfirmTemplateAction.approve}`,
                },
                {
                    type: 'postback',
                    label: 'やめておく',
                    text: 'やめておく',
                    data: `action=${ConfirmTemplateAction.cancel}`,
                },
            ],
        },
    }
}

/**
 * どの座組に対して稽古予定の通知を行うか尋ねるボタンメッセージを生成する関数
 * @param groups グループ[]
 * @returns TemplateMessage
 */
export const createNotifyPracticesAskGroupButtonMessage = (
    groups: Group[]
): TemplateMessage => {
    const buttons: PostbackAction[] = []
    groups.forEach((g) => {
        buttons.push({
            type: 'postback',
            label: g.group_name,
            displayText: g.group_name,
            data: `group_id=${g.group_id}`,
        })
    })
    return {
        type: 'template',
        altText: '稽古場予定通知メッセージ',
        template: {
            type: 'buttons',
            title: '座組を選択',
            text: 'どの座組に対して稽古予定を通知しますか？',
            actions: buttons,
        },
    }
}

/**
 * 稽古場選択のカルーセルメッセージを生成する関数
 * @param places 稽古場リスト
 * @param start 開始位置
 * @returns TemplateMessage
 */
export const createAddPracticeAskPlaceMessage = (
    places: CommunityCenter[],
    start: number
): TemplateMessage => {
    // パラメータ取得
    const domain = getSsmParameter('KeikobaLineBot-CLOUD_FRONT_DOMAIN')
    // カラムの生成
    let columns: CarouselColumn[] = []
    places.forEach((p) => {
        columns.push({
            thumbnailImageUrl: `${domain}/${p.image}`,
            text: p.name,
            actions: [
                {
                    type: 'postback',
                    text: '選ぶ',
                    displayText: '選ぶ',
                    data: `place=${p.name}`,
                },
            ],
        })
    })

    return {
        type: 'template',
        altText: '稽古予定追加メッセージ',
        template: {
            type: 'carousel',
            columns: columns.slice(start, start + (CAROUSEL_COLUMN_MAX - 1)),
        },
    }
}

/**
 * どの座組に対して稽古予定の追加を行うか尋ねるボタンメッセージを生成する関数
 * @param groups グループ[]
 * @returns TemplateMessage
 */
export const createAddPracticeAskGroupMessage = (
    groups: Group[]
): TemplateMessage => {
    const buttons: PostbackAction[] = []
    groups.forEach((g) => {
        buttons.push({
            type: 'postback',
            label: g.group_name,
            displayText: g.group_name,
            data: `group_id=${g.group_id}`,
        })
    })
    return {
        type: 'template',
        altText: '稽古予定追加メッセージ',
        template: {
            type: 'buttons',
            title: '座組を選択',
            text: 'どの座組の稽古を追加しますか？',
            actions: buttons,
        },
    }
}

/**
 * 稽古予定作成にて日付を尋ねるメッセージを生成する関数
 * @returns TemplateMessage
 */
export const createAddPracticeAskDateMessage = (): TemplateMessage => {
    return {
        type: 'template',
        altText: '稽古予定を追加',
        template: {
            type: 'buttons',
            title: '稽古予定を追加（2/4）',
            text: '稽古の日付を入力してください',
            actions: [
                {
                    type: 'datetimepicker',
                    label: '日付を指定',
                    data: '日付を指定',
                    mode: 'date',
                },
            ],
        },
    }
}

/**
 * 稽古予定作成にて時間を尋ねるメッセージを生成する関数
 * @param phase 稽古予定追加のフェーズ
 * @returns
 */
export const createAddPracticeAskTimeMessage = (
    phase: UserAddPracticePhase
): TemplateMessage => {
    const title =
        phase === UserAddPracticePhase.AskStart
            ? '稽古予定を追加（3/4）'
            : '稽古予定を追加（4/4）'
    const text =
        phase === UserAddPracticePhase.AskStart
            ? '稽古の開始時間を入力してください'
            : '稽古の終了時間を入力してください'
    return {
        type: 'template',
        altText: '稽古予定を追加',
        template: {
            type: 'buttons',
            title,
            text,
            actions: [
                {
                    type: 'datetimepicker',
                    label: '日付を指定',
                    data: '日付を指定',
                    mode: 'time',
                },
            ],
        },
    }
}

/**
 * 座組を抜けるメニューボタン押下時の返信メッセージを生成する関数
 * @param groups グループ[]
 * @returns
 */
export const createWithdrawGroupButtonMessage = (
    groups: Group[]
): TemplateMessage => {
    const buttons: PostbackAction[] = []
    groups.forEach((g) => {
        buttons.push({
            type: 'postback',
            label: g.group_name,
            displayText: g.group_name,
            data: `group_id=${g.group_id}`,
        })
    })
    return {
        type: 'template',
        altText: '座組を抜けるボタン',
        template: {
            type: 'buttons',
            title: '座組を抜ける',
            text: '座組を抜けられるんですね\nどの座組を抜けますか？',
            actions: buttons,
        },
    }
}

/**
 * 座組を抜けるかどうかの確認ボタンメッセージを生成する関数
 * @param groups グループ
 * @returns
 */
export const createWithdrawGroupConfirmMessage = (
    group: Group
): TemplateMessage => {
    return {
        type: 'template',
        altText: '座組を抜ける確認',
        template: {
            type: 'confirm',
            text: `「${group.group_name}」から本当に抜けますか？`,
            actions: [
                {
                    type: 'postback',
                    label: '抜ける',
                    text: '抜ける',
                    data: `action=${ConfirmTemplateAction.approve}`,
                },
                {
                    type: 'postback',
                    label: 'やめておく',
                    text: 'やめておく',
                    data: `action=${ConfirmTemplateAction.cancel}`,
                },
            ],
        },
    }
}
