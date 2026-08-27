import { Request, Response } from "express";
import { isDBConnected } from "../config/db.config";
import { isSessionValid } from "../services/session.service";
import { serverConfig } from "../config";

/**
 * GET /health — uptime check, includes a Mongo connection ping and the
 * last-known LinkedIn session validity (unknown until a scrape has run).
 */
export const healthHandler = async (req: Request, res: Response) => {
    const dbConnected = isDBConnected();
    const linkedinSession = !serverConfig.LINKEDIN_LI_AT
        ? "unknown"
        : isSessionValid()
        ? "valid"
        : "expired";

    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? "ok" : "error",
        linkedinSession,
    });
};
