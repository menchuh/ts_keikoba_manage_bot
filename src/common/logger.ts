import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import { getSsmParameter } from './utils'
import pino from 'pino'
import { CreatePracticeData } from './practices'
import dayjs from 'dayjs'

// 定数
const JST_TIMEDIFF = 9
const LOG_TIMESTAMP_FORMAT = '%Y/%m/%d %H:%M:%S'

export enum EventType {
    add = '追加',
    Delete = '削除',
}

// AWSリソース
const s3Client = new S3Client()

// ロガー設定
export const logger = pino({
    level: 'info',
})

/**
 * 指定した名前のファイルが特定のバケット内に存在するか確認する関数
 * @param bucketName バケット名
 * @param fileKey ディレクトリ名含むファイル名
 * @return Boolean
 */
const isFileExistsInBucket = async (
    bucketName: string,
    fileKey: string
): Promise<Boolean> => {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
    })
    const data = await s3Client.send(command)

    // 有無チェック
    return !!data.Body
}

/**
 * 稽古の変更ログをS3の任意のファイルに出力する関数
 * @param groupId グループID
 * @param mode イベント種別（add, delete）
 * @param data 稽古データ
 */
export const writePracticesChangeLog = async (
    groupId: string,
    userName: string,
    mode: EventType,
    data: CreatePracticeData
) => {
    const timeNow = dayjs().add(9, 'hour').format(LOG_TIMESTAMP_FORMAT)
    // ログ文字列の生成
    const logText = `${timeNow}\t${userName}\t${data.date} ${data.start_time}〜${data.end_time}@${data.place}の稽古をAdmin APIで${mode}しました`
    // 引数の設定
    const bucketName = await getSsmParameter('KeikobaLineBotAdmin-BUCKET_NAME')
    const fileKey = `${groupId}.log`
    let contetBody = ``

    // コマンドの作成
    const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
    })
    const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: contetBody,
    })

    // ログファイル存在
    if (await isFileExistsInBucket(bucketName, fileKey)) {
        const data = await s3Client.send(getCommand)
        if (data.Body?.transformToString()) {
            contetBody = await data.Body?.transformToString()
        }

        contetBody += contetBody + `\n${logText}`
        await s3Client.send(putCommand)
    } else {
        contetBody = `${logText}`
        await s3Client.send(putCommand)
    }
}
