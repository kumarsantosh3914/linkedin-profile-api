import { Request, Response } from "express";

jest.mock("../src/config/logger.config", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../src/services/scraper.service", () => ({
    getCachedProfile: jest.fn(),
}));

jest.mock("../src/services/job.service", () => ({
    startScrapeJob: jest.fn(),
    getJob: jest.fn(),
}));

import { getCachedProfile } from "../src/services/scraper.service";
import { startScrapeJob, getJob } from "../src/services/job.service";
import { postProfileHandler, getProfileStatusHandler } from "../src/controllers/profile.controller";
import { IProfile } from "../src/models/profile.model";

const mockedGetCachedProfile = getCachedProfile as jest.MockedFunction<typeof getCachedProfile>;
const mockedStartScrapeJob = startScrapeJob as jest.MockedFunction<typeof startScrapeJob>;
const mockedGetJob = getJob as jest.MockedFunction<typeof getJob>;

const buildRes = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const buildReq = (overrides: Partial<Request> = {}) => ({ body: {}, params: {}, ...overrides } as Request);

describe("postProfileHandler", () => {
    it("returns 200 with normalized data on a cache hit", async () => {
        const fetchedAt = new Date("2026-01-01T00:00:00.000Z");
        const cached = {
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            name: "Jane Doe",
            headline: "Engineer",
            fetchedAt,
        } as unknown as IProfile;
        mockedGetCachedProfile.mockResolvedValue(cached as any);

        const req = buildReq({ body: { url: "https://www.linkedin.com/in/jane-doe" } });
        const res = buildRes();

        await postProfileHandler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: "success",
            cached: true,
            fetchedAt,
            data: expect.objectContaining({
                name: "Jane Doe",
                headline: "Engineer",
                sourceUrl: "https://www.linkedin.com/in/jane-doe",
                fetchedAt: fetchedAt.toISOString(),
                experience: [],
                education: [],
                skills: [],
                certifications: [],
                languages: [],
            }),
        });
        expect(mockedStartScrapeJob).not.toHaveBeenCalled();
    });

    it("defaults optional fields to empty values in the output schema", async () => {
        const cached = {
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
        } as unknown as IProfile;
        mockedGetCachedProfile.mockResolvedValue(cached as any);

        const req = buildReq({ body: { url: "https://www.linkedin.com/in/jane-doe" } });
        const res = buildRes();

        await postProfileHandler(req, res, jest.fn());

        const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
        expect(jsonArg.data).toEqual({
            name: "",
            headline: "",
            location: "",
            about: "",
            profileImageUrl: "",
            experience: [],
            education: [],
            skills: [],
            certifications: [],
            languages: [],
            sourceUrl: "https://www.linkedin.com/in/jane-doe",
            fetchedAt: "",
        });
    });

    it("starts a background scrape job and returns 202 on a cache miss", async () => {
        mockedGetCachedProfile.mockResolvedValue(null);
        mockedStartScrapeJob.mockReturnValue("job-123");

        const req = buildReq({ body: { url: "https://www.linkedin.com/in/jane-doe" } });
        const res = buildRes();

        await postProfileHandler(req, res, jest.fn());

        expect(mockedStartScrapeJob).toHaveBeenCalledWith("https://www.linkedin.com/in/jane-doe");
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json).toHaveBeenCalledWith({ status: "pending", jobId: "job-123" });
    });
});

describe("getProfileStatusHandler", () => {
    it("throws NotFoundError when the job doesn't exist", async () => {
        mockedGetJob.mockReturnValue(undefined);
        const req = buildReq({ params: { jobId: "unknown" } });
        const res = buildRes();

        await expect(getProfileStatusHandler(req, res, jest.fn())).rejects.toEqual(
            expect.objectContaining({ statusCode: 404, name: "NotFoundError" })
        );
    });

    it("returns success with data when the job succeeded", async () => {
        mockedGetJob.mockReturnValue({
            id: "job-1",
            status: "success",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            data: { name: "Jane Doe" } as any,
        });
        const req = buildReq({ params: { jobId: "job-1" } });
        const res = buildRes();

        await getProfileStatusHandler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: "success", data: { name: "Jane Doe" } });
    });

    it("returns failed with the error message when the job failed", async () => {
        mockedGetJob.mockReturnValue({
            id: "job-1",
            status: "failed",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            errorMessage: "LinkedIn session needs refresh",
        });
        const req = buildReq({ params: { jobId: "job-1" } });
        const res = buildRes();

        await getProfileStatusHandler(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            status: "failed",
            data: null,
            message: "LinkedIn session needs refresh",
        });
    });

    it("returns pending with null data while the job is still running", async () => {
        mockedGetJob.mockReturnValue({
            id: "job-1",
            status: "pending",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
        });
        const req = buildReq({ params: { jobId: "job-1" } });
        const res = buildRes();

        await getProfileStatusHandler(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({ status: "pending", data: null });
    });
});
