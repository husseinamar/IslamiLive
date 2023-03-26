import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { QuizQuestion } from './';

@Entity("quiz_possible_answers")
export class QuizAnswerPossibility {
	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'value' })
	value: string;

	@Column({ name: 'is_correct', type: 'boolean', default: false })
	isCorrect: boolean;

	@ManyToOne(() => QuizQuestion, question => question.answerPossibilities, { cascade: true, onDelete: "CASCADE" })
	question: QuizQuestion;
}
