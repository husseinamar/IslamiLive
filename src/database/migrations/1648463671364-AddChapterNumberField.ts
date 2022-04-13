import {MigrationInterface, QueryRunner} from "typeorm";

export class AddChapterNumberField1648463671364 implements MigrationInterface {
    name = 'AddChapterNumberField1648463671364'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quran_chapter\` ADD \`chapter_number\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_chapter\` ADD \`german\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP FOREIGN KEY \`FK_0c9fca7ed428433a3e0f87a5cef\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` CHANGE \`chapterId\` \`chapterId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD CONSTRAINT \`FK_0c9fca7ed428433a3e0f87a5cef\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapter\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP FOREIGN KEY \`FK_0c9fca7ed428433a3e0f87a5cef\``);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` CHANGE \`chapterId\` \`chapterId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD CONSTRAINT \`FK_0c9fca7ed428433a3e0f87a5cef\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapter\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quran_chapter\` DROP COLUMN \`german\``);
        await queryRunner.query(`ALTER TABLE \`quran_chapter\` DROP COLUMN \`chapter_number\``);
    }

}
