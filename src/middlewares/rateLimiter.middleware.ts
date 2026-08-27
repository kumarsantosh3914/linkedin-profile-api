import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { serverConfig } from "../config";
import { UnauthorizedError } from "../utils/errors/app.error";

/**
 * Protects OUR api from being hammered by its own callers.
 * Independent of the LinkedIn-facing throttle in utils/throttle.ts.
 */
export const apiRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "error", code: "RATE_LIMITED", message: "Too many requests, slow down" },
});

/**
 * Simple auth for our own API consumers via the x-api-key header.
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers["x-api-key"];

    if (!serverConfig.API_KEY || apiKey !== serverConfig.API_KEY) {
        throw new UnauthorizedError("Missing or invalid API key");
    }

    next();
};
