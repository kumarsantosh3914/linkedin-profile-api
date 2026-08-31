import { Request, Response } from "express";
import { appErrorHandler, genericErrorHandler } from "../src/middlewares/error.middleware";
import { BadRequestError, InternalServerError } from "../src/utils/errors/app.error";

const buildRes = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe("appErrorHandler", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("responds with the error's statusCode, code, and message", () => {
        const res = buildRes();
        const err = new BadRequestError("bad input", "INVALID_URL");

        appErrorHandler(err, {} as Request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            status: "error",
            code: "INVALID_URL",
            message: "bad input",
        });
    });

    it("falls back to err.name when code is absent", () => {
        const res = buildRes();
        const err = new InternalServerError("boom");

        appErrorHandler(err, {} as Request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: "error",
            code: "InternalServerError",
            message: "boom",
        });
    });
});

describe("genericErrorHandler", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("responds with the error's statusCode when present", () => {
        const res = buildRes();
        const err = new BadRequestError("bad input", "INVALID_URL");

        genericErrorHandler(err, {} as Request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            status: "error",
            code: "INVALID_URL",
            message: "bad input",
        });
    });

    it("defaults to statusCode 500 and INTERNAL_ERROR for a bare error", () => {
        const res = buildRes();
        const err = { message: undefined } as any;

        genericErrorHandler(err, {} as Request, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: "error",
            code: "INTERNAL_ERROR",
            message: "Something went wrong",
        });
    });
});
