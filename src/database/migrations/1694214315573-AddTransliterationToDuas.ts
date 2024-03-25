import {MigrationInterface, QueryRunner} from "typeorm";

export class AddTransliterationToDuas1694214315573 implements MigrationInterface {
    name = 'AddTransliterationToDuas1694214315573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`dua_verses\` DROP FOREIGN KEY \`FK_726455e332186ebaa5918d5d3d6\``);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` CHANGE \`chapterId\` \`chapterId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`duas\` CHANGE \`chapter_number\` \`chapter_number\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` DROP FOREIGN KEY \`FK_ac7152d2ef356dbb46c661ac522\``);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` CHANGE \`chapterId\` \`chapterId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` DROP FOREIGN KEY \`FK_31cad8316b6c8e7ce1a69d4c10d\``);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` CHANGE \`questionId\` \`questionId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` DROP FOREIGN KEY \`FK_23735c04bc0f579ae6294f70996\``);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` CHANGE \`categoryId\` \`categoryId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` DROP FOREIGN KEY \`FK_e578d7cbdf78871bbf698e2615b\``);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` CHANGE \`quizId\` \`quizId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` ADD CONSTRAINT \`FK_726455e332186ebaa5918d5d3d6\` FOREIGN KEY (\`chapterId\`) REFERENCES \`duas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` ADD CONSTRAINT \`FK_ac7152d2ef356dbb46c661ac522\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapters\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` ADD CONSTRAINT \`FK_31cad8316b6c8e7ce1a69d4c10d\` FOREIGN KEY (\`questionId\`) REFERENCES \`quiz_questions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` ADD CONSTRAINT \`FK_23735c04bc0f579ae6294f70996\` FOREIGN KEY (\`categoryId\`) REFERENCES \`quiz_categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` ADD CONSTRAINT \`FK_e578d7cbdf78871bbf698e2615b\` FOREIGN KEY (\`quizId\`) REFERENCES \`quizzes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` DROP FOREIGN KEY \`FK_e578d7cbdf78871bbf698e2615b\``);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` DROP FOREIGN KEY \`FK_23735c04bc0f579ae6294f70996\``);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` DROP FOREIGN KEY \`FK_31cad8316b6c8e7ce1a69d4c10d\``);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` DROP FOREIGN KEY \`FK_ac7152d2ef356dbb46c661ac522\``);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` DROP FOREIGN KEY \`FK_726455e332186ebaa5918d5d3d6\``);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` CHANGE \`quizId\` \`quizId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` ADD CONSTRAINT \`FK_e578d7cbdf78871bbf698e2615b\` FOREIGN KEY (\`quizId\`) REFERENCES \`quizzes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` CHANGE \`categoryId\` \`categoryId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` ADD CONSTRAINT \`FK_23735c04bc0f579ae6294f70996\` FOREIGN KEY (\`categoryId\`) REFERENCES \`quiz_categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` CHANGE \`questionId\` \`questionId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` ADD CONSTRAINT \`FK_31cad8316b6c8e7ce1a69d4c10d\` FOREIGN KEY (\`questionId\`) REFERENCES \`quiz_questions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` CHANGE \`chapterId\` \`chapterId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` ADD CONSTRAINT \`FK_ac7152d2ef356dbb46c661ac522\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapters\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`duas\` CHANGE \`chapter_number\` \`chapter_number\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` CHANGE \`chapterId\` \`chapterId\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` ADD CONSTRAINT \`FK_726455e332186ebaa5918d5d3d6\` FOREIGN KEY (\`chapterId\`) REFERENCES \`duas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
