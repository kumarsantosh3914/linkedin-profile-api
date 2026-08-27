import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../utils/errors/app.error";

const LINKEDIN_PROFILE_URL_REGEX = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/;

/**
 * Rejects anything that isn't a linkedin.com/in/<slug> profile URL with 400,
 * before it ever reaches the scraper.
 */
export const validateLinkedInUrl = (req: Request, res: Response, next: NextFunction): void => {
    const { url } = req.body ?? {};

    if (typeof url !== "string" || !LINKEDIN_PROFILE_URL_REGEX.test(url)) {
        throw new BadRequestError("URL must be a linkedin.com/in/ profile link", "INVALID_URL");
    }

    next();
};
