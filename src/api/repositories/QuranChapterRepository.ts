import { EntityRepository, Repository } from 'typeorm';
import { QuranChapter } from '../models/QuranChapter';

@EntityRepository(QuranChapter)
export class QuranChapterRepository extends Repository<QuranChapter> {
    
}