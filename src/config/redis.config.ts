import Redis from "ioredis";
import { serverConfig } from ".";
import logger from "./logger.config";

const redisClient = new Redis(serverConfig.REDIS_URL);

redisClient.on("connect", () => {
    logger.info("Redis client connected");
});

redisClient.on("error", (error) => {
    logger.error("Redis client error", { error });
});

export default redisClient;
