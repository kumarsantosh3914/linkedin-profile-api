import { Profile } from "../models/profile.model";
import { RequestLog } from "../models/requestLog.model";
import { fetchLinkedInResource } from "./linkedinClient.service";
import { normalizeProfile, NormalizedProfile } from "./normalizer.service";
import { linkedinThrottle } from "../utils/throttle";
import { serverConfig } from "../config";
import { SessionExpiredError } from "../utils/errors/app.error";
import logger from "../config/logger.config";

export interface ScrapeResult {
    cached: boolean;
    fetchedAt: Date;
    data: NormalizedProfile;
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

const PROFILE_DECORATION_ID = "com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93";

const publicIdFromUrl = (linkedinUrl: string): string => {
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match ? match[1] : linkedinUrl;
};

const profileFetchPath = (publicId: string): string => {
    const params = new URLSearchParams({
        q: "memberIdentity",
        memberIdentity: publicId,
        decorationId: PROFILE_DECORATION_ID,
    });
    return `/voyager/api/identity/dash/profiles?${params.toString()}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns a cached, non-expired Profile document for this URL, if any.
 */
export const getCachedProfile = async (linkedinUrl: string) => {
    return Profile.findOne({ linkedinUrl, expiresAt: { $gt: new Date() } });
};

/**
 * Orchestrates: throttle -> LinkedIn client -> normalize -> upsert.
 * Retries transient failures (timeout, 429) with backoff; never retries
 * auth failures (SessionExpiredError propagates immediately).
 */
export const scrapeAndPersistProfile = async (linkedinUrl: string): Promise<ScrapeResult> => {
    if (!linkedinThrottle.tryAcquire()) {
        const waitMs = linkedinThrottle.msUntilNextSlot();
        logger.info("LinkedIn throttle engaged, waiting before scrape", { waitMs });
        await sleep(waitMs);
    }

    const publicId = publicIdFromUrl(linkedinUrl);
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await fetchLinkedInResource(profileFetchPath(publicId));
            const normalized = normalizeProfile(raw, linkedinUrl);

            const fetchedAt = new Date();
            const expiresAt = new Date(fetchedAt.getTime() + serverConfig.CACHE_TTL_HOURS * 60 * 60 * 1000);

            await Profile.findOneAndUpdate(
                { linkedinUrl },
                { ...normalized, linkedinUrl, rawJson: raw, fetchedAt, expiresAt },
                { upsert: true, new: true }
            );
            await RequestLog.create({ linkedinUrl, status: "success" });

            return { cached: false, fetchedAt, data: normalized };
        } catch (error) {
            lastError = error;

            if (error instanceof SessionExpiredError) {
                await RequestLog.create({ linkedinUrl, status: "failed", errorMessage: error.message });
                throw error;
            }

            const status = (error as any)?.response?.status;
            const isTransient = status === 429 || (error as any)?.code === "ECONNABORTED";
            if (!isTransient || attempt === MAX_RETRIES) break;

            await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
    }

    const message = lastError instanceof Error ? lastError.message : "Unknown scrape failure";
    await RequestLog.create({ linkedinUrl, status: "failed", errorMessage: message });
    throw lastError;
};
