import { v4 as uuidv4 } from "uuid";
import { scrapeAndPersistProfile } from "./scraper.service";
import { NormalizedProfile } from "./normalizer.service";
import logger from "../config/logger.config";

export type JobStatus = "pending" | "success" | "failed";

export interface Job {
    id: string;
    status: JobStatus;
    linkedinUrl: string;
    data?: NormalizedProfile;
    errorMessage?: string;
}

const jobs = new Map<string, Job>();

/**
 * Kicks off a scrape in the background and returns a jobId immediately.
 * Poll getJob(jobId) for completion via GET /profile/status/:jobId.
 */
export const startScrapeJob = (linkedinUrl: string): string => {
    const jobId = uuidv4();
    jobs.set(jobId, { id: jobId, status: "pending", linkedinUrl });

    scrapeAndPersistProfile(linkedinUrl)
        .then((result) => {
            jobs.set(jobId, { id: jobId, status: "success", linkedinUrl, data: result.data });
        })
        .catch((error) => {
            logger.error("Scrape job failed", { jobId, error: error?.message });
            jobs.set(jobId, {
                id: jobId,
                status: "failed",
                linkedinUrl,
                errorMessage: error?.message ?? "Unknown scrape failure",
            });
        });

    return jobId;
};

export const getJob = (jobId: string): Job | undefined => jobs.get(jobId);
