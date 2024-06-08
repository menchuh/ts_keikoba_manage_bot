import { IsNumber, IsString } from 'class-validator'

export class Practice {
    @IsString()
    group_id: string

    @IsString()
    date_start_place: string

    @IsString()
    address: string

    @IsString()
    date: string

    @IsString()
    end_time: string

    @IsString()
    group_name: string

    @IsString()
    image?: string

    @IsNumber()
    latitude?: number

    @IsNumber()
    longtitude?: number

    @IsString()
    name: string

    @IsString()
    place: string

    @IsString()
    start_time: string
}

export class CreatePracticeData {
    @IsString()
    group_id?: string

    @IsString()
    group_name?: string

    @IsString()
    place?: string

    @IsString()
    date?: string

    @IsString()
    start_time?: string

    @IsString()
    end_time?: string
}
