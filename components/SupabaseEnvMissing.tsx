import Link from "next/link";

/**
 * NEXT_PUBLIC Supabase 변수가 없을 때 레이아웃에서 선제 표시 (throw 없이 안내)
 */
export default function SupabaseEnvMissing() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/50 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          설정 필요
        </p>
        <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Supabase 연결 정보가 없습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          대시보드는 Supabase 프로젝트 URL과 anon 키가 필요합니다. 프로젝트 루트에{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
            .env.local
          </code>{" "}
          파일을 만들고 아래 변수를 채운 뒤 개발 서버를 다시 시작하세요.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          {`NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
          예시는{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">.env.local.example</code>와
          README의 <strong>환경 변수</strong> 절을 참고하세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="https://supabase.com/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Supabase 대시보드 열기
          </Link>
        </div>
      </div>
    </div>
  );
}
