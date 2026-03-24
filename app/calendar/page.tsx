"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDailyStoreTotals,
  getDailyTotals,
  type DailyStoreTotal,
  type DailyTotal,
} from "@/app/actions/sales";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyStoreTotals, setDailyStoreTotals] = useState<DailyStoreTotal[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);

  const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

  const { startDateStr, endDateStr, days, firstWeekday } = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const daysInMonth = last.getDate();
    return {
      startDateStr: formatDate(first),
      endDateStr: formatDate(last),
      days: daysInMonth,
      firstWeekday: first.getDay(), // 0: Sunday
    };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDailyTotals({ startDate: startDateStr, endDate: endDateStr })
      .then((data) => {
        if (!cancelled) setDailyTotals(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDateStr, endDateStr]);

  useEffect(() => {
    if (!selectedDate) {
      setDailyStoreTotals([]);
      return;
    }
    let cancelled = false;
    setStoreLoading(true);
    getDailyStoreTotals(selectedDate)
      .then((data) => {
        if (!cancelled) setDailyStoreTotals(data);
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const totalsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dailyTotals) {
      map.set(d.salesDate, d.totalQuantity);
    }
    return map;
  }, [dailyTotals]);

  function changeMonth(delta: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const todayStr = formatDate(new Date());

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
        <div>
          <h1 className="text-base font-semibold text-amber-600 dark:text-amber-400">
            창조통닭 일별 판매 캘린더
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            전체 DB 기준으로 날짜별 총 판매 마리 수와 지점별 판매를 확인합니다.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            지도 대시보드로 돌아가기
          </Link>
          <AdminLogoutButton className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700" />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
        <section className="w-full md:w-[55%]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                ◀
              </button>
              <span>{monthLabel}</span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                ▶
              </button>
            </div>
            {loading && (
              <span className="text-[11px] text-zinc-400">데이터 불러오는 중…</span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <div className="py-2 text-red-500 dark:text-red-400">일</div>
              <div className="py-2">월</div>
              <div className="py-2">화</div>
              <div className="py-2">수</div>
              <div className="py-2">목</div>
              <div className="py-2">금</div>
              <div className="py-2 text-blue-500 dark:text-blue-400">토</div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="h-20 bg-zinc-50 dark:bg-zinc-900"
                />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const day = i + 1;
                const date = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  day,
                );
                const dateStr = formatDate(date);
                const total = totalsByDate.get(dateStr) ?? 0;
                const isToday = dateStr === todayStr;
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex h-20 flex-col items-stretch border-0 bg-white p-1.5 text-left text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-zinc-900 ${
                      isSelected
                        ? "ring-2 ring-amber-500"
                        : "hover:bg-amber-50/60 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                          isToday
                            ? "bg-amber-500 font-semibold text-white"
                            : "text-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {day}
                      </span>
                      {total > 0 && (
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          {total.toLocaleString()}마리
                        </span>
                      )}
                    </div>
                    {total === 0 && (
                      <span className="mt-auto text-[9px] text-zinc-300 dark:text-zinc-700">
                        데이터 없음
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="w-full md:w-[45%]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {selectedDate ?? "날짜를 선택하세요"}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                선택한 날짜의 지점별 판매 마리 수 (전체 DB 기준)
              </p>
            </div>
            {selectedDate && (
              <Link
                href={`/?mapDate=${encodeURIComponent(selectedDate)}`}
                className="shrink-0 rounded-lg border border-amber-500 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
              >
                지도에서 이 날짜 보기
              </Link>
            )}
          </div>

          <div className="mt-3 h-[420px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {selectedDate == null ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                캘린더에서 날짜를 선택하면 일별 지점 목록이 표시됩니다.
              </div>
            ) : storeLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                지점별 데이터를 불러오는 중…
              </div>
            ) : dailyStoreTotals.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                해당 날짜의 판매 데이터가 없습니다.
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <table className="min-w-full border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 bg-zinc-50 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                        <th className="border-b border-zinc-200 px-3 py-2 text-left dark:border-zinc-800">
                          지점
                        </th>
                        <th className="border-b border-zinc-200 px-3 py-2 text-left dark:border-zinc-800">
                          지역
                        </th>
                      <th className="border-b border-zinc-200 px-3 py-2 text-right dark:border-zinc-800">
                        마리 수
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStoreTotals.map((row) => (
                      <tr key={row.storeId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                          {row.storeName}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          {row.region ?? "-"}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-right font-medium text-amber-700 dark:border-zinc-800 dark:text-amber-300">
                          {row.totalQuantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

