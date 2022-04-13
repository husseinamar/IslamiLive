import {MigrationInterface, QueryRunner} from "typeorm";

export class AddVerseTextType1648464294435 implements MigrationInterface {
    name = 'AddVerseTextType1648464294435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP FOREIGN KEY \`FK_0c9fca7ed428433a3e0f87a5cef\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP COLUMN \`arabic\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD \`arabic\` text NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP COLUMN \`german\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD \`german\` text NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` CHANGE \`chapterId\` \`chapterId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD CONSTRAINT \`FK_0c9fca7ed428433a3e0f87a5cef\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapter\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP FOREIGN KEY \`FK_0c9fca7ed428433a3e0f87a5cef\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` CHANGE \`chapterId\` \`chapterId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP COLUMN \`german\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD \`german\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP COLUMN \`arabic\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD \`arabic\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD CONSTRAINT \`FK_0c9fca7ed428433a3e0f87a5cef\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapter\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
