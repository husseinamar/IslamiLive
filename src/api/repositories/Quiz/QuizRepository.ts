import { EntityRepository, Repository } from 'typeorm';
import { Quiz } from '../../models/Quiz';

@EntityRepository(Quiz)
export class QuizRepository extends Repository<Quiz> {
    
}