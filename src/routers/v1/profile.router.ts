import express from 'express';
import { postProfileHandler, getProfileStatusHandler } from '../../controllers/profile.controller';
import { profileRequestSchema } from '../../validators/profile.validators';
import { validateRequestBody } from '../../validators';
import { validateLinkedInUrl } from '../../middlewares/validateUrl.middleware';
import { requireApiKey, apiRateLimiter } from '../../middlewares/rateLimiter.middleware';

const profileRouter = express.Router();

profileRouter.post(
    '/',
    requireApiKey,
    apiRateLimiter,
    validateRequestBody(profileRequestSchema),
    validateLinkedInUrl,
    postProfileHandler
);

profileRouter.get('/status/:jobId', requireApiKey, getProfileStatusHandler);

export default profileRouter;
