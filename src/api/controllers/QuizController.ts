import 'reflect-metadata';
import { Service } from 'typedi';
import { Body, Delete, Get, JsonController, Param, Post, Put, QueryParam, Req, Res } from 'routing-controllers';
import { instanceToPlain } from 'class-transformer';

import { QuizService } from '../services/Quiz/QuizService';
import { Response } from 'express';
import { FindOneQuizeRequest } from './requests/Quiz/FindOneQuizeRequest';
import { CreateQuizRequest } from './requests/Quiz/CreateQuizRequest';
import { Quiz, QuizAnswerPossibility, QuizCategory, QuizQuestion } from '../models/Quiz';
import { CreateQuizQuestionRequest } from './requests/Quiz/CreateQuizQuestionRequest';
import { CreateQuizCategoryRequest } from './requests/Quiz/CreateQuizCategoryRequest';

@Service()
@JsonController('/quiz')
export class QuizController {
    private quizService: QuizService;

    constructor() {
        this.quizService = new QuizService();
    }

    @Get('/ping')
    public async ping(
        @Res() response: any
    ): Promise<any> {
        const successResponse: any = {
            status: 1,
            message: 'Successfully pinged the quiz route',
            data: 'Hello',
        };
        return response.status(200).send(successResponse);
    }

    // TODO: Improve save logic for DB to optimize performance
    @Post('/')
    public async createQuiz(
        @Body({ validate: true }) createParam: CreateQuizRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(createParam);

        let quiz = await this.quizService.findOneQuiz({
            where: [
                { name: createParam.name, },
            ]
        });

        if ( quiz ) {
            const errorResponse: any = {
                status: 500,
                message: 'Quiz already exists.',
                data: quiz,
            };
            return response.status(500).send(errorResponse);
        }

        const failedQuizzes: string[] = [];

        const newQuiz = new Quiz();
        newQuiz.name = createParam.name;

        // save the quiz in the DB
        const newQuizSaveResponse = await this.quizService.createQuiz(createParam as Quiz);

        if ( !newQuizSaveResponse ) {
            failedQuizzes.push(createParam.name);
        }
        
        // // check if the request also included categories to be created
        // if ( createParam.categories?.length > 0 ) {
        //     newQuiz.categories = [];

        //     for ( const category of createParam.categories ) {

        //         if ( !category ) {
        //             continue;
        //         }

        //         const newCategory = new QuizCategory();
        //         newCategory.name = category.name;

        //         // save the category in the DB
        //         const newCategorySaveResponse = await this.quizService.createCategory(category);

        //         if ( !newCategorySaveResponse ) {
        //             failedCategories.push(newCategory);
        //         }
                
        //         // // check if the category also included questions
        //         // if ( !category.questions || category.questions?.length <= 0 ) {
        //         //     console.log(`category ${category.name} has no questions, so going to ignore it.`);
        //         //     continue;
        //         // }

        //         // newCategory.questions = [];

        //         // for ( const question of category.questions ) {
        //         //     if ( !question ) {
        //         //         continue;
        //         //     }

        //         //     const newQuestion = new QuizQuestion();
        //         //     newQuestion.category = newCategory;
        //         //     newQuestion.type = question.type;
        //         //     newQuestion.question = question.question;
        //         //     newQuestion.numCorrectAnswers = question.numCorrectAnswers;

        //         //     // save the questions in DB and push to the array of the category
        //         //     newCategory.questions.push(newQuestion);
        //         //     const newQuestionSaveResponse = await this.quizService.createQuestion(newQuestion);

        //         //     if ( !newQuestionSaveResponse ) {
        //         //         failedQuestions.push(question);
        //         //     }

        //         //     // // check if answers provided
        //         //     // if ( question.numCorrectAnswers > 0 ) {
        //         //     //     newQuestion.answerPossibilities = [];
                        
        //         //     //     for ( const possibility of question.answerPossibilities ) {
        //         //     //         if ( !possibility ) {
        //         //     //             continue;
        //         //     //         }

        //         //     //         const newPossibility = new QuizAnswerPossibility();
        //         //     //         newPossibility.value = possibility.value;
        //         //     //         newPossibility.isCorrect = possibility.isCorrect;
        //         //     //         newPossibility.question = question;

        //         //     //         newQuestion.answerPossibilities.push(newPossibility);
        //         //     //         const newPossibilitySaveResponse = await this.quizService.createAnswerPossibility(newPossibility);

        //         //     //         if ( !newPossibilitySaveResponse ) {
        //         //     //             failedAnswerPossibilies.push(newPossibility);
        //         //     //         }

        //         //     //     }
        //         //     // }
        //         // }
        //     }
        // }

        // check if any creation process failed to inform the user
        if ( failedQuizzes.length > 0 ) {
            const errorResponse = {
                status: 203,
                message: 'An error occured while saving the quiz. The following could not be saved',
                data: instanceToPlain({
                    failedQuizzes: instanceToPlain(failedQuizzes),
                }),
            };
            return response.status(203).send(errorResponse);
        }

        // everything went well
        const successResponse = {
            status: 0,
            message: 'Created a new Quiz.',
            data: instanceToPlain(newQuizSaveResponse),
        };
        return response.status(201).send(successResponse);
    }

    @Post('/:quizId/category/:categoryId/question')
    public async createQuestion(
        @Param('quizId') quizId: number,
        @Param('categoryId') categoryId: number,
        @Body({ validate: true }) createParam: CreateQuizQuestionRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(createParam);

        let quiz = await this.quizService.findOneQuiz({
            relations: ['categories', 'categories.questions', 'categories.questions.answerPossibilities'],
            where: [
                { id: quizId, },
            ]
        });

        if ( !quiz ) {
            const errorResponse = {
                status: 404,
                message: 'Quiz does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        console.log('quiz:', quiz);
        console.log('unfiltered categories:', quiz.categories);
        const categories = quiz.categories?.filter((category) => category.id.toString() === `${categoryId}` );
        console.log('filtered categories:', categories);

        if ( !categories || categories?.length === 0 ) {
            const errorResponse = {
                status: 404,
                message: 'Category does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const category = categories[0];

        const failedQuestions: QuizQuestion[] = [];
        const failedAnswerPossibilies: QuizAnswerPossibility[] = [];
        const successQuestions: QuizQuestion[] = [];

        for ( const question of createParam.questions ) {
            if ( !question ) {
                continue;
            }

            const newQuestion = new QuizQuestion();
            newQuestion.category = category;
            newQuestion.type = question.type;
            newQuestion.question = question.question;
            newQuestion.numCorrectAnswers = question.numCorrectAnswers;

            // save the questions in DB and push to the array of the category
            const newQuestionSaveResponse = await this.quizService.createQuestion(newQuestion);

            if ( !newQuestionSaveResponse ) {
                failedQuestions.push(question);
                continue;
            }

            // check if answers provided
            if ( question.answerPossibilities?.length > 0 ) {
                newQuestionSaveResponse.answerPossibilities = [];
                
                for ( const possibility of question.answerPossibilities ) {
                    if ( !possibility ) {
                        continue;
                    }

                    const newPossibility = new QuizAnswerPossibility();
                    newPossibility.value = possibility.value;
                    newPossibility.isCorrect = possibility.isCorrect;
                    newPossibility.question = newQuestionSaveResponse;

                    const newPossibilitySaveResponse = await this.quizService.createAnswerPossibility(newPossibility);
                    console.log('saved answer choice:', newPossibilitySaveResponse);

                    if ( !newPossibilitySaveResponse ) {
                        failedAnswerPossibilies.push(newPossibility);
                        continue;
                    }

                    // exclude the question from the answer possibility response
                    delete newPossibilitySaveResponse.question;
                    // newQuestionSaveResponse.answerPossibilities?.push(newPossibilitySaveResponse);
                }
            }
            
            // exclude the Category from the question response
            delete newQuestionSaveResponse.category;
            successQuestions.push(newQuestionSaveResponse);
        }

        // check if any creation process failed to inform the user
        if ( failedQuestions.length > 0 || failedAnswerPossibilies.length > 0 ) {
            const errorResponse = {
                status: 203,
                message: 'An error occured while saving the quiz. The following could not be saved',
                data: instanceToPlain({
                    failedQuestions: instanceToPlain(failedQuestions),
                    failedAnswerPossibilies: instanceToPlain(failedAnswerPossibilies),
                }),
            };
            return response.status(203).send(errorResponse);
        }

        console.log(successQuestions);

        // everything went well
        const successResponse = {
            status: 0,
            message: 'Created a new question.',
            data: instanceToPlain(successQuestions),
        };
        return response.status(200).send(successResponse);
    }

    @Post('/:quizId/category')
    public async createCategory(
        @Param('quizId') quizId: number,
        @Body({ validate: true }) createParam: CreateQuizCategoryRequest,
        @Res() response: any
    ): Promise<any> {
        console.log(createParam);

        let quiz = await this.quizService.findOneQuiz({
            relation: ['categories'],
            where: [
                { id: quizId, },
            ]
        });

        if ( !quiz ) {
            const errorResponse = {
                status: 404,
                message: 'Quiz does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const categories = quiz.categories?.filter((category) => category.name === createParam.name );

        if ( categories?.length > 0 ) {
            const errorResponse = {
                status: 404,
                message: 'Category already exists.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const newCategory = new QuizCategory();
        newCategory.quiz = quiz;
        newCategory.name = createParam.name;

        const newCategorySaveResponse = await this.quizService.createCategory(newCategory);
        delete newCategorySaveResponse.quiz;

        if ( !newCategorySaveResponse ) {
            const errorResponse = {
                status: 500,
                message: `Could not create a category for quiz ${quiz.id} - ${quiz.name}`,
                data: createParam,
            };
            return response.status(404).send(errorResponse);
        }

        // everything went well
        const successResponse = {
            status: 0,
            message: 'Created a new category.',
            data: instanceToPlain(newCategorySaveResponse),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/')
    public async findAllQuizzes(
        @QueryParam('limit') limit: number,
        @QueryParam('offset') offset: number,
        @QueryParam('keyword') keyword: string,
        @QueryParam('relations') relations: string[],
        @QueryParam('count') count: number | boolean,
        @QueryParam('order') order: string,
        @Res() response: any
    ): Promise<any> {
        // const relations = ['categories'];
        const WhereConditions = [];
        const fields = [];

        const quizzes = await this.quizService.listQuizzes(
            limit ?? 200,
            offset,
            fields,
            relations ?? [],
            WhereConditions,
            keyword,
            count,
            order
        );

        const successResponse: any = {
            status: 1,
            message: 'Successfully got all quizzes',
            data: instanceToPlain(quizzes),
        };
        return response.status(200).send(successResponse);
    }

    @Get('/:quizId/category/:categoryId/question/:questionId')
    public async findQuestionById(
        @Param('quizId') quizId: number,
        @Param('categoryId') categoryId: number,
        @Param('questionId') questionId: number,
        @Res() response: Response
    ): Promise<any> {
        const question = await this.quizService.findOneQuestion({
            where: {
                id: questionId,
            },
            relations: ['answerPossibilities'],
        });

        console.log(question);

        if ( question ) {
            const successResponse = {
                status: 0,
                message: 'Found question.',
                data: instanceToPlain(question),
            };
            return response.status(200).send(successResponse);
        }

        const errorResponse = {
            status: 404,
            message: 'Could not find a question for the specified id.',
            data: {},
        };
        return response.status(404).send(errorResponse);
    }

    @Get('/:quizId/category/:categoryId')
    public async findCategoryById(
        @Param('quizId') quizId: number,
        @Param('categoryId') categoryId: number,
        @Res() response: Response
    ): Promise<any> {
        const quiz = await this.quizService.findOneQuiz({
            where: {
                id: quizId,
            },
            relations: ['categories', 'categories.questions', 'categories.questions.answerPossibilities'],
        });

        if ( !quiz ) {
            const errorResponse = {
                status: 404,
                message: 'Could not find a quiz with the provided id.',
                data: undefined,
            };
            return response.status(404).send(errorResponse);
        }

        const categories = quiz.categories?.filter((category) => category.id.toString() === `${categoryId}`);

        if ( categories?.length > 0 ) {
            const successResponse = {
                status: 0,
                message: 'Found category.',
                data: instanceToPlain(categories[0]),
            };
            return response.status(200).send(successResponse);
        }

        const errorResponse = {
            status: 404,
            message: 'Could not find a category for the specified id.',
            data: {},
        };
        return response.status(404).send(errorResponse);
    }

    @Get('/:id')
    public async findQuizById(
        @Param('id') id: number,
        @Res() response: Response
    ): Promise<any> {
        const quiz = await this.quizService.findOneQuiz({
            where: {
                id,
            },
            relations: ['categories', 'categories.questions', 'categories.questions.answerPossibilities'],
        });

        if ( !quiz ) {
            const errorResponse = {
                status: 404,
                message: 'Could not find a quiz with the provided id.',
                data: undefined,
            };
            return response.status(404).send(errorResponse);
        }

        const successResponse = {
            status: 0,
            message: 'Found quiz.',
            data: instanceToPlain(quiz),
        };
        return response.status(200).send(successResponse);
    }

    @Delete('/:quizId/category/:categoryId/question/:questionId')
    public async deleteQuestionById(
        @Param('quizId') quizId: number,
        @Param('categoryId') categoryId: number,
        @Param('questionId') questionId: number,
        @Res() response: Response
    ): Promise<Response> {
        let quiz = await this.quizService.findOneQuiz({
            relations: ['categories', 'categories.questions', 'categories.questions.answerPossibilities'],
            where: [
                { id: quizId, },
            ]
        });

        if ( !quiz ) {
            const errorResponse = {
                status: 404,
                message: 'Quiz does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const category = quiz.categories?.find((category) => category.id.toString() === `${categoryId}`);

        if ( !category ) {
            const errorResponse = {
                status: 404,
                message: 'Category does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const question = category.questions.find((question) => question.id.toString() === `${questionId}`);

        if ( !question ) {
            const errorResponse = {
                status: 404,
                message: 'Question does not exist.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const deletedQuestion = await this.quizService.deleteOneQuestion(question);
        console.log('deletedQuestion', deletedQuestion);

        if ( !deletedQuestion ) {
            const errorResponse = {
                status: 500,
                message: 'Failed to delete the question.',
                data: {},
            };
            return response.status(404).send(errorResponse);
        }

        const successResponse = {
            status: 200,
            message: 'Question deleted successfully.',
            data: instanceToPlain(deletedQuestion),
        };
        return response.status(200).send(successResponse);

    }

}
