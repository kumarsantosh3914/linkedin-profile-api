import { Request, Response } from "express";

jest.mock("../src/config/db.config", () => ({
    isDBConnected: jest.fn(),
}));

jest.mock("../src/services/session.service", () => ({
    isSessionValid: jest.fn(),
}));

import { isDBConnected } from "../src/config/db.config";
import { isSessionValid } from "../src/services/session.service";
import { serverConfig } from "../src/config";
import { healthHandler } from "../src/controllers/health.controller";

const mockedIsDBConnected = isDBConnected as jest.MockedFunction<typeof isDBConnected>;
const mockedIsSessionValid = isSessionValid as jest.MockedFunction<typeof isSessionValid>;

const buildRes = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe("healthHandler", () => {
    const originalLiAt = serverConfig.LINKEDIN_LI_AT;

    afterEach(() => {
        serverConfig.LINKEDIN_LI_AT = originalLiAt;
    });

    it("returns 200/ok when the DB is connected", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        serverConfig.LINKEDIN_LI_AT = "";

        const res = buildRes();
        await healthHandler({} as Request, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ status: "ok" })
        );
    });

    it("returns 503/error when the DB is not connected", async () => {
        mockedIsDBConnected.mockReturnValue(false);
        serverConfig.LINKEDIN_LI_AT = "";

        const res = buildRes();
        await healthHandler({} as Request, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ status: "error" })
        );
    });

    it("reports linkedinSession as unknown when no LinkedIn credentials are configured", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        serverConfig.LINKEDIN_LI_AT = "";

        const res = buildRes();
        await healthHandler({} as Request, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ linkedinSession: "unknown" })
        );
        expect(mockedIsSessionValid).not.toHaveBeenCalled();
    });

    it("reports linkedinSession as valid when credentials are configured and the session is valid", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        mockedIsSessionValid.mockReturnValue(true);
        serverConfig.LINKEDIN_LI_AT = "some-cookie-value";

        const res = buildRes();
        await healthHandler({} as Request, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ linkedinSession: "valid" })
        );
    });

    it("reports linkedinSession as expired when credentials are configured but the session is invalid", async () => {
        mockedIsDBConnected.mockReturnValue(true);
        mockedIsSessionValid.mockReturnValue(false);
        serverConfig.LINKEDIN_LI_AT = "some-cookie-value";

        const res = buildRes();
        await healthHandler({} as Request, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ linkedinSession: "expired" })
        );
    });
});
