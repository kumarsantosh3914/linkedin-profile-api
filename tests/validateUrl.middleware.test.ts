import { Request, Response, NextFunction } from "express";
import { validateLinkedInUrl } from "../src/middlewares/validateUrl.middleware";
import { BadRequestError } from "../src/utils/errors/app.error";

const buildReq = (body: unknown) => ({ body } as Request);
const buildRes = () => ({} as Response);

describe("validateLinkedInUrl", () => {
    let next: jest.MockedFunction<NextFunction>;

    beforeEach(() => {
        next = jest.fn();
    });

    it.each([
        "https://www.linkedin.com/in/jane-doe",
        "https://linkedin.com/in/jane-doe",
        "https://www.linkedin.com/in/jane-doe/",
        "https://www.linkedin.com/in/Jane_Doe-123",
    ])("calls next() for a valid profile url: %s", (url) => {
        validateLinkedInUrl(buildReq({ url }), buildRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    it.each([
        "https://www.linkedin.com/company/acme",
        "http://www.linkedin.com/in/jane-doe",
        "https://evil.com/linkedin.com/in/jane-doe",
        "not-a-url",
        "",
    ])("throws BadRequestError for an invalid url: %s", (url) => {
        expect(() => validateLinkedInUrl(buildReq({ url }), buildRes(), next)).toThrow(BadRequestError);
        expect(next).not.toHaveBeenCalled();
    });

    it("throws BadRequestError when url is not a string", () => {
        expect(() => validateLinkedInUrl(buildReq({ url: 123 }), buildRes(), next)).toThrow(BadRequestError);
    });

    it("throws BadRequestError when body is missing", () => {
        const req = { body: undefined } as Request;
        expect(() => validateLinkedInUrl(req, buildRes(), next)).toThrow(BadRequestError);
    });

    it("sets code INVALID_URL and statusCode 400 on the thrown error", () => {
        expect.assertions(3);
        try {
            validateLinkedInUrl(buildReq({ url: "invalid" }), buildRes(), next);
        } catch (err) {
            expect(err).toBeInstanceOf(BadRequestError);
            expect((err as BadRequestError).code).toBe("INVALID_URL");
            expect((err as BadRequestError).statusCode).toBe(400);
        }
    });
});
