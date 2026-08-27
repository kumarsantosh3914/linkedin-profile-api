import mongoose from "mongoose";
import { serverConfig } from ".";
import logger from "./logger.config";

export const connectDB = async () => {
    try {
        await mongoose.connect(serverConfig.MONGODB_URI);
        logger.info("MongoDB connected");
    } catch (error) {
        logger.error("MongoDB connection error", { error });
        throw error;
    }
};

export const isDBConnected = () => mongoose.connection.readyState === 1;
