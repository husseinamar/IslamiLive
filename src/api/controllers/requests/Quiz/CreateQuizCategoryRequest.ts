import 'reflect-metadata';
import { IsArray, IsString } from 'class-validator';
import { QuizQuestion } from '../../../models/Quiz';

export class CreateQuizCategoryRequest {
    @IsString({
        message: 'Name of category must be a name',
    })
    public name: string;

    @IsArray({
        message: 'categories must be an array of Objects',
    })
    public questions: QuizQuestion[];

}