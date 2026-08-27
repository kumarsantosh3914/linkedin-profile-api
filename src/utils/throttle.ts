import { serverConfig } from "../config";

/**
 * Simple sliding-window limiter capping outbound requests/min to LinkedIn.
 * Applied inside scraperService, independent of our own public API's
 * rate limiter (which protects us from our own callers).
 */
class SlidingWindowThrottle {
    private timestamps: number[] = [];

    constructor(private readonly maxRequestsPerWindow: number, private readonly windowMs: number) {}

    /** Returns true if a request may proceed now, and records it if so. */
    tryAcquire(): boolean {
        const now = Date.now();
        this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

        if (this.timestamps.length >= this.maxRequestsPerWindow) {
            return false;
        }

        this.timestamps.push(now);
        return true;
    }

    /** Milliseconds until the next slot frees up, if currently throttled. */
    msUntilNextSlot(): number {
        if (this.timestamps.length === 0) return 0;
        const oldest = this.timestamps[0];
        return Math.max(0, this.windowMs - (Date.now() - oldest));
    }
}

export const linkedinThrottle = new SlidingWindowThrottle(
    serverConfig.LINKEDIN_MAX_REQUESTS_PER_MIN,
    60_000
);
