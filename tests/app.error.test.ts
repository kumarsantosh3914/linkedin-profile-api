import {
    InternalServerError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    NotImplementedError,
    SessionExpiredError,
    ParseError,
} from "../src/utils/errors/app.error";

describe("app.error", () => {
    it("InternalServerError sets statusCode 500 and message", () => {
        const err = new InternalServerError("boom");
        expect(err.statusCode).toBe(500);
        expect(err.message).toBe("boom");
        expect(err.name).toBe("InternalServerError");
    });

    it("BadRequestError sets statusCode 400 and optional code", () => {
        const err = new BadRequestError("bad input", "INVALID_URL");
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe("bad input");
        expect(err.code).toBe("INVALID_URL");
    });

    it("BadRequestError leaves code undefined when omitted", () => {
        const err = new BadRequestError("bad input");
        expect(err.code).toBeUndefined();
    });

    it("NotFoundError sets statusCode 404", () => {
        expect(new NotFoundError("missing").statusCode).toBe(404);
    });

    it("UnauthorizedError sets statusCode 401", () => {
        expect(new UnauthorizedError("nope").statusCode).toBe(401);
    });

    it("ForbiddenError sets statusCode 403", () => {
        expect(new ForbiddenError("nope").statusCode).toBe(403);
    });

    it("ConflictError sets statusCode 409", () => {
        expect(new ConflictError("conflict").statusCode).toBe(409);
    });

    it("NotImplementedError sets statusCode 501", () => {
        expect(new NotImplementedError("tbd").statusCode).toBe(501);
    });

    it("SessionExpiredError defaults message and sets code SESSION_EXPIRED / 503", () => {
        const err = new SessionExpiredError();
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("SESSION_EXPIRED");
        expect(err.message).toBe("LinkedIn session needs refresh");
    });

    it("SessionExpiredError accepts a custom message", () => {
        const err = new SessionExpiredError("custom message");
        expect(err.message).toBe("custom message");
    });

    it("ParseError sets statusCode 500 and code PARSE_ERROR", () => {
        const err = new ParseError("could not parse");
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe("PARSE_ERROR");
        expect(err.message).toBe("could not parse");
    });
});
