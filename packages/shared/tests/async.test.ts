import { describe, expect, it, vi } from "vitest";
import { deferred, raceAbort, sleep } from "../src/index.js";

describe("async", () => {
  it("creates externally resolvable promises", async () => {
    const value = deferred<string>();

    value.resolve("done");

    await expect(value.promise).resolves.toBe("done");
  });

  it("creates externally rejectable promises", async () => {
    const value = deferred<string>();
    const error = new Error("failed");

    value.reject(error);

    await expect(value.promise).rejects.toBe(error);
  });

  it("races operations against abort signals", async () => {
    const controller = new AbortController();
    const value = deferred<string>();
    const raced = raceAbort(value.promise, controller.signal);
    const error = new Error("aborted");

    controller.abort(error);

    await expect(raced).rejects.toBe(error);
  });

  it("returns operation values when not aborted", async () => {
    await expect(raceAbort(Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("sleeps for the requested duration", async () => {
    vi.useFakeTimers();

    const promise = sleep(100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("rejects sleep when aborted", async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const promise = sleep(100, controller.signal);
    const error = new Error("stop");
    const expectation = expect(promise).rejects.toBe(error);

    controller.abort(error);
    await vi.advanceTimersByTimeAsync(100);

    await expectation;
    vi.useRealTimers();
  });
});
