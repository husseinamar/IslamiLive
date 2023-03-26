import { EntityRepository, Repository } from 'typeorm';
import { QuizCategory } from '../../models/Quiz';

@EntityRepository(QuizCategory)
export class QuizCategoryRepository extends Repository<QuizCategory> {
    
}