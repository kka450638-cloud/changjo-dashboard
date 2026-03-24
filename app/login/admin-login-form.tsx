"use client";

import { useActionState } from "react";
import { verifyAdminPin, type AdminAuthState } from "@/app/actions/auth";

type Props = {
  redirectTo: string;
};

export default function AdminLoginForm({ redirectTo }: Props) {
  const [state, formAction, pending] = useActionState<
    AdminAuthState,
    FormData
  >(verifyAdminPin, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div>
        <label
          htmlFor="admin-pin"
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          관리자 번호
        </label>
        <input
          id="admin-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="4자리"
          maxLength={32}
          required
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 px-3 text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "admin-pin-error" : "admin-pin-hint"}
        />
        <p id="admin-pin-hint" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          <strong className="text-zinc-700 dark:text-zinc-300">테스트 기본값:</strong> 번호{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-[11px] dark:bg-zinc-700">
            0000
          </code>
          &nbsp;· 운영 시에는 반드시 <code className="text-[11px]">.env</code>의{" "}
          <code className="text-[11px]">ADMIN_ACCESS_CODE</code>를 변경하세요.
        </p>
        {state?.error ? (
          <p
            id="admin-pin-error"
            className="mt-2 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-zinc-900"
        aria-label="관리자 번호로 로그인"
      >
        {pending ? "확인 중…" : "입장"}
      </button>
    </form>
  );
}
