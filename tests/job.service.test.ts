import { NormalizedProfile } from "../src/services/normalizer.service";

jest.mock("../src/config/logger.config", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../src/services/scraper.service", () => ({
    scrapeAndPersistProfile: jest.fn(),
}));

import { scrapeAndPersistProfile } from "../src/services/scraper.service";
import { startScrapeJob, getJob } from "../src/services/job.service";

const mockedScrape = scrapeAndPersistProfile as jest.MockedFunction<typeof scrapeAndPersistProfile>;

const sampleProfile: NormalizedProfile = {
    name: "Jane Doe",
    headline: "Engineer",
    location: "",
    about: "",
    profileImageUrl: "",
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    sourceUrl: "https://www.linkedin.com/in/jane-doe",
    fetchedAt: new Date().toISOString(),
};

describe("job.service", () => {
    it("creates a job in pending state immediately", () => {
        mockedScrape.mockReturnValue(new Promise(() => {})); // never resolves

        const jobId = startScrapeJob("https://www.linkedin.com/in/jane-doe");
        const job = getJob(jobId);

        expect(job).toEqual({
            id: jobId,
            status: "pending",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
        });
    });

    it("transitions the job to success with data once the scrape resolves", async () => {
        mockedScrape.mockResolvedValue({ data: sampleProfile, cached: false } as any);

        const jobId = startScrapeJob("https://www.linkedin.com/in/jane-doe");
        await new Promise((resolve) => setImmediate(resolve));

        expect(getJob(jobId)).toEqual({
            id: jobId,
            status: "success",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            data: sampleProfile,
        });
    });

    it("transitions the job to failed with the error message once the scrape rejects", async () => {
        mockedScrape.mockRejectedValue(new Error("LinkedIn session needs refresh"));

        const jobId = startScrapeJob("https://www.linkedin.com/in/jane-doe");
        await new Promise((resolve) => setImmediate(resolve));

        expect(getJob(jobId)).toEqual({
            id: jobId,
            status: "failed",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            errorMessage: "LinkedIn session needs refresh",
        });
    });

    it("falls back to a default error message when the rejection has none", async () => {
        mockedScrape.mockRejectedValue({});

        const jobId = startScrapeJob("https://www.linkedin.com/in/jane-doe");
        await new Promise((resolve) => setImmediate(resolve));

        expect(getJob(jobId)?.errorMessage).toBe("Unknown scrape failure");
    });

    it("returns undefined for an unknown jobId", () => {
        expect(getJob("does-not-exist")).toBeUndefined();
    });
});
