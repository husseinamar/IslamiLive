import 'reflect-metadata';
import { IsArray, IsNotEmpty, IsObject, IsString } from 'class-validator';
import { QuizCategory } from '../../../models/Quiz';

export class CreateQuizRequest {

    @IsNotEmpty({
        message: 'Please supply the arabic name of the chapter',
    })
    @IsString({
        message: 'Chapter name needs to be a string',
    })
    public name: string;

    // @IsObject({
    //     message: 'categories must be an array',
    // })
    // public categories: QuizCategory[];

}