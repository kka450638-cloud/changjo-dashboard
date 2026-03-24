import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** @see app/actions/auth.ts */
const ADMIN_COOKIE = "changjo_admin_ok";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login")) {
    if (request.cookies.get(ADMIN_COOKIE)?.value === "1") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const ok = request.cookies.get(ADMIN_COOKIE)?.value === "1";
  if (ok) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * 정적 자산·Next 내부 경로 제외
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
