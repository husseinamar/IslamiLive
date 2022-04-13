import 'reflect-metadata';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateQuranChapterRequest {

    @IsNotEmpty({
        message: 'Please supply the number (index) of the chapter (1-114)',
    })
    @IsNumber({}, {
        message: 'Chapter index needs to be a number',
    })
    public number: string;

    @IsNotEmpty({
        message: 'Please supply the arabic name of the chapter',
    })
    @IsString({
        message: 'Chapter name needs to be a string',
    })
    public name: string;

    @IsString({
        message: 'German name of the chapter needs to be a string',
    })
    public germanName: string;

}