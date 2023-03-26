import 'reflect-metadata';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ImportDuaFromJSONFileRequest {

    @IsNotEmpty({
        message: 'Please supply the file name of the chapter',
    })
    @IsString({
        message: 'file name needs to be a string',
    })
    public file: string;

}