import { EntityRepository, Repository } from 'typeorm';
import { QuizQuestion } from '../../models/Quiz';

@EntityRepository(QuizQuestion)
export class QuizQuestionRepository extends Repository<QuizQuestion> {
    
}