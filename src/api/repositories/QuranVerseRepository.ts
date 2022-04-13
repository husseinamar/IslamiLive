import { EntityRepository, Repository } from 'typeorm';
import { QuranVerse } from '../models/QuranVerse';

@EntityRepository(QuranVerse)
export class QuranVerseRepository extends Repository<QuranVerse> {
    
}