import { env } from "./src/env";

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
	charset: env.db.charset,
	logging: env.db.logging,
	logger: 'advanced-console',
	entities: env.app.dirs.entities,
	migrations: env.app.dirs.migrations,
	conenctTimeout: 60000,
	acquireTimeout: 60000,
}