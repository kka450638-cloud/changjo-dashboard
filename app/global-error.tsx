"use client";

/**
 * 루트 레이아웃까지 포함한 오류 시 (반드시 html/body 포함)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-zinc-100 p-6 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-lg font-bold">앱을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          인터넷 연결을 확인한 뒤 다시 시도해 주세요. 환경 변수(.env.local)를 수정했다면
          개발 서버를 재시작했는지 확인하세요.
        </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            다시 시도
          </button>
          {process.env.NODE_ENV === "development" ? (
            <pre className="mt-4 max-h-40 overflow-auto rounded bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error.message}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  );
}
