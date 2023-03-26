import 'reflect-metadata';
import { env } from "./env";
import express, { Request, Response } from 'express';
import { typeormLoader } from './loaders/typeormLoader';

import path from 'path';

import http from 'http';
import lusca from 'lusca';
import cors from 'cors';
import * as utils from './api/utils/utils';
import { useExpressServer } from 'routing-controllers';
import { Quiz, QuizCategory } from './api/models/Quiz';
import axios from 'axios';

const db_con = typeormLoader();

const app = express();

app.use((req, res, next) => {
	const key_ = 'req_id';
	req[key_] = utils.setRequestId();
	next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.static(path.join(__dirname, '../public')));

app.use(express.urlencoded({ limit: '3000mb', extended: true }));
app.use(express.json({ limit: '3000mb' }));

// app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xframe('ALLOWALL'));
app.use(lusca.xssProtection(true));

app.get('/', async (req: Request, res: Response): Promise<void> => {
	res.setHeader('Content-Type', 'text/html');
	res.redirect('/quiz');
	return;
});

app.get('/quiz', async (req: Request, res: Response): Promise<void> => {
	res.setHeader('Content-Type', 'text/html');
	res.render('Quiz/index');
	return;
});

app.get('/quiz/:id/rendered', async (req: Request, res: Response): Promise<void> => {
	
	const { id } = req.params;

	if ( !id || Number.isNaN(parseInt(id)) ) {
		console.log('Was not a valid number:', id);
		res.redirect('/404');
		return;
	}

	let quiz: Quiz;
	try {
		const fetchResponse = await axios(`${env.baseUrl}/quiz/${id}/`);
		
		const jsonResponse = await fetchResponse?.data as { status: number, message: string, data: Quiz };
		console.log(jsonResponse)

		quiz = jsonResponse?.data;

		if (!quiz) {
			throw new Error(`Could not find quiz with id ${id}`);
		}

	} catch (error) {
		console.log('Error fetching category:', error);
		res.redirect('/500');
		return;
	}
	
	console.log('Was a valid number:', id);
	res.setHeader('Content-Type', 'text/html');
	res.render('Quiz/pages/rendered-quiz', { quizId: id, quizJSON: JSON.stringify(quiz) });
	return;
});

app.get('/quiz/:id', async (req: Request, res: Response): Promise<void> => {
	
	const { id } = req.params;
	console.log(parseInt(id));

	if ( !id || Number.isNaN(parseInt(id)) ) {
		console.log('Was not a valid number:', id);
		res.redirect('/404');
		return;
	}
	
	console.log('Was a valid number:', id);
	res.setHeader('Content-Type', 'text/html');
	res.render('Quiz/pages/quiz', { quizId: id });
	return;
});

app.get('/quiz/:quizId/category/:categoryId', async (req: Request, res: Response): Promise<void> => {
	
	const { quizId, categoryId } = req.params;
	console.log(parseInt(quizId));

	if ( !quizId || Number.isNaN(parseInt(quizId)) ) {
		console.log('QuizId Was not a valid number:', quizId);
		res.redirect('/404');
		return;
	}

	if ( !categoryId || Number.isNaN(parseInt(categoryId)) ) {
		console.log('CategoryId Was not a valid number:', categoryId);
		res.redirect('/404');
		return;
	}
	
	let category: QuizCategory;
	try {
		const fetchResponse = await axios(`${env.baseUrl}/quiz/${quizId}/category/${categoryId}`);
		
		const jsonResponse = await fetchResponse?.data as { status: number, message: string, data: QuizCategory };
		console.log(jsonResponse)

		category = jsonResponse?.data;

		if (!category) {
			throw new Error(`Could not find category with id ${categoryId}`);
		}

	} catch (error) {
		console.log('Error fetching category:', error);
		res.redirect('/500');
		return;
	}
	
	console.log('Was a valid number:', quizId, categoryId);
	res.setHeader('Content-Type', 'text/html');
	res.render('Quiz/pages/category', { quizId, category: category, categoryJSON: JSON.stringify(category) });
	// res.render('Quiz/pages/category', { quizId, category });
	return;
});

app.get('/404', async (req: Request, res: Response): Promise<void> => {
	res.setHeader('Content-Type', 'text/html');
	res.render('404');
	return;
});

app.get('/500', async (req: Request, res: Response): Promise<void> => {
	res.setHeader('Content-Type', 'text/html');
	res.render('500');
	return;
});

const expressApp = useExpressServer(app, {
	cors: true,
	classTransformer: true,
	routePrefix: env.app.routePrefix,
	defaultErrorHandler: true,
	
	controllers: env.app.dirs.controllers,
	middlewares: env.app.dirs.middlewares,
	interceptors: env.app.dirs.interceptors,
});

expressApp.listen(env.app.port, () => {
    console.log('Server started at: ' + env.baseUrl);
});