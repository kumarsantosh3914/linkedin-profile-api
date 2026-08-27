import { z } from 'zod';

/**
 * Zod schema for validating the request body of POST /api/v1/profile.
 * The URL shape itself (linkedin.com/in/<slug>) is enforced separately
 * by the validateUrl middleware; this just ensures the field is present.
 */
export const profileRequestSchema = z.object({
    url: z.string().url(),
});
