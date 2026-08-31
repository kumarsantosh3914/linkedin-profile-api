import request from "supertest";
import { NormalizedProfile } from "../../src/services/normalizer.service";

jest.mock("../../src/config/logger.config", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// scraper.service is the network/DB boundary (LinkedIn HTTP + Mongo) — it's
// the one thing mocked here. Everything else (routers, auth, rate limiting,
// zod validation, URL validation, the controller, and the real in-memory
// job.service) runs for real, wired together exactly as in production.
jest.mock("../../src/services/scraper.service", () => ({
    getCachedProfile: jest.fn(),
    scrapeAndPersistProfile: jest.fn(),
}));

import { getCachedProfile, scrapeAndPersistProfile } from "../../src/services/scraper.service";
import { serverConfig } from "../../src/config";
import { buildTestApp } from "./testApp";

const mockedGetCachedProfile = getCachedProfile as jest.MockedFunction<typeof getCachedProfile>;
const mockedScrape = scrapeAndPersistProfile as jest.MockedFunction<typeof scrapeAndPersistProfile>;

const app = buildTestApp();
const API_KEY = "test-api-key";
const VALID_URL = "https://www.linkedin.com/in/jane-doe";

const sampleProfile: NormalizedProfile = {
    name: "Jane Doe",
    headline: "Software Engineer",
    location: "San Francisco, California",
    about: "Building things.",
    profileImageUrl: "",
    experience: [],
    education: [],
    skills: ["TypeScript"],
    certifications: [],
    languages: [],
    sourceUrl: VALID_URL,
    fetchedAt: new Date().toISOString(),
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("POST /api/v1/profile", () => {
    const originalApiKey = serverConfig.API_KEY;

    beforeAll(() => {
        serverConfig.API_KEY = API_KEY;
    });

    afterAll(() => {
        serverConfig.API_KEY = originalApiKey;
    });

    it("returns 401 when no x-api-key header is sent", async () => {
        const res = await request(app).post("/api/v1/profile").send({ url: VALID_URL });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            status: "error",
            code: "UnauthorizedError",
            message: "Missing or invalid API key",
        });
        expect(mockedGetCachedProfile).not.toHaveBeenCalled();
    });

    it("returns 401 when the x-api-key header is wrong", async () => {
        const res = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", "wrong-key")
            .send({ url: VALID_URL });

        expect(res.status).toBe(401);
    });

    it("returns 400 from zod validation when url is missing", async () => {
        const res = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Invalid request body");
        expect(mockedGetCachedProfile).not.toHaveBeenCalled();
    });

    it("returns 400 from zod validation when url is not a well-formed URL", async () => {
        const res = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({ url: "not-a-url" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("returns 400 INVALID_URL when the url is well-formed but not a linkedin.com/in/ profile", async () => {
        const res = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({ url: "https://www.linkedin.com/company/acme" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            status: "error",
            code: "INVALID_URL",
            message: "URL must be a linkedin.com/in/ profile link",
        });
        expect(mockedGetCachedProfile).not.toHaveBeenCalled();
    });

    it("returns 200 with normalized data on a cache hit", async () => {
        const fetchedAt = new Date("2026-01-01T00:00:00.000Z");
        mockedGetCachedProfile.mockResolvedValue({
            linkedinUrl: VALID_URL,
            name: "Jane Doe",
            headline: "Software Engineer",
            fetchedAt,
        } as any);

        const res = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({ url: VALID_URL });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.cached).toBe(true);
        expect(res.body.data).toEqual(
            expect.objectContaining({ name: "Jane Doe", headline: "Software Engineer", sourceUrl: VALID_URL })
        );
        expect(mockedScrape).not.toHaveBeenCalled();
    });

    it("returns 202 with a jobId on a cache miss, and the job later resolves via the real job.service", async () => {
        mockedGetCachedProfile.mockResolvedValue(null);
        let resolveScrape!: (value: { cached: boolean; fetchedAt: Date; data: NormalizedProfile }) => void;
        mockedScrape.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveScrape = resolve;
                })
        );

        const postRes = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({ url: VALID_URL });

        expect(postRes.status).toBe(202);
        expect(postRes.body.status).toBe("pending");
        expect(typeof postRes.body.jobId).toBe("string");

        // The background scrape promise hasn't resolved yet, so the job is
        // still pending at this point.
        const pendingRes = await request(app)
            .get(`/api/v1/profile/status/${postRes.body.jobId}`)
            .set("x-api-key", API_KEY);
        expect(pendingRes.body).toEqual({ status: "pending", data: null });

        resolveScrape({ cached: false, fetchedAt: new Date(), data: sampleProfile });
        await flush();

        const successRes = await request(app)
            .get(`/api/v1/profile/status/${postRes.body.jobId}`)
            .set("x-api-key", API_KEY);
        expect(successRes.status).toBe(200);
        expect(successRes.body).toEqual({ status: "success", data: sampleProfile });
    });

    it("surfaces a scrape failure as a failed job status", async () => {
        mockedGetCachedProfile.mockResolvedValue(null);
        let rejectScrape!: (error: Error) => void;
        mockedScrape.mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectScrape = reject;
                })
        );

        const postRes = await request(app)
            .post("/api/v1/profile")
            .set("x-api-key", API_KEY)
            .send({ url: VALID_URL });
        expect(postRes.status).toBe(202);

        rejectScrape(new Error("LinkedIn session needs refresh"));
        await flush();

        const statusRes = await request(app)
            .get(`/api/v1/profile/status/${postRes.body.jobId}`)
            .set("x-api-key", API_KEY);

        expect(statusRes.status).toBe(200);
        expect(statusRes.body).toEqual({
            status: "failed",
            data: null,
            message: "LinkedIn session needs refresh",
        });
    });
});

describe("GET /api/v1/profile/status/:jobId", () => {
    beforeAll(() => {
        serverConfig.API_KEY = API_KEY;
    });

    it("returns 401 without an API key", async () => {
        const res = await request(app).get("/api/v1/profile/status/some-id");
        expect(res.status).toBe(401);
    });

    it("returns 404 for an unknown jobId", async () => {
        const res = await request(app)
            .get("/api/v1/profile/status/does-not-exist")
            .set("x-api-key", API_KEY);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
            status: "error",
            code: "NotFoundError",
            message: "No job found for this jobId",
        });
    });
});
