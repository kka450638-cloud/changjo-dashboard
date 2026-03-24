"use client";

import { logoutAdmin } from "@/app/actions/auth";

type Props = {
  className?: string;
};

/**
 * Server Action으로 쿠키 삭제 후 /login 으로 이동
 */
export default function AdminLogoutButton({ className }: Props) {
  return (
    <form action={logoutAdmin} className="inline">
      <button
        type="submit"
        className={
          className ??
          "rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }
        aria-label="로그아웃 후 관리자 로그인 화면으로"
      >
        로그아웃
      </button>
    </form>
  );
}
