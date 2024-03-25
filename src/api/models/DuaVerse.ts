import { Entity, Column, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { DuaChapter } from "./DuaChapter";

@Entity("dua_verses")
export class DuaVerse {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'verse_number', nullable: false })
	public number: number;

	@Column({ name: 'arabic', nullable: false, type: 'text' })
	public arabic: string;

	@Column({ name: 'german', type: 'text' })
	public german: string;

	@Column({ name: 'transliteration', type: 'text' })
	public transliteration: string;

	@ManyToOne(() => DuaChapter, chapter => chapter.verses )
	public chapter: DuaChapter;

}
