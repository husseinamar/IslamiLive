import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DuaVerse } from './DuaVerse';

@Entity("duas")
export class DuaChapter {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'chapter_number', nullable: true })
	public number: number;

	@Column({ name: 'name' })
	public name: string;

	@Column({ name: 'german' })
	public german: string;

	@OneToMany(() => DuaVerse, verse => verse.chapter )
	public verses: DuaVerse[];

	public toJSON(): { id: number, number: number, name: string, german: string, verses: DuaVerse[] } {
		return {
			id: this.id,
			number: this.number,
			name: this.name,
			german: this.german,
			verses: [...(this.verses ?? [])],
		};
	}
}
