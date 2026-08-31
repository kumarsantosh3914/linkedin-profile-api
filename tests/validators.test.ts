import { profileRequestSchema } from "../src/validators/profile.validators";
import { pingSchema } from "../src/validators/ping.validators";

describe("profileRequestSchema", () => {
    it("accepts a valid url string", () => {
        const result = profileRequestSchema.safeParse({ url: "https://www.linkedin.com/in/jane-doe" });
        expect(result.success).toBe(true);
    });

    it("rejects a missing url field", () => {
        const result = profileRequestSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it("rejects a non-url string", () => {
        const result = profileRequestSchema.safeParse({ url: "not-a-url" });
        expect(result.success).toBe(false);
    });

    it("rejects a non-string url", () => {
        const result = profileRequestSchema.safeParse({ url: 123 });
        expect(result.success).toBe(false);
    });
});

describe("pingSchema", () => {
    it("accepts a non-empty message", () => {
        const result = pingSchema.safeParse({ message: "hello" });
        expect(result.success).toBe(true);
    });

    it("rejects an empty message", () => {
        const result = pingSchema.safeParse({ message: "" });
        expect(result.success).toBe(false);
    });

    it("rejects a missing message field", () => {
        const result = pingSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
