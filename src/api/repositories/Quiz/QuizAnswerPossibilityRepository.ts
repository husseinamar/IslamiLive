import { EntityRepository, Repository } from 'typeorm';
import { QuizAnswerPossibility } from '../../models/Quiz';

@EntityRepository(QuizAnswerPossibility)
export class QuizAnswerPossibilityRepository extends Repository<QuizAnswerPossibility> {
    
}