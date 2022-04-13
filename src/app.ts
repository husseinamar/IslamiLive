import 'reflect-metadata';
import { env } from "./env";
import * as express from 'express';
import { typeormLoader } from './loaders/typeormLoader';

import * as http from 'http';
import * as lusca from 'lusca';
import * as bodyParser from 'body-parser';
import * as utils from './api/utils/utils';
import * as routing_controllers from 'routing-controllers';

const db_con = typeormLoader();

const app = express();
app.use((req, res, next) => {
	const key_ = 'req_id';
	req[key_] = utils.setRequestId();
	next();
});

app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.json({ limit: '200mb' }));
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));

const expressApp = routing_controllers.createExpressServer({
	cors: true,
	classTransformer: true,
	routePrefix: env.app.routePrefix,
	defaultErrorHandler: true,
	
	controllers: env.app.dirs.controllers,
	middlewares: env.app.dirs.middlewares,
	interceptors: env.app.dirs.interceptors,
});

expressApp.listen(env.app.port, () => {
    console.log('Server started at port: ' + env.app.port);
});