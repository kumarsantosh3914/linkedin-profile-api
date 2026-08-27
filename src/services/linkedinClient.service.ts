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
    validateStatus: (status) => status < 400,
});

client.interceptors.request.use((config) => {
    config.headers.set("User-Agent", USER_AGENT);
    config.headers.set("x-restli-protocol-version", "2.0.0");
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
        const location = error?.response?.headers?.location as string | undefined;
        const redirectedToLogin = typeof location === "string" && location.includes("/login");

        if (status === 401 || status === 403 || redirectedToLogin) {
            markSessionExpired();
            logger.error("LinkedIn session rejected the request", { status });
            return Promise.reject(new SessionExpiredError());
        }

        return Promise.reject(error);
    }
);

/**
 * Low-level GET against a LinkedIn Voyager API path (e.g.
 * `/voyager/api/identity/profiles/{publicId}/profileView`).
 * Single place to update if LinkedIn's request shape changes.
 */
export const fetchLinkedInResource = async <T = unknown>(path: string): Promise<T> => {
    const response = await client.get<T>(path);
    return response.data;
};
