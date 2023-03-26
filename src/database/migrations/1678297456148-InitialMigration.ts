import {MigrationInterface, QueryRunner} from "typeorm";

export class InitialMigration1678297456148 implements MigrationInterface {
    name = 'InitialMigration1678297456148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`dua_verses\` (\`id\` int NOT NULL AUTO_INCREMENT, \`verse_number\` int NOT NULL, \`arabic\` text NOT NULL, \`german\` text NOT NULL, \`chapterId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`duas\` (\`id\` int NOT NULL AUTO_INCREMENT, \`chapter_number\` int NULL, \`name\` varchar(255) NOT NULL, \`german\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quran_chapters\` (\`id\` int NOT NULL AUTO_INCREMENT, \`chapter_number\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`german\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quran_verses\` (\`id\` int NOT NULL AUTO_INCREMENT, \`verse_number\` int NOT NULL, \`arabic\` longtext NOT NULL, \`german\` longtext NOT NULL, \`chapterId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quiz_possible_answers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`value\` varchar(255) NOT NULL, \`is_correct\` tinyint NOT NULL DEFAULT 0, \`questionId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quiz_questions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`type\` enum ('fill_in_the_blanks', 'multiple_choice', 'single_choice') NOT NULL DEFAULT 'multiple_choice', \`question\` varchar(255) NOT NULL, \`num_correct_answers\` int NOT NULL, \`categoryId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quiz_categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`quizId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quizzes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` ADD CONSTRAINT \`FK_726455e332186ebaa5918d5d3d6\` FOREIGN KEY (\`chapterId\`) REFERENCES \`duas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` ADD CONSTRAINT \`FK_ac7152d2ef356dbb46c661ac522\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapters\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` ADD CONSTRAINT \`FK_31cad8316b6c8e7ce1a69d4c10d\` FOREIGN KEY (\`questionId\`) REFERENCES \`quiz_questions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` ADD CONSTRAINT \`FK_23735c04bc0f579ae6294f70996\` FOREIGN KEY (\`categoryId\`) REFERENCES \`quiz_categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` ADD CONSTRAINT \`FK_e578d7cbdf78871bbf698e2615b\` FOREIGN KEY (\`quizId\`) REFERENCES \`quizzes\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quiz_categories\` DROP FOREIGN KEY \`FK_e578d7cbdf78871bbf698e2615b\``);
        await queryRunner.query(`ALTER TABLE \`quiz_questions\` DROP FOREIGN KEY \`FK_23735c04bc0f579ae6294f70996\``);
        await queryRunner.query(`ALTER TABLE \`quiz_possible_answers\` DROP FOREIGN KEY \`FK_31cad8316b6c8e7ce1a69d4c10d\``);
        await queryRunner.query(`ALTER TABLE \`quran_verses\` DROP FOREIGN KEY \`FK_ac7152d2ef356dbb46c661ac522\``);
        await queryRunner.query(`ALTER TABLE \`dua_verses\` DROP FOREIGN KEY \`FK_726455e332186ebaa5918d5d3d6\``);
        await queryRunner.query(`DROP TABLE \`quizzes\``);
        await queryRunner.query(`DROP TABLE \`quiz_categories\``);
        await queryRunner.query(`DROP TABLE \`quiz_questions\``);
        await queryRunner.query(`DROP TABLE \`quiz_possible_answers\``);
        await queryRunner.query(`DROP TABLE \`quran_verses\``);
        await queryRunner.query(`DROP TABLE \`quran_chapters\``);
        await queryRunner.query(`DROP TABLE \`duas\``);
        await queryRunner.query(`DROP TABLE \`dua_verses\``);
    }

}
