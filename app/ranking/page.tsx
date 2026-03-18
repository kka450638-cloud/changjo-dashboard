"use client";

import { useEffect, useState, useTransition } from "react";
import { getStoreSummaries, type PeriodKey } from "@/app/actions/sales";
import type { StoreSalesSummary } from "@/lib/types/store";
import Link from "next/link";

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "yesterday", label: "전일" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "6m", label: "6개월" },
  { key: "all", label: "총" },
];

export default function RankingPage() {
  const [period, setPeriod] = useState<PeriodKey>("1w");
  const [summaries, setSummaries] = useState<StoreSalesSummary[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      getStoreSummaries(period).then(setSummaries);
    });
  }, [period]);

  const sorted = [...summaries].sort(
    (a, b) => b.totalQuantity - a.totalQuantity,
  );
  const top10 = sorted.slice(0, 10);
  const bottom10 = sorted.slice(-10);

  const byRegion = new Map<
    string,
    { region: string; storeCount: number; total: number }
  >();
  for (const s of summaries) {
    const region = s.store.region ?? "미지정";
    const sido = region.split(" ")[0] || region;
    const cur = byRegion.get(sido) ?? {
      region: sido,
      storeCount: 0,
      total: 0,
    };
    cur.storeCount += 1;
    cur.total += s.totalQuantity;
    byRegion.set(sido, cur);
  }
  const regionRows = Array.from(byRegion.values()).sort(
    (a, b) => b.total - a.total,
  );

  function intensityClass(total: number): string {
    if (total >= 10000) return "bg-amber-600/80 text-white";
    if (total >= 5000) return "bg-amber-500/70 text-white";
    if (total >= 2000) return "bg-amber-400/60 text-amber-950";
    if (total > 0) return "bg-amber-100 text-amber-800";
    return "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500";
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
        <div>
          <h1 className="text-base font-semibold text-amber-600 dark:text-amber-400">
            창조통닭 지점 랭킹 & 지역 히트맵
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            기간별 Top/Bottom 지점과 시·도별 지점 수/판매량을 한눈에 봅니다.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          지도 대시보드로 돌아가기
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
        <section className="w-full md:w-[55%] space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="mr-1 font-medium text-zinc-700 dark:text-zinc-200">
              기간
            </span>
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-full px-3 py-1 ${
                  period === key
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                } text-xs font-medium`}
              >
                {label}
              </button>
            ))}
            {isPending && (
              <span className="ml-2 text-[11px] text-zinc-400">
                로딩 중…
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Top 10 지점
                </h2>
                <span className="text-[11px] text-zinc-400">
                  총 {summaries.length}개 중
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {top10.map((s, idx) => (
                  <div
                    key={s.store.id}
                    className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 last:border-b-0 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
                          {s.store.name}
                        </div>
                        <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                          {s.store.region}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      {s.totalQuantity.toLocaleString()}마리
                    </div>
                  </div>
                ))}
                {top10.length === 0 && (
                  <div className="py-4 text-center text-[11px] text-zinc-400">
                    아직 등록된 지점/판매 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Bottom 10 지점
                </h2>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {bottom10.map((s) => (
                  <div
                    key={s.store.id}
                    className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 last:border-b-0 dark:border-zinc-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
                        {s.store.name}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                        {s.store.region}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-semibold text-red-700 dark:text-red-300">
                      {s.totalQuantity.toLocaleString()}마리
                    </div>
                  </div>
                ))}
                {bottom10.length === 0 && (
                  <div className="py-4 text-center text-[11px] text-zinc-400">
                    아직 등록된 지점/판매 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full md:w-[45%]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              시·도별 지점 수 vs 판매량 (히트맵)
            </h2>
          </div>
          <div className="max-h-[460px] overflow-hidden rounded-xl border border-zinc-200 bg-white text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="max-h-[460px] overflow-y-auto">
              <table className="min-w-full border-separate border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-zinc-50 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="border-b border-zinc-200 px-3 py-2 text-left dark:border-zinc-800">
                      시·도
                    </th>
                    <th className="border-b border-zinc-200 px-3 py-2 text-center dark:border-zinc-800">
                      지점 수
                    </th>
                    <th className="border-b border-zinc-200 px-3 py-2 text-right dark:border-zinc-800">
                      총 마리 수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((r) => (
                    <tr key={r.region} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                        {r.region}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-center text-[11px] text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                        {r.storeCount.toLocaleString()}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-right dark:border-zinc-800">
                        <span
                          className={`inline-flex min-w-[72px] items-center justify-end rounded-full px-2 py-0.5 text-[11px] font-semibold ${intensityClass(
                            r.total,
                          )}`}
                        >
                          {r.total.toLocaleString()}마리
                        </span>
                      </td>
                    </tr>
                  ))}
                  {regionRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-[11px] text-zinc-400"
                      >
                        아직 등록된 지점/판매 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

