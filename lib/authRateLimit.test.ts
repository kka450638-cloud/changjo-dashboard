import { describe, it, expect, beforeEach } from "vitest";
import {
  checkAuthRateLimit,
  recordAuthFailure,
  clearAuthFailures,
  __resetAuthRateLimitForTests,
} from "./authRateLimit";

describe("authRateLimit", () => {
  beforeEach(() => {
    __resetAuthRateLimitForTests();
  });

  it("초기에는 허용", () => {
    expect(checkAuthRateLimit("ip:1", 0)).toEqual({ allowed: true });
  });

  it("실패 누적 시 잠금", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      recordAuthFailure("ip:x", t0 + i * 1000);
    }
    const r = checkAuthRateLimit("ip:x", t0 + 10_000);
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("clearAuthFailures 후 허용", () => {
    recordAuthFailure("ip:y", Date.now());
    clearAuthFailures("ip:y");
    expect(checkAuthRateLimit("ip:y")).toEqual({ allowed: true });
  });
});
