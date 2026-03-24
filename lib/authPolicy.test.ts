import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveExpectedAdminCode } from "./authPolicy";

describe("resolveExpectedAdminCode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ADMIN_ACCESS_CODE가 있으면 그 값 사용", () => {
    const env = { ADMIN_ACCESS_CODE: "  secret99  " } as NodeJS.ProcessEnv;
    const r = resolveExpectedAdminCode(env, "production");
    expect(r).toEqual({ ok: true, code: "secret99" });
  });

  it("development에서 미설정이면 0000", () => {
    const env = {} as NodeJS.ProcessEnv;
    const r = resolveExpectedAdminCode(env, "development");
    expect(r).toEqual({ ok: true, code: "0000" });
  });

  it("production에서 미설정이면 거부", () => {
    const env = {} as NodeJS.ProcessEnv;
    const r = resolveExpectedAdminCode(env, "production");
    expect(r).toEqual({ ok: false, reason: "production_missing" });
  });

  it("test 환경에서 미설정이면 거부 (기본값 0000은 development 전용)", () => {
    const env = {} as NodeJS.ProcessEnv;
    const r = resolveExpectedAdminCode(env, "test");
    expect(r).toEqual({ ok: false, reason: "production_missing" });
  });
});
