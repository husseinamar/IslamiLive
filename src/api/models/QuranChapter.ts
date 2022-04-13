import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { QuranVerse } from './QuranVerse';

@Entity()
export class QuranChapter {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'chapter_number' })
	public number: number;

	@Column({ name: 'name' })
	public name: string;

	@Column({ name: 'german' })
	public german: string;

	@OneToMany(() => QuranVerse, verse => verse.chapter )
	public verses: QuranVerse[];
}
