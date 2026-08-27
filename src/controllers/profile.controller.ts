import { NextFunction, Request, Response } from "express";
import { getCachedProfile } from "../services/scraper.service";
import { startScrapeJob, getJob } from "../services/job.service";
import { IProfile } from "../models/profile.model";
import { NotFoundError } from "../utils/errors/app.error";
import logger from "../config/logger.config";

const toOutputSchema = (profile: IProfile) => ({
    name: profile.name ?? "",
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    about: profile.about ?? "",
    profileImageUrl: profile.profileImageUrl ?? "",
    experience: profile.experience ?? [],
    education: profile.education ?? [],
    skills: profile.skills ?? [],
    certifications: profile.certifications ?? [],
    languages: profile.languages ?? [],
    sourceUrl: profile.linkedinUrl,
    fetchedAt: profile.fetchedAt?.toISOString() ?? "",
});

/**
 * POST /api/v1/profile
 * Cache hit -> 200 with data. Cache miss -> kicks off a background scrape
 * and returns 202 with a jobId to poll.
 */
export const postProfileHandler = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { url } = req.body as { url: string };

    const cached = await getCachedProfile(url);
    if (cached) {
        logger.info("Profile cache hit", { url });
        return res.status(200).json({
            status: "success",
            cached: true,
            fetchedAt: cached.fetchedAt,
            data: toOutputSchema(cached),
        });
    }

    const jobId = startScrapeJob(url);
    logger.info("Profile cache miss, scrape job started", { url, jobId });
    return res.status(202).json({ status: "pending", jobId });
};

/**
 * GET /api/v1/profile/status/:jobId
 */
export const getProfileStatusHandler = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { jobId } = req.params;
    const job = getJob(jobId);

    if (!job) {
        throw new NotFoundError("No job found for this jobId");
    }

    if (job.status === "success") {
        return res.status(200).json({ status: "success", data: job.data });
    }

    if (job.status === "failed") {
        return res.status(200).json({ status: "failed", data: null, message: job.errorMessage });
    }

    return res.status(200).json({ status: "pending", data: null });
};
