import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { QuizCategory } from './QuizCategory';

@Entity("quizzes")
export class Quiz {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'name' })
	public name: string;

	@OneToMany(() => QuizCategory, category => category.quiz )
	public categories: QuizCategory[];
}
