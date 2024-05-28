import { EntityType } from '../common/utils'

export type Group = {
    group_id: string
    user_id: string
    group_name: string
    area: string
    type: EntityType
}

export type CreateGroupRequest = {
    name: string | null
}

export type CreateGroupResponse = {
    group_id: string
    group_name: string
    area: string
}
