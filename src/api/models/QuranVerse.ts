import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { QuranChapter } from "./QuranChapter";

@Entity("quran_verses")
export class QuranVerse {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'verse_number', nullable: false })
	public number: number;

	@Column({ name: 'arabic', nullable: false, type: 'longtext' })
	public arabic: string;

	@Column({ name: 'german', type: 'longtext' })
	public german: string;

	@ManyToOne(() => QuranChapter, chapter => chapter.verses )
	public chapter: QuranChapter;

}
