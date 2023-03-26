import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany } from "typeorm";
import { Quiz } from "./Quiz";
import { QuizQuestion } from "./QuizQuestion";

@Entity("quiz_categories")
export class QuizCategory {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'name', nullable: false })
	public name: string;

	@ManyToOne(() => Quiz, quiz => quiz.categories )
	public quiz: Quiz;

	@OneToMany(() => QuizQuestion, question => question.category )
	public questions: QuizQuestion[];
}
