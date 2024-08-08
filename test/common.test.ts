import { expect, it } from 'vitest'
import {
    getErrorBody,
    getHeaders,
    getMessageDateFormat,
    isBeforeToday,
    isTimeABeforeTimeB,
} from '../src/common/utils'
import dayjs from 'dayjs'

describe('common utils', () => {
    it.skip('date(現在未使用)', () => {
        expect(getMessageDateFormat('2024/08/01')).toBe('08/01(木)')
        expect(getMessageDateFormat('2024-08-01')).toBe('08/01(木)')
    })
    it('headers', () => {
        expect(getHeaders()).toMatchObject({
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,DELETE,PUT,POST,GET',
        })
    })
    it('errorBody', () => {
        expect(getErrorBody(400, 'test')).toMatchObject({
            'error': 'Bad Request',
            'message': 'test',
        })
        expect(getErrorBody(404, 'test')).toMatchObject({
            'error': 'Not Found',
            'message': 'test',
        })
        expect(getErrorBody(500, 'test')).toMatchObject({
            'error': 'Internal Server Error',
            'message': 'test',
        })
    })
    it('isBeforeToday', () => {
        const today = dayjs().format('yyyy/MM/dd')
        const yesterday = dayjs().add(-1, 'day').format('yyyy/MM/dd')

        expect(isBeforeToday('2001/01/01')).toBeTruthy()
        expect(isBeforeToday('9999/12/31')).toBeFalsy()
        expect(isBeforeToday(today)).toBeFalsy()
        expect(isBeforeToday(yesterday)).toBeFalsy()
    })
    it('isTimeABeforeTimeB', () => {
        expect(isTimeABeforeTimeB('00:00', '00:01')).toBeTruthy()
        expect(isTimeABeforeTimeB('23:59', '00:00')).toBeFalsy()
    })
})
