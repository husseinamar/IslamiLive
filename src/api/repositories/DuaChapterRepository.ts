import { EntityRepository, Repository } from 'typeorm';
import { DuaChapter } from '../models/DuaChapter';

@EntityRepository(DuaChapter)
export class DuaChapterRepository extends Repository<DuaChapter> {
    
}