"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  GENERIC_ERROR_HINT_KO,
  RETRY_HINT_KO,
  isSupabaseConfigMessage,
  looksLikeNetworkOrTimeoutError,
} from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * 라우트 세그먼트 런타임 오류 폴백 (Next.js Error Boundary)
 */
export default function AppError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  const msg = typeof error?.message === "string" ? error.message : "";
  const isSupabaseConfigError = isSupabaseConfigMessage(msg);
  const suggestNetworkRetry =
    !isSupabaseConfigError && looksLikeNetworkOrTimeoutError(msg);

  if (isSupabaseConfigError) {
    const nowConfigured =
      typeof window !== "undefined" && isSupabaseConfigured();

    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-4 py-12 dark:bg-zinc-950">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/50 dark:bg-zinc-900">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Supabase 설정 오류
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            또는{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            가 없거나 잘못되었습니다. 프로젝트 루트의{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              .env.local
            </code>
            을 확인한 뒤{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              개발 서버를 재시작
            </strong>
            하세요.
          </p>
          <ul className="mt-4 list-inside list-disc text-xs text-zinc-500 dark:text-zinc-500">
            <li>변수 이름 오타·빈 값 여부 확인</li>
            <li>
              <code>.env.local.example</code> 복사 후 값만 채우기
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
            >
              다시 시도
            </button>
            <Link
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Supabase 콘솔
            </Link>
          </div>
          {nowConfigured ? (
            <p className="mt-4 text-xs text-emerald-600 dark:text-emerald-400">
              환경 변수가 감지되었습니다. 「다시 시도」를 눌러 주세요.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          문제가 발생했습니다
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {suggestNetworkRetry ? RETRY_HINT_KO : GENERIC_ERROR_HINT_KO}
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-red-50 p-2 text-left text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
