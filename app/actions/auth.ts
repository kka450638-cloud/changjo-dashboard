"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminCodeErrorMessage,
  resolveExpectedAdminCode,
} from "@/lib/authPolicy";
import {
  checkAuthRateLimit,
  clearAuthFailures,
  recordAuthFailure,
} from "@/lib/authRateLimit";

export type AdminAuthState = { error: string } | null;

const COOKIE_NAME = "changjo_admin_ok";

async function getClientIpKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0]!.trim()}`;
  }
  const real = h.get("x-real-ip");
  if (real) return `ip:${real.trim()}`;
  return "ip:unknown";
}

/**
 * 관리자 번호 확인 후 httpOnly 쿠키 설정.
 * - 프로덕션: ADMIN_ACCESS_CODE 필수
 * - 개발: 미설정 시에만 기본값 0000
 * - 실패 시 IP 기준 rate limit (인스턴스 로컬)
 */
export async function verifyAdminPin(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const ipKey = await getClientIpKey();
  const limit = checkAuthRateLimit(ipKey);
  if (!limit.allowed) {
    return {
      error: `로그인 시도가 너무 많습니다. ${limit.retryAfterSec}초 후 다시 시도해 주세요.`,
    };
  }

  const pin = String(formData.get("pin") ?? "").trim();
  let redirectTo = String(formData.get("redirectTo") ?? "/").trim() || "/";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    redirectTo = "/";
  }

  const expected = resolveExpectedAdminCode(process.env, process.env.NODE_ENV);
  if (!expected.ok) {
    return {
      error: adminCodeErrorMessage(expected),
    };
  }

  if (pin !== expected.code) {
    recordAuthFailure(ipKey);
    return { error: "관리자 번호가 올바르지 않습니다." };
  }

  clearAuthFailures(ipKey);

  const jar = await cookies();
  jar.set(COOKIE_NAME, "1", {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(redirectTo);
}

export async function logoutAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/login");
}
