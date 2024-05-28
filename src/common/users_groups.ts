import { IsArray, IsEnum, IsObject, IsString } from 'class-validator'
import { EntityType } from './utils'

export class User {
    @IsString()
    group_id: string

    @IsString()
    user_id: string

    @IsArray()
    groups: string[]

    @IsObject()
    session: {}

    @IsEnum(EntityType)
    type: EntityType
}

export class Group {
    @IsString()
    group_id: string

    @IsString()
    user_id: string

    @IsString()
    group_name: string

    @IsString()
    area: string

    @IsEnum(EntityType)
    type: EntityType
}

export class Relation {
    @IsString()
    group_id: string

    @IsString()
    user_id: string

    @IsEnum(EntityType)
    type: EntityType
}
