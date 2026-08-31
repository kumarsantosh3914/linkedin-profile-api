import { Request, Response, NextFunction } from "express";
import { serverConfig } from "../src/config";
import { requireApiKey } from "../src/middlewares/rateLimiter.middleware";
import { UnauthorizedError } from "../src/utils/errors/app.error";

const buildReq = (headers: Record<string, string | undefined>) => ({ headers } as unknown as Request);
const buildRes = () => ({} as Response);

describe("requireApiKey", () => {
    const originalApiKey = serverConfig.API_KEY;
    let next: jest.MockedFunction<NextFunction>;

    beforeEach(() => {
        next = jest.fn();
    });

    afterEach(() => {
        serverConfig.API_KEY = originalApiKey;
    });

    it("calls next() when the x-api-key header matches the configured API key", () => {
        serverConfig.API_KEY = "secret-key";
        const req = buildReq({ "x-api-key": "secret-key" });

        requireApiKey(req, buildRes(), next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it("throws UnauthorizedError when the header is missing", () => {
        serverConfig.API_KEY = "secret-key";
        const req = buildReq({});

        expect(() => requireApiKey(req, buildRes(), next)).toThrow(UnauthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError when the header doesn't match", () => {
        serverConfig.API_KEY = "secret-key";
        const req = buildReq({ "x-api-key": "wrong-key" });

        expect(() => requireApiKey(req, buildRes(), next)).toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when no API_KEY is configured, even if the header is empty", () => {
        serverConfig.API_KEY = "";
        const req = buildReq({ "x-api-key": "" });

        expect(() => requireApiKey(req, buildRes(), next)).toThrow(UnauthorizedError);
    });
});
