import { EntityRepository, Repository } from 'typeorm';
import { DuaVerse } from '../models/DuaVerse';

@EntityRepository(DuaVerse)
export class DuaVerseRepository extends Repository<DuaVerse> {
    
}