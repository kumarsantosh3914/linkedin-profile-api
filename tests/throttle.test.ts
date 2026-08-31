describe("linkedinThrottle (SlidingWindowThrottle)", () => {
    const MAX_REQUESTS = 3;

    const loadThrottle = () => {
        let mod!: typeof import("../src/utils/throttle");
        jest.isolateModules(() => {
            jest.doMock("../src/config", () => ({
                serverConfig: { LINKEDIN_MAX_REQUESTS_PER_MIN: MAX_REQUESTS },
            }));
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            mod = require("../src/utils/throttle");
        });
        return mod.linkedinThrottle;
    };

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("allows requests up to the configured limit within the window", () => {
        const throttle = loadThrottle();

        expect(throttle.tryAcquire()).toBe(true);
        expect(throttle.tryAcquire()).toBe(true);
        expect(throttle.tryAcquire()).toBe(true);
    });

    it("rejects a request once the limit is reached within the window", () => {
        const throttle = loadThrottle();

        for (let i = 0; i < MAX_REQUESTS; i++) {
            expect(throttle.tryAcquire()).toBe(true);
        }
        expect(throttle.tryAcquire()).toBe(false);
    });

    it("frees up a slot once the oldest timestamp ages out of the window", () => {
        const throttle = loadThrottle();

        for (let i = 0; i < MAX_REQUESTS; i++) {
            throttle.tryAcquire();
        }
        expect(throttle.tryAcquire()).toBe(false);

        jest.advanceTimersByTime(60_001);

        expect(throttle.tryAcquire()).toBe(true);
    });

    it("msUntilNextSlot returns 0 when no requests have been made", () => {
        const throttle = loadThrottle();
        expect(throttle.msUntilNextSlot()).toBe(0);
    });

    it("msUntilNextSlot counts down from the oldest recorded timestamp, even while under the limit", () => {
        const throttle = loadThrottle();
        throttle.tryAcquire();
        expect(throttle.msUntilNextSlot()).toBe(60_000);
    });

    it("msUntilNextSlot reports remaining time until the oldest timestamp expires", () => {
        const throttle = loadThrottle();

        for (let i = 0; i < MAX_REQUESTS; i++) {
            throttle.tryAcquire();
        }

        jest.advanceTimersByTime(20_000);

        expect(throttle.msUntilNextSlot()).toBe(40_000);
    });
});
