import request from "supertest";

jest.mock("../../src/config/logger.config", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { buildTestApp } from "./testApp";

const app = buildTestApp();

describe("GET /api/v1/ping", () => {
    it("returns pong for a valid body", async () => {
        const res = await request(app)
            .get("/api/v1/ping")
            .send({ message: "hello" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "pong" });
    });

    it("returns 400 when the body fails schema validation", async () => {
        const res = await request(app)
            .get("/api/v1/ping")
            .send({ message: "" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Invalid request body");
    });

    it("returns 400 when the message field is missing entirely", async () => {
        const res = await request(app).get("/api/v1/ping").send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("does not require an API key", async () => {
        const res = await request(app).get("/api/v1/ping").send({ message: "hi" });
        expect(res.status).not.toBe(401);
    });
});

describe("GET /api/v1/ping/helth", () => {
    it("returns 200 OK without any body validation", async () => {
        const res = await request(app).get("/api/v1/ping/helth");

        expect(res.status).toBe(200);
        expect(res.body).toBe("OK");
    });
});
