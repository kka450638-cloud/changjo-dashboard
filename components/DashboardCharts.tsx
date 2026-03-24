"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorForRegionLabel, mapMarkerColorForRegion } from "@/lib/regionColors";

type Props = {
  trendRows: Record<string, string | number>[];
  trendKeys: string[];
  sigunguBars: { label: string; total: number }[];
  periodLabel: string;
  loading?: boolean;
  /** 차트 API 실패 시 */
  error?: string | null;
  onRetry?: () => void;
};

function ChartSkeleton() {
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">차트 데이터 불러오는 중</span>
      <div className="space-y-4">
        <div>
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-3 h-52 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div>
          <div className="h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-2 h-3 w-full max-w-sm animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-3 h-40 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardCharts({
  trendRows,
  trendKeys,
  sigunguBars,
  periodLabel,
  loading,
  error,
  onRetry,
}: Props) {
  const barData = [...sigunguBars]
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 16);

  if (loading) {
    return <ChartSkeleton />;
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm dark:border-red-900/50 dark:bg-red-950/30"
        role="alert"
      >
        <p className="font-medium text-red-800 dark:text-red-200">차트를 불러오지 못했습니다</p>
        <p className="mt-1 text-xs text-red-700/90 dark:text-red-300/90">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-red-600 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-500 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-zinc-800"
            aria-label="차트 데이터 다시 불러오기"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  const hasTrend = trendRows.length > 0 && trendKeys.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
          기간별 총 판매 추이
        </h3>
        <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
          {periodLabel} · 일자별 시·도 합계(마리) — 선 색은 지도 마커와 동일하게{" "}
          <strong>시·도명을 region처럼</strong> 적용한 색(mapMarkerColorForRegion), 상위{" "}
          {trendKeys.filter((k) => k !== "기타").length}개
          {trendKeys.includes("기타") ? " + 기타" : ""}
        </p>
        {!hasTrend ? (
          <p className="mt-2 text-[11px] text-zinc-400">표시할 데이터가 없습니다.</p>
        ) : (
          <div className="mt-2 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-zinc-500" />
                <YAxis tick={{ fontSize: 10 }} width={36} className="text-zinc-500" />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid #e4e4e7",
                  }}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString()}마리`, ""]}
                  labelFormatter={(_label, payload) =>
                    String((payload?.[0]?.payload as Record<string, unknown>)?.salesDate ?? "")
                  }
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                {trendKeys.map((key) => {
                  const c = mapMarkerColorForRegion(key);
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={c}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: c, stroke: "#fff", strokeWidth: 1 }}
                      activeDot={{ r: 4, fill: c, stroke: "#fff", strokeWidth: 1 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
          시·도·구별 판매 (막대)
        </h3>
        <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
          현재 선택 기간 누적, 상위 16개 (시·도 + 구/군 단위, 구마다 색 구분)
        </p>
        {barData.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-400">표시할 데이터가 없습니다.</p>
        ) : (
          <div
            className="mt-2 w-full"
            style={{ height: Math.min(320, Math.max(140, barData.length * 20 + 48)) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                barCategoryGap="12%"
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ fontSize: 8 }}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString()}마리`, "누적"]}
                />
                <Bar dataKey="total" barSize={10} radius={[0, 2, 2, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.label} fill={colorForRegionLabel(entry.label)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
