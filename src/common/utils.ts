import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import {
    CommunityCenterConfig,
    CommunityCenter,
    ErrorObject,
    HeaderObject,
} from './type'
import axios from 'axios'
import { logger } from './logger'

const ssmClient = new SSMClient()

// 定数
export enum EntityType {
    user = 'user',
    group = 'group',
    relation = 'relation',
}
const PLACE_JSON_URLPATH = 'configs/community_centers.json'

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

export const readCommunityCenters = async (
    area: string
): Promise<CommunityCenter[]> => {
    const domain = getSsmParameter('KeikobaLineBot-CLOUD_FRONT_DOMAIN')
    const url = `${domain}/${PLACE_JSON_URLPATH}`
    const response: string = await axios.get(url)
    const communityCenters: CommunityCenterConfig = JSON.parse(response)

    if (communityCenters[area]) {
        return communityCenters[area]
    } else {
        logger.error(`Key ${area} is not in the community center file.`)
        throw new Error('KeyError')
    }
}
