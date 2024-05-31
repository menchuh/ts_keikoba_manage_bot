import dayjs from 'dayjs'
import { Practice } from '../common/practices'
import { URIAction } from '@line/bot-sdk/dist/messaging-api/api'

// 定数
const MESSAGE_DATE_FORMAT = '%m/%d'
const WEEKDAY_ARRAY = ['月', '火', '水', '木', '金', '土', '日']

/**
 * 日付文字列をLINEメッセージ上で表示する日付フォーマットに変換する関数
 * @param date 日付文字列
 * @returns string
 */
export const getMessageDateFormat = (date: string): string => {
    const dt = dayjs(date)
    return `${dt.format(MESSAGE_DATE_FORMAT)}(${WEEKDAY_ARRAY[dt.day()]})`
}

/**
 * 稽古予定が地理情報を含むかどうか判定する関数
 * @param practice 稽古クラス
 * @returns boolean
 */
export const isPracticeContainsGeometry = (practices: Practice[]): boolean => {
    return practices.some((p) => {
        return !!p.address && !!p.latitude && !p.longtitude
    })
}

/**
 * LINEメッセージで地図を表示するためのボタンを生成する関数
 * @param practice
 * @returns URIAction
 */
export const createMapUriAction = (practice: Practice): URIAction => {
    return {
        label: `${practice.place}の地図`,
        type: 'uri',
        uri: `https://www.google.co.jp/maps?q=${practice.address}`,
    }
}
