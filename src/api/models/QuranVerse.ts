import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { QuranChapter } from "./QuranChapter";

@Entity()
export class QuranVerse {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'verse_number', nullable: false })
	public number: number;

	@Column({ name: 'arabic', nullable: false, type: 'text' })
	public arabic: string;

	@Column({ name: 'german', type: 'text' })
	public german: string;

	@ManyToOne(() => QuranChapter, chapter => chapter.verses )
	public chapter: QuranChapter;

}
