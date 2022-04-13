import { Service } from 'typedi';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { QuranChapter } from '../models/QuranChapter';
import { QuranChapterRepository } from '../repositories/QuranChapterRepository';
import { getRepository, In, Like } from 'typeorm';

@Service()
export class QuranChapterService {
    @InjectRepository() private QuranChapterRepository: QuranChapterRepository;
    // @Logger(__filename) private log: LoggerInterface;

    constructor(
    ) {
        this.QuranChapterRepository = getRepository(QuranChapter);
    }

    // find exactly one QuranChapter matching criteria
    public findOne(findCondition: any): Promise<QuranChapter> {
        // this.log.info('Find a QuranChapter');
        return this.QuranChapterRepository.findOne(findCondition);
    }

    // find all QuranChapters matching certain criteria
    public findAll(findCondition: any): Promise<QuranChapter[]> {
        // this.log.info('Find all QuranChapters matching');
        return this.QuranChapterRepository.find(findCondition);
    }

    // list all QuranChapters
    public list(limit: number = 0, offset: number = 0, select: any = [], relation: any = [], whereConditions: any = [], keyword: string, count: number | boolean, order: string = 'ASC'): Promise<QuranChapter[]> | Promise<number> {
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
            return this.QuranChapterRepository.count(condition);
        } else {
            return this.QuranChapterRepository.find(condition);
        }
    }

    // create a new report
    public async create(QuranChapter: QuranChapter): Promise<QuranChapter> {
        const newChapter = await this.QuranChapterRepository.save(QuranChapter);
        return newChapter;
    }

    public async clearAll(): Promise<void> {
        const clear = await this.QuranChapterRepository.clear();
        return clear;
    }
}
