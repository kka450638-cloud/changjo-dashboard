"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  deleteSalesByStoreAndDate,
  getSaleQuantityByStoreAndDate,
  getStoreSummaries,
  updateSale,
  type PeriodKey,
} from "@/app/actions/sales";
import type { StoreSalesSummary } from "@/lib/types/store";
import Link from "next/link";
import { toast } from "sonner";

const RegionMapInner = dynamic(() => import("@/components/RegionMapInner"), {
  ssr: false,
});

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "yesterday", label: "전일" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "6m", label: "6개월" },
  { key: "all", label: "총" },
];

export default function MapPage() {
  const searchParams = useSearchParams();
  const initialPeriod = (searchParams.get("period") as PeriodKey) || "1w";

  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const [summaries, setSummaries] = useState<StoreSalesSummary[]>([]);
  const [isPending, startTransition] = useTransition();

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [detailQuantity, setDetailQuantity] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailEditQuantity, setDetailEditQuantity] = useState("");

  async function refresh(periodKey: PeriodKey) {
    const data = await getStoreSummaries(periodKey);
    setSummaries(data);
  }

  useEffect(() => {
    startTransition(() => {
      refresh(period);
    });
  }, [period]);

  useEffect(() => {
    if (!selectedStoreId || !detailDate) {
      setDetailQuantity(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getSaleQuantityByStoreAndDate(selectedStoreId, detailDate)
      .then((qty) => {
        if (!cancelled) setDetailQuantity(qty);
      })
      .catch(() => {
        if (!cancelled) setDetailQuantity(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, detailDate]);

  async function handleSave() {
    if (!selectedStoreId || !detailDate) {
      toast.error("지점과 날짜를 먼저 선택해주세요.");
      return;
    }
    if (detailEditQuantity === "") {
      toast.error("새 마리 수를 입력해주세요.");
      return;
    }
    const qty = Number(detailEditQuantity);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
      return;
    }
    try {
      await updateSale({ storeId: selectedStoreId, salesDate: detailDate, quantity: qty });
      toast.success("해당 일자의 판매 마리 수가 수정되었습니다.");
      setDetailEditQuantity("");
      const refreshed = await getSaleQuantityByStoreAndDate(selectedStoreId, detailDate);
      setDetailQuantity(refreshed);
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "수정에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!selectedStoreId || !detailDate) {
      toast.error("지점과 날짜를 먼저 선택해주세요.");
      return;
    }
    if (!window.confirm(`${detailDate}의 판매 데이터를 모두 삭제하시겠습니까?`)) return;
    try {
      await deleteSalesByStoreAndDate(selectedStoreId, detailDate);
      toast.success("해당 일자의 판매 데이터가 삭제되었습니다.");
      setDetailQuantity(0);
      setDetailEditQuantity("");
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "삭제에 실패했습니다.");
    }
  }

  const selectedStoreName =
    selectedStoreId
      ? summaries.find((s) => s.store.id === selectedStoreId)?.store.name
      : null;

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/90 md:px-6">
        <Link
          href="/"
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← 대시보드
        </Link>
        <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
          지도
        </span>
        <div className="mx-2 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          기간
        </span>
        {PERIOD_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-full px-3 py-1 ${
              period === key
                ? "bg-amber-500 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            } text-xs font-medium`}
          >
            {label}
          </button>
        ))}
        {isPending && <span className="text-xs text-zinc-400">로딩 중…</span>}
      </header>

      <div className="relative flex-1 min-h-0">
        <RegionMapInner
          summaries={summaries}
          onDeleteStore={() => {}}
          onStoreSelect={setSelectedStoreId}
        />

        {/* 지도 위 선택 지점 일별 판매 패널 */}
        {selectedStoreId && (
          <div className="pointer-events-auto absolute right-3 top-3 z-[500] w-[18.5rem] rounded-xl border border-zinc-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                일별 판매 (조회/수정/삭제)
              </span>
              <button
                type="button"
                onClick={() => setSelectedStoreId(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                닫기
              </button>
            </div>
            <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              {selectedStoreName ?? "지점"} · 마커 클릭 후 날짜 선택
            </div>

            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              날짜
            </label>
            <input
              type="date"
              value={detailDate}
              onChange={(e) => setDetailDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />

            <div className="mt-2 min-h-[1.5rem] text-sm">
              {detailLoading ? (
                <span className="text-zinc-500 dark:text-zinc-400">조회 중…</span>
              ) : (
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {detailQuantity !== null
                    ? `${detailDate} 판매량: ${detailQuantity.toLocaleString()}마리`
                    : "해당 일자 데이터 없음"}
                </span>
              )}
            </div>

            <label className="mt-3 mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              새 판매 마리 수
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={detailEditQuantity}
              onChange={(e) => setDetailEditQuantity(e.target.value)}
              placeholder="예: 120"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-center text-xs font-semibold text-white hover:bg-amber-600"
              >
                수정 저장
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-lg border border-red-500 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

