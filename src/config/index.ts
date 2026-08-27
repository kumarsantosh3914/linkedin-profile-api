import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number;
    NODE_ENV: string;
    MONGODB_URI: string;
    REDIS_URL: string;
    LINKEDIN_LI_AT: string;
    LINKEDIN_JSESSIONID: string;
    CACHE_TTL_HOURS: number;
    LINKEDIN_MAX_REQUESTS_PER_MIN: number;
    API_KEY: string;
}

function loadEnv() {
    dotenv.config();
    console.log('Environment variables loaded from .env file');
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: String(process.env.MONGODB_URI),
    REDIS_URL: String(process.env.REDIS_URL),
    LINKEDIN_LI_AT: String(process.env.LINKEDIN_LI_AT),
    LINKEDIN_JSESSIONID: String(process.env.LINKEDIN_JSESSIONID),
    CACHE_TTL_HOURS: Number(process.env.CACHE_TTL_HOURS) || 24,
    LINKEDIN_MAX_REQUESTS_PER_MIN: Number(process.env.LINKEDIN_MAX_REQUESTS_PER_MIN) || 5,
    API_KEY: String(process.env.API_KEY),
}