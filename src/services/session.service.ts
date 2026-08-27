import { serverConfig } from "../config";

let sessionValid = true;

/**
 * Builds the cookie/csrf headers LinkedIn expects on every outbound request.
 * Never logs the underlying credential values.
 */
export const getAuthHeaders = (): Record<string, string> => {
    return {
        Cookie: `li_at=${serverConfig.LINKEDIN_LI_AT}; JSESSIONID="${serverConfig.LINKEDIN_JSESSIONID}"`,
        "csrf-token": serverConfig.LINKEDIN_JSESSIONID,
    };
};

export const isSessionValid = (): boolean => sessionValid;

/**
 * Flipped false by the linkedin client when it detects an auth failure
 * (non-2xx / redirect-to-login). Read by /health and the scraper service.
 */
export const markSessionExpired = (): void => {
    sessionValid = false;
};

export const markSessionValid = (): void => {
    sessionValid = true;
};
