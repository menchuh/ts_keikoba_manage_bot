import dayjs from 'dayjs'
import { Practice } from '../common/practices.js'
import { URIAction } from '@line/bot-sdk/dist/messaging-api/api'

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
