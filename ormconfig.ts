// import { DataSourceOptions } from "typeorm";
import { env } from "./src/env";

// export const config: DataSourceOptions = {
// 	name: 'default',
// 	type: 'mongodb',
// 	host: 'mongodb://islamilive.qk31ors.mongodb.net/islamilive',
// 	username: 'husseinammar',
// 	password: 'Q9lJWQY5HxM96BdQ',
// 	database: env.db.database,
// 	synchronize: env.db.synchronize,
// 	useNewUrlParser: true,
// 	migrationsRun: false,
// 	// charset: env.db.charset,
// 	logging: env.db.logging,
// 	logger: 'advanced-console',
// 	entities: env.app.dirs.entities,
// 	migrations: env.app.dirs.migrations,
// 	connectTimeoutMS: 60000,
// 	ssl: true,
// 	authSource: 'islamilive',
// };

export const config = {
	name: 'default',
	type: env.db.type,
	replication: {
		master: {
			host: env.db.host,
			port: env.db.port,
			username: env.db.username,
			password: env.db.password,
			database: env.db.database,
		},
	},
	synchronize: env.db.synchronize,
	migrationsRun: false,
	charset: env.db.charset,
	logging: env.db.logging,
	logger: 'advanced-console',
	entities: env.app.dirs.entities,
	migrations: env.app.dirs.migrations,
	conenctTimeout: 60000,
	acquireTimeout: 60000,
}