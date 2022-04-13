import * as dotenv from 'dotenv';
import * as path from 'path';

import {
    getOsEnv, getOsEnvOptional, getOsPath, getOsPaths, normalizePort, toBool, toNumber
} from './lib/env';

dotenv.config(
    {
        path: path.join(process.cwd(), `.env`),
    }
);

export const env = {
    node: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    isDevelopment: process.env.NODE_ENV === 'development',
    isStaging: process.env.NODE_ENV === 'qa',
    app: {
        name: getOsEnv('APP_NAME'),
        host: getOsEnv('APP_HOST'),
        publicHost: getOsEnv('APP_PUBLIC_HOST'),
        schema: getOsEnv('APP_SCHEMA'),
        routePrefix: getOsEnv('APP_ROUTE_PREFIX'),
        port: normalizePort(process.env.PORT || getOsEnv('APP_PORT')),
        banner: toBool(getOsEnv('APP_BANNER')),
        dirs: {
            migrations: getOsPaths('TYPEORM_MIGRATIONS'),
            migrationsDir: getOsPath('TYPEORM_MIGRATIONS_DIR'),
            entities: getOsPaths('TYPEORM_ENTITIES'),
            entitiesDir: getOsPath('TYPEORM_ENTITIES_DIR'),
            controllers: getOsPaths('CONTROLLERS'),
            middlewares: getOsPaths('MIDDLEWARES'),
            interceptors: getOsPaths('INTERCEPTORS'),
            subscribers: getOsPaths('SUBSCRIBERS'),
            resolvers: getOsPaths('RESOLVERS'),
        },
    },
    log: {
        level: getOsEnv('LOG_LEVEL'),
        json: toBool(getOsEnvOptional('LOG_JSON')),
        output: getOsEnv('LOG_OUTPUT'),
    },
    db: {
        type: getOsEnv('TYPEORM_CONNECTION'),
        host: getOsEnvOptional('TYPEORM_HOST'),
        host_ro: getOsEnvOptional('TYPEORM_HOST_RO'),
        port: toNumber(getOsEnvOptional('TYPEORM_PORT')),
        username: getOsEnvOptional('TYPEORM_USERNAME'),
        password: getOsEnvOptional('TYPEORM_PASSWORD'),
        database: getOsEnv('TYPEORM_DATABASE'),
        synchronize: toBool(getOsEnvOptional('TYPEORM_SYNCHRONIZE')),
        logging: toBool(getOsEnv('TYPEORM_LOGGING')),
        charset: getOsEnv('TYPEORM_DRIVER_CHARSET'),
    },
    cache: {
        enabled: toBool(getOsEnv('CACHE_ENABLED')),
    },
    baseUrl: getOsEnv('APP_SCHEMA') + '://' + getOsEnv('APP_HOST') + (getOsEnv('APP_PORT') ? ':' + getOsEnv('APP_PORT') : '') + getOsEnv('APP_ROUTE_PREFIX'),
    // mail: {
    //     SERVICE: getOsEnv('MAIL_DRIVER'),
    //     HOST: getOsEnv('MAIL_HOST'),
    //     PORT: getOsEnv('MAIL_PORT'),
    //     SECURE: getOsEnv('MAIL_SECURE'),
    //     FROM: getOsEnv('MAIL_FROM'),
    //     REPLY_TO: getOsEnv('MAIL_REPLY_TO'),
    //     AUTH: {
    //         user: getOsEnv('MAIL_USERNAME'),
    //         pass: getOsEnv('MAIL_PASSWORD'),
    //     },
    // }
}

// export const mail = {
//     SERVICE: getOsEnv('MAIL_DRIVER'),
//     HOST: getOsEnv('MAIL_HOST'),
//     PORT: getOsEnv('MAIL_PORT'),
//     SECURE: getOsEnv('MAIL_SECURE'),
//     FROM: getOsEnv('MAIL_FROM'),
//     REPLY_TO: getOsEnv('MAIL_REPLY_TO'),
//     AUTH: {
//         user: getOsEnv('MAIL_USERNAME'),
//         pass: getOsEnv('MAIL_PASSWORD'),
//     },
// };