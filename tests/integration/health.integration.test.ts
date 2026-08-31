import request from "supertest";

jest.mock("../../src/config/logger.config", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../../src/config/db.config", () => ({
    isDBConnected: jest.fn(),
}));

jest.mock("../../src/services/session.service", () => ({
    isSessionValid: jest.fn(),
    getAuthHeaders: jest.fn(),
    markSessionExpired: jest.fn(),
    markSessionValid: jest.fn(),
}));

import { isDBConnected } from "../../src/config/db.config";
import { isSessionValid } from "../../src/services/session.service";
import { serverConfig } from "../../src/config";
import { buildTestApp } from "./testApp";

const mockedIsDBConnected = isDBConnected as jest.MockedFunction<typeof isDBConnected>;
const mockedIsSessionValid = isSessionValid as jest.MockedFunction<typeof isSessionValid>;

describe("GET /health", () => {
    const app = buildTestApp();
    const originalLiAt = serverConfig.LINKEDIN_LI_AT;

    afterEach(() => {
        serverConfig.LINKEDIN_LI_AT = originalLiAt;
    });

    it("returns 200 with status ok and linkedinSession unknown when DB is up and no credentials are configured", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        serverConfig.LINKEDIN_LI_AT = "";

        const res = await request(app).get("/health");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", linkedinSession: "unknown" });
    });

    it("returns 503 with status error when the DB is down", async () => {
        mockedIsDBConnected.mockReturnValue(false);
        serverConfig.LINKEDIN_LI_AT = "";

        const res = await request(app).get("/health");

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: "error", linkedinSession: "unknown" });
    });

    it("reports linkedinSession valid/expired based on the session service once credentials are configured", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        serverConfig.LINKEDIN_LI_AT = "cookie-value";

        mockedIsSessionValid.mockReturnValue(true);
        let res = await request(app).get("/health");
        expect(res.body.linkedinSession).toBe("valid");

        mockedIsSessionValid.mockReturnValue(false);
        res = await request(app).get("/health");
        expect(res.body.linkedinSession).toBe("expired");
    });

    it("does not require an API key", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        const res = await request(app).get("/health");
        expect(res.status).not.toBe(401);
    });
});
