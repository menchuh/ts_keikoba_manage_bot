export type HeaderObject = {
    'Access-Control-Allow-Headers': string
    'Access-Control-Allow-Origin': string
    'Access-Control-Allow-Methods': string
}

export type ErrorObject = {
    error: string
    message: string
}

export type PracticeRequest = {
    place: string
    date: string
    start_time: string
    end_time: string
}

export type CommunityCenterConfig = {
    [key: string]: CommunityCenter[]
}

export type CommunityCenter = {
    name: string
    address: string
    image: string
}
