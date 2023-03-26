import 'reflect-metadata';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ImportDuaFromArrayRequest {

    @IsNotEmpty({
        message: 'Please supply the number (index) of the chapter (1-114)',
    })
    public lines: Array<{}>;

    @IsNotEmpty({
        message: 'Please specify the german text identifier',
    })
    public germanTextIdentifier: string;

    @IsNotEmpty({
        message: 'Please specify the arabic text identifier',
    })
    public arabicTextIdentifier: string;

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

    @IsBoolean({
        message: 'shouldAppend needs to be a boolean'
    })
    public shouldAppend: boolean = false;
}