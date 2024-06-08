import { IsArray, IsEnum, IsObject, IsString } from 'class-validator'
import {
    UserAddPracticePhase,
    UserMode,
    UserNotifyPracticesWithdrawGroupPhase,
} from '../manager_bot/user_sessions'
import { CreatePracticeData } from './practices'

// 定数
export enum EntityType {
    user = 'user',
    group = 'group',
    relation = 'relation',
}
export const JOINABLE_GROUP_COUNT = 4

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
