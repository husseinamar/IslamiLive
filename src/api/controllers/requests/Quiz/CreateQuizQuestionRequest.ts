import 'reflect-metadata';
import { IsArray } from 'class-validator';
import { QuizQuestion } from '../../../models/Quiz';

export class CreateQuizQuestionRequest {
    @IsArray({
        message: 'categories must be an array',
    })
    public questions: QuizQuestion[];

}