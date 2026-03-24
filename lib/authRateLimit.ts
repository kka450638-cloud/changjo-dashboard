/**
 * 로그인 실패 기반 in-memory rate limit (무차별 대입 완화)
 * 서버리스/다중 인스턴스에서는 인스턴스별로만 적용됨 — 운영 시 Redis 등 권장
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

type Bucket = { failures: number[] };

const store = new Map<string, Bucket>();

function prune(times: number[], now: number): number[] {
  return times.filter((t) => now - t < WINDOW_MS);
}

export type RateLimitCheck = { allowed: true } | { allowed: false; retryAfterSec: number };

export function checkAuthRateLimit(
  key: string,
  nowMs: number = Date.now(),
): RateLimitCheck {
  const bucket = store.get(key) ?? { failures: [] };
  const failures = prune(bucket.failures, nowMs);
  if (failures.length >= MAX_FAILURES) {
    const oldest = failures[0]!;
    const retryAfterSec = Math.ceil((WINDOW_MS - (nowMs - oldest)) / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { allowed: true };
}

export function recordAuthFailure(key: string, nowMs: number = Date.now()): void {
  const bucket = store.get(key) ?? { failures: [] };
  const failures = prune(bucket.failures, nowMs);
  failures.push(nowMs);
  store.set(key, { failures });
}

export function clearAuthFailures(key: string): void {
  store.delete(key);
}

/** 테스트용 스토어 초기화 */
export function __resetAuthRateLimitForTests(): void {
  store.clear();
}
