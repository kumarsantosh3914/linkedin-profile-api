import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number;
    MONGODB_URI: string;
    REDIS_URL: string;
}

function loadEnv() {
    dotenv.config();
    console.log('Environment variables loaded from .env file');
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3000,
    MONGODB_URI: String(process.env.MONGODB_URI),
    REDIS_URL: String(process.env.REDIS_URL),
}