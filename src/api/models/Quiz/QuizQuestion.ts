import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany } from 'typeorm';
import { QuizCategory } from './';
import { QuizAnswerPossibility } from './QuizAnswerPossibility';

export enum QuizQuestionType {
	FILL_IN_THE_BLANKS = 'fill_in_the_blanks',
	MULTIPLE_CHOICE = 'multiple_choice',
	SINGLE_CHOICE = 'single_choice',
}

@Entity("quiz_questions")
export class QuizQuestion {

	@PrimaryGeneratedColumn({ name: 'id' })
	public id: number;

	@Column({ name: 'type', type: 'enum', enum: QuizQuestionType, default: QuizQuestionType.MULTIPLE_CHOICE })
	public type: QuizQuestionType;

	@Column({ name: 'question' })
	public question: string;

	@Column({ name: 'num_correct_answers', })
	public numCorrectAnswers: number;

	@OneToMany(() => QuizAnswerPossibility, possibility => possibility.question, { eager: true })
	public answerPossibilities: QuizAnswerPossibility[];

	@ManyToOne(() => QuizCategory, category => category.questions )
	public category: QuizCategory;
}