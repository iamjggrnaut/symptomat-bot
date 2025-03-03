import * as dotenv from 'dotenv';

dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;