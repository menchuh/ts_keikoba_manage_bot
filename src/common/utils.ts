import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { ErrorObject, HeaderObject } from './type'

const ssmClient = new SSMClient()

// 定数
export enum EntityType {
    user = 'user',
    group = 'group',
    relation = 'relation',
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
 * @param message 　エラーメッセージ
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
        case 404:
            error = 'Not Found'
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
