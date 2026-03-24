"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminAuthState = { error: string } | null;

const COOKIE_NAME = "changjo_admin_ok";

/**
 * 관리자 번호 확인 후 httpOnly 쿠키 설정.
 * `ADMIN_ACCESS_CODE` 미설정 시 기본값 `0000` (로컬·테스트용, README 참고)
 */
export async function verifyAdminPin(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const pin = String(formData.get("pin") ?? "").trim();
  let redirectTo = String(formData.get("redirectTo") ?? "/").trim() || "/";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    redirectTo = "/";
  }

  const expected = (process.env.ADMIN_ACCESS_CODE ?? "0000").trim();
  if (!expected) {
    return { error: "서버에 관리자 번호가 설정되지 않았습니다. ADMIN_ACCESS_CODE를 확인하세요." };
  }

  if (pin !== expected) {
    return { error: "관리자 번호가 올바르지 않습니다." };
  }

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
