import { Service } from 'typedi';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { QuranVerse } from '../models/QuranVerse';
import { QuranVerseRepository } from '../repositories/QuranVerseRepository';
import { getRepository, In, Like } from 'typeorm';

@Service()
export class QuranVerseService {
    @InjectRepository() private QuranVerseRepository: QuranVerseRepository;
    // @Logger(__filename) private log: LoggerInterface;

    constructor(
    ) {
        this.QuranVerseRepository = getRepository(QuranVerse);
    }

    // find exactly one QuranVerse matching criteria
    public findOne(findCondition: any): Promise<QuranVerse> {
        // this.log.info('Find a QuranVerse');
        return this.QuranVerseRepository.findOne(findCondition);
    }

    // find all QuranVerses matching certain criteria
    public findAll(findCondition: any): Promise<QuranVerse[]> {
        // this.log.info('Find all QuranVerses matching');
        return this.QuranVerseRepository.find(findCondition);
    }

    // list all QuranVerses
    public list(limit: number = 0, offset: number = 0, select: any = [], relation: any = [], whereConditions: any = [], keyword: string, count: number | boolean, order: string = 'ASC'): Promise<QuranVerse[]> | Promise<number> {
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
            return this.QuranVerseRepository.count(condition);
        } else {
            return this.QuranVerseRepository.find(condition);
        }
    }

    // create a new report
    public async create(QuranVerse: QuranVerse): Promise<QuranVerse> {
        const newVerse = await this.QuranVerseRepository.save(QuranVerse);
        return newVerse;
    }

    public async clearAll(): Promise<void> {
        const clear = await this.QuranVerseRepository.clear();
        return clear;
    }
}
