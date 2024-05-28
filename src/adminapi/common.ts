import { randomFillSync } from 'crypto'

/**
 * 指定された文字数のランダム文字列を生成する関数
 * @param length 文字の長さ
 * @returns ランダム文字列
 */
export const getRandomString = (length: number): string => {
    const LOWERCASE_LETTERS = 'abcdefghijkmnprstuwxyz'
    const UPPERCASE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const DIGIT_LETTERS = '23456789'

    const letters = LOWERCASE_LETTERS + UPPERCASE_LETTERS + DIGIT_LETTERS

    return Array.from(randomFillSync(new Uint8Array(length)))
        .map((n) => letters[n % letters.length])
        .join('')
}
