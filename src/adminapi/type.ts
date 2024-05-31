export type CreateGroupRequest = {
    name: string | null
}

export type CreateGroupResponse = {
    group_id: string
    group_name: string
    area: string
}

export type CreatePracticeRequest = {
    place: string
    date: string
    start_time: string
    end_time: string
}
