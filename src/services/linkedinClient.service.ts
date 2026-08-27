import axios, { AxiosInstance } from "axios";
import { getAuthHeaders, markSessionExpired, markSessionValid } from "./session.service";
import { SessionExpiredError } from "../utils/errors/app.error";
import logger from "../config/logger.config";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const client: AxiosInstance = axios.create({
    baseURL: "https://www.linkedin.com",
    timeout: 10_000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 300,
});

client.interceptors.request.use((config) => {
    config.headers.set("User-Agent", USER_AGENT);
    config.headers.set("x-restli-protocol-version", "2.0.0");
    config.headers.set("x-li-lang", "en_US");
    config.headers.set("accept", "application/vnd.linkedin.normalized+json+2.1");
    const authHeaders = getAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => config.headers.set(key, value));
    return config;
});

client.interceptors.response.use(
    (response) => {
        markSessionValid();
        return response;
    },
    (error) => {
        const status = error?.response?.status;
        // Voyager API calls should return 2xx directly; any redirect here
        // (typically back to a login/checkpoint page, sometimes paired with
        // Set-Cookie headers that delete li_at) means the session is dead.
        const isRedirect = status >= 300 && status < 400;

        if (status === 401 || status === 403 || isRedirect) {
            markSessionExpired();
            logger.error("LinkedIn session rejected the request", { status });
            return Promise.reject(new SessionExpiredError());
        }

        return Promise.reject(error);
    }
);

/**
 * Low-level GET against a LinkedIn Voyager API path (e.g.
 * `/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={slug}&decorationId=...`).
 * Single place to update if LinkedIn's request shape changes.
 */
export const fetchLinkedInResource = async <T = unknown>(path: string): Promise<T> => {
    const response = await client.get(path);
    // LinkedIn's Content-Type (application/vnd.linkedin.normalized+json+2.1)
    // doesn't end in the exact "+json" suffix axios auto-parses on, so it
    // can arrive as a raw string here.
    const data = response.data;
    return (typeof data === "string" ? JSON.parse(data) : data) as T;
};
