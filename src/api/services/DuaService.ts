import { Service } from 'typedi';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { DuaChapter } from '../models/DuaChapter';
import { DuaChapterRepository } from '../repositories/DuaChapterRepository';
import { DuaVerse } from '../models/DuaVerse';
import { DuaVerseRepository } from '../repositories/DuaVerseRepository';
import { getRepository, In, Like } from 'typeorm';

@Service()
export class DuaService {
    @InjectRepository() private DuaChapterRepository: DuaChapterRepository;
    @InjectRepository() private DuaVerseRepository: DuaVerseRepository;
    // @Logger(__filename) private log: LoggerInterface;

    constructor(
    ) {
        this.DuaChapterRepository = getRepository(DuaChapter);
        this.DuaVerseRepository = getRepository(DuaVerse);
    }

    // find exactly one DuaChapter matching criteria
    public findOneChapter(findCondition: any): Promise<DuaChapter> {
        // this.log.info('Find a DuaChapter');
        return this.DuaChapterRepository.findOne(findCondition);
    }

    // find all DuaChapters matching certain criteria
    public findAllChapters(findCondition: any): Promise<DuaChapter[]> {
        // this.log.info('Find all DuaChapters matching');
        return this.DuaChapterRepository.find(findCondition);
    }

    // list all DuaChapters
    public listChapters(limit: number = 0, offset: number = 0, select: any = [], relation: any = [], whereConditions: any = [], keyword: string, count: number | boolean, order: string = 'ASC'): Promise<DuaChapter[]> | Promise<number> {
        const condition: any = {};

        if (select && select.length > 0) {
            condition.select = select;
        }

        if (relation && relation.length > 0) {
            condition.relations = relation;
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

        if (count) {
            return this.DuaChapterRepository.count(condition);
        } else {
            return this.DuaChapterRepository.find(condition);
        }
    }

    // create a new chapter
    public async createChapter(DuaChapter: DuaChapter): Promise<DuaChapter> {
        const newChapter = await this.DuaChapterRepository.save(DuaChapter);
        return newChapter;
    }

    public async clearAllChapters(): Promise<void> {
        const clear = await this.DuaChapterRepository.clear();
        return clear;
    }

    // find exactly one DuaVerse matching criteria
    public findOneVerse(findCondition: any): Promise<DuaVerse> {
        // this.log.info('Find a DuaVerse');
        return this.DuaVerseRepository.findOne(findCondition);
    }

    // find all DuaVerses matching certain criteria
    public findAllVerses(findCondition: any): Promise<DuaVerse[]> {
        // this.log.info('Find all DuaVerses matching');
        return this.DuaVerseRepository.find(findCondition);
    }

    // list all DuaVerses
    public listVerses(limit: number = 0, offset: number = 0, select: any = [], relation: any = [], whereConditions: any = [], keyword: string, count: number | boolean, order: string = 'ASC'): Promise<DuaVerse[]> | Promise<number> {
        const condition: any = {};

        if (select && select.length > 0) {
            condition.select = select;
        }

        if (relation && relation.length > 0) {
            condition.relations = relation;
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

        if (count) {
            return this.DuaVerseRepository.count(condition);
        } else {
            return this.DuaVerseRepository.find(condition);
        }
    }

    // create a new verse
    public async createVerse(DuaVerse: DuaVerse): Promise<DuaVerse> {
        const newVerse = await this.DuaVerseRepository.save(DuaVerse);
        return newVerse;
    }

    public async clearAllVerses(): Promise<void> {
        const clear = await this.DuaVerseRepository.clear();
        return clear;
    }

    public async deleteChapter(id: number): Promise<any> {
        const chapter = await this.DuaChapterRepository.delete(id);
        return chapter;
    }

    public async deleteVerse(id: number): Promise<any> {
        const verse = await this.DuaVerseRepository.delete(id);
        return verse;
    }
}
