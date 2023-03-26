import { Service } from 'typedi';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { DeleteResult, FindManyOptions, getRepository, In, Like } from 'typeorm';
import { QuizRepository, QuizCategoryRepository, QuizQuestionRepository, QuizAnswerPossibilityRepository } from '../../repositories/Quiz';
import { Quiz, QuizAnswerPossibility, QuizCategory, QuizQuestion } from '../../models/Quiz';

@Service()
export class QuizService {
    @InjectRepository() private quizzes: QuizRepository;
    @InjectRepository() private categories: QuizCategoryRepository;
    @InjectRepository() private questions: QuizQuestionRepository;
    @InjectRepository() private answerPossibilities: QuizAnswerPossibilityRepository;

    constructor() {
        this.quizzes = getRepository(Quiz);
        this.categories = getRepository(QuizCategory);
        this.questions = getRepository(QuizQuestion);
        this.answerPossibilities = getRepository(QuizAnswerPossibility);
    }

    /*
     * START OF QUIZ 
     */

    // create a new quiz
    public async createQuiz(quiz: Quiz): Promise<Quiz> {
        const newQuiz = await this.quizzes.save(quiz);
        return newQuiz;
    }

    // find exactly one Quiz matching criteria
    public async findOneQuiz(findCondition: any): Promise<Quiz> {
        // this.log.info('Find a Quiz');
        return this.quizzes.findOne(findCondition);
    }

    // find all quizzes matching certain criteria
    public async findManyQuizzes(findCondition: any): Promise<Quiz[]> {
        // this.log.info('Find all Quizzes matching');
        return this.quizzes.find(findCondition);
    }

    // list all Quizzes
    public async listQuizzes(limit: number = 0, offset: number = 0, select: (keyof Quiz)[] = [], relations: string[] = [], whereConditions: any = [], keyword: string, count: number | boolean = false, order: string = 'ASC'): Promise< number | { quizzes: Quiz[], limit: number, offset: number, more: boolean, count: number, total: number }> {
        const condition: FindManyOptions<Quiz> = {};

        if (select && select.length > 0) {
            condition.select = select;
        }

        if (relations && relations.length > 0) {
            condition.relations = relations;
        }

        condition.where = {};

        if (whereConditions && whereConditions.length > 0) {
            whereConditions.forEach((item: any) => {
                condition.where[item.name] = item.value;
            });
        }
        if (keyword) {
            condition.where = {
                name: Like('%' + keyword + '%'),
            };
        }

        if ( order !== 'ASC' && order !== 'DESC' ) {
            condition.order = {
                id: 'ASC',
            };
        } else {
            condition.order = {
                id: order,
            };
        }

        if (limit && limit > 0) {
            condition.take = limit;
            condition.skip = offset;
        }

        const numOffersMatching = await this.quizzes.count(condition);

        if (count) {
            return numOffersMatching;
        }

        const matchingQuizzes = await this.quizzes.find(condition);
        return {
            quizzes: matchingQuizzes,
            limit,
            offset,
            more: (numOffersMatching - (limit + offset) > 0) ? true : false,
            count: matchingQuizzes.length,
            total: numOffersMatching,
        };
    }

    // TODO: improve function return value type
    public async deleteQuiz(id: number): Promise<any> {
        const chapter = await this.quizzes.delete(id);
        return chapter;
    }

    public async clearAllQuizzes(): Promise<void> {
        await this.quizzes.clear();
    }

    /*
     * END OF QUIZ 
     */

    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
    // ----------------------------------------------------------------

    /*
     * START OF QUIZ CATEGORIES 
     */

    // create a new quiz category
    public async createCategory(category: QuizCategory): Promise<QuizCategory> {
        const newCategory = await this.categories.save(category);
        return newCategory;
    }

    // find exactly one Category matching criteria
    public async findOneCategory(findCondition: any): Promise<QuizCategory> {
        // this.log.info('Find a Quiz');
        return this.categories.findOne(findCondition);
    }

    /*
     * END OF QUIZ CATEGORIES
     */

    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
    // ----------------------------------------------------------------

    /*
     * START OF QUIZ QUESTIONS 
     */

    // create a new quiz question
    public async createQuestion(question: QuizQuestion): Promise<QuizQuestion> {
        const newQuestion = await this.questions.save(question);
        return newQuestion;
    }

    // find exactly one Category matching criteria
    public async findOneQuestion(findCondition: any): Promise<QuizQuestion> {
        // this.log.info('Find a Quiz');
        return this.questions.findOne(findCondition);
    }

    public async updateOneQuestion(id: number, question: QuizQuestion): Promise<QuizQuestion> {
        
        if ( id !== undefined ) {
            question.id = id;
        }
        
        return this.questions.save(question);
    }

    public async deleteOneQuestion(question: QuizQuestion): Promise<QuizQuestion> {        
        await this.questions.delete(question.id);
        return question;
    }

    /*
     * END OF QUIZ QUESTIONS
     */

    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
    // ----------------------------------------------------------------

    /*
     * START OF QUIZ QUESTIONS 
     */

    // create a new quiz question
    public async createAnswerPossibility(possibility: QuizAnswerPossibility): Promise<QuizAnswerPossibility> {
        const newPossibility = await this.answerPossibilities.save(possibility);
        
        // update the question too
        const question = possibility.question;
        question.answerPossibilities.push(newPossibility);
        await this.updateOneQuestion(question.id, question);

        return newPossibility;
    }

    public async deleteOneAnswerPossibility(possibility: QuizAnswerPossibility): Promise<DeleteResult> {        
        return this.answerPossibilities.delete(possibility);
    }

    /*
     * END OF QUIZ QUESTIONS
     */

    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
    // ----------------------------------------------------------------
}
