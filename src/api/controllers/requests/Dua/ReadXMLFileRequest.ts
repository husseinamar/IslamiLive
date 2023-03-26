import 'reflect-metadata';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ReadXMLFileRequest {

    @IsNotEmpty({
        message: 'Please supply the path of the file',
    })
    public filePath: string;

}