import express, { Express } from "express";
import v1Router from "../../src/routers/v1/index.router";
import v2Router from "../../src/routers/v2/index.router";
import { appErrorHandler, genericErrorHandler } from "../../src/middlewares/error.middleware";
import { attachCorrelationIdMiddleware } from "../../src/middlewares/correlation.middleware";
import { healthHandler } from "../../src/controllers/health.controller";

/**
 * Mirrors the app wiring in src/server.ts (middleware order, routers,
 * error handlers) without the process-level side effects (app.listen,
 * connectDB, the redis client singleton) that make server.ts unsafe to
 * import directly in tests.
 */
export const buildTestApp = (): Express => {
    const app = express();

    app.use(express.json());
    app.use(attachCorrelationIdMiddleware);
    app.get("/health", healthHandler);
    app.use("/api/v1", v1Router);
    app.use("/api/v2", v2Router);

    app.use(appErrorHandler);
    app.use(genericErrorHandler);

    return app;
};
