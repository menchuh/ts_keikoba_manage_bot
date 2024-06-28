import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { ErrorObject, HeaderObject } from './type.js'
import dayjs from 'dayjs'

const ssmClient = new SSMClient()

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
 * Lambda Proxy統合で必要なヘッダーを返す関数
 */
export const getHeaders = (): HeaderObject => {
    return {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,DELETE,PUT,POST,GET',
    }
}

/**
 * 与えられたステータスコードとメッセージによりErrObjectを返す関数
 * @param statusCode ステータスコード
 * @param message エラーメッセージ
 * @returns ErrorObject
 */
export const getErrorBody = (
    statusCode: number,
    message: string
): ErrorObject => {
    let error = ''

    switch (statusCode) {
        case 400:
            error = 'Bad Request'
            break
        case 404:
            error = 'Not Found'
            break
        default:
            error = 'Internal Server Error'
    }

    return {
        'error': error,
        'message': message,
    }
}

/**
 * AWS SSMに保存したパラメータを取得する関数
 * @param key パラメータのキー
 * @return string パラメータの値
 */
export const getSsmParameter = async (key: string): Promise<string> => {
    const command = new GetParameterCommand({
        Name: key,
        WithDecryption: true,
    })
    const response = await ssmClient.send(command)

    if (!response.Parameter || !response.Parameter.Value) {
        return ''
    }

    return response.Parameter.Value
}

/**
 * 与えられた日付が今日より前の日付かどうか判定する関数
 * @param date 日付
 * @returns
 */
export const isBeforeToday = (date: string): boolean => {
    return dayjs(date).isBefore(dayjs())
}

/**
 * 与えられた時刻Aが時刻Bより前かどうか判定する関数
 * @param date 日付
 * @returns
 */
export const isTimeABeforeTimeB = (timeA: string, timeB: string): boolean => {
    const timeReExp = new RegExp(/(\d{2}):\d{2}/)
    const timeAMatches = timeReExp.exec(timeA)
    const timeBMatches = timeReExp.exec(timeB)

    if (!Array.isArray(timeAMatches) || !Array.isArray(timeBMatches)) {
        throw new Error()
    }

    const timeADateTime = dayjs()
        .set('hour', Number(timeAMatches[0]))
        .set('minute', Number(timeAMatches[1]))
    const timeBDateTime = dayjs()
        .set('hour', Number(timeBMatches[0]))
        .set('minute', Number(timeBMatches[1]))
    return timeADateTime.isBefore(timeBDateTime)
}
