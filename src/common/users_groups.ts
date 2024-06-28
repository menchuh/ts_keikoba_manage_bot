import { IsArray, IsEnum, IsObject, IsString } from 'class-validator'
import { CreatePracticeData } from './practices.js'

// 定数
export const JOINABLE_GROUP_COUNT = 4

export enum EntityType {
    user = 'user', // eslint-disable-line no-unused-vars
    group = 'group', // eslint-disable-line no-unused-vars
    relation = 'relation', // eslint-disable-line no-unused-vars
}

export enum UserMode {
    JoinGroup = 'JoinGroup', // eslint-disable-line no-unused-vars
    ListPractices = 'ListPractices', // eslint-disable-line no-unused-vars
    NotifyPractices = 'NotifyPractices', // eslint-disable-line no-unused-vars
    AddPractice = 'AddPractice', // eslint-disable-line no-unused-vars
    DeletePractice = 'DeletePractice', // eslint-disable-line no-unused-vars
    WithdrawGroup = 'WithdrawGroup', // eslint-disable-line no-unused-vars
}

export enum UserNotifyPracticesWithdrawGroupPhase {
    AskGroup = 'AskGroup', // eslint-disable-line no-unused-vars
    Confirm = 'Confirm', // eslint-disable-line no-unused-vars
}

export enum UserAddPracticePhase {
    AskGroup = 'AskGroup', // eslint-disable-line no-unused-vars
    AskPlace = 'AskPlace', // eslint-disable-line no-unused-vars
    AskDate = 'AskDate', // eslint-disable-line no-unused-vars
    AskStart = 'AskStart', // eslint-disable-line no-unused-vars
    AskEnd = 'AskEnd', // eslint-disable-line no-unused-vars
}

export class User {
    @IsString()
    group_id: string

    @IsString()
    user_id: string

    @IsArray()
    groups: Group[]

    @IsObject()
    session: UserSession | null

    @IsEnum(EntityType)
    type: EntityType
}

export class Group {
    @IsString()
    group_id: string

    @IsString()
    user_id?: string

    @IsString()
    group_name: string

    @IsString()
    area: string

    @IsEnum(EntityType)
    type?: EntityType
}

export class Relation {
    @IsString()
    group_id: string

    @IsString()
    user_id: string

    @IsEnum(EntityType)
    type: EntityType
}

export class UserSession {
    @IsEnum(UserMode)
    mode?: UserMode

    @IsEnum(UserNotifyPracticesWithdrawGroupPhase || UserAddPracticePhase)
    phase?: UserNotifyPracticesWithdrawGroupPhase | UserAddPracticePhase

    @IsObject()
    data?: CreatePracticeData
}
