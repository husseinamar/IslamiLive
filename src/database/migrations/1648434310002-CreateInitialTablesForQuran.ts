import {MigrationInterface, QueryRunner} from "typeorm";

export class CreateInitialTablesForQuran1648434310002 implements MigrationInterface {
    name = 'CreateInitialTablesForQuran1648434310002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`quran_verse\` (\`id\` int NOT NULL AUTO_INCREMENT, \`verse_number\` int NOT NULL, \`arabic\` varchar(255) NOT NULL, \`german\` varchar(255) NOT NULL, \`chapterId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`quran_chapter\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`quran_verse\` ADD CONSTRAINT \`FK_0c9fca7ed428433a3e0f87a5cef\` FOREIGN KEY (\`chapterId\`) REFERENCES \`quran_chapter\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`quran_verse\` DROP FOREIGN KEY \`FK_0c9fca7ed428433a3e0f87a5cef\``);
        await queryRunner.query(`DROP TABLE \`quran_chapter\``);
        await queryRunner.query(`DROP TABLE \`quran_verse\``);
    }

}
