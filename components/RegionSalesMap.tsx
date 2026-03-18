"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { StoreSalesSummary } from "@/lib/types/store";
import {
  addSale,
  addSaleRange,
  createStore,
  deleteStore,
  deleteSalesByStoreAndDate,
  getSaleQuantityByStoreAndDate,
  getStoreSummaries,
  updateSale,
  type PeriodKey,
} from "@/app/actions/sales";
import { generateAiReport } from "@/app/actions/report";
import { toast } from "sonner";

const RegionMapInner = dynamic(() => import("./RegionMapInner"), {
  ssr: false,
});

const PERIOD_LABELS: { key: PeriodKey; label: string }[] = [
  { key: "yesterday", label: "전일" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "6m", label: "6개월" },
  { key: "all", label: "총" },
];

// 시/도 옵션 (필요 시 추가)
const SIDO_LIST = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원도",
  "충청북도",
  "충청남도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

export default function RegionSalesMap() {
  const [period, setPeriod] = useState<PeriodKey>("1w");
  const [summaries, setSummaries] = useState<StoreSalesSummary[]>([]);
  const [isPending, startTransition] = useTransition();
  const [mapScrollTick, setMapScrollTick] = useState(0);
  const [isMapOpen, setIsMapOpen] = useState(true);

  // 일일 판매량 입력용 상태
  const [mode, setMode] = useState<"single" | "range">("single");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedSido, setSelectedSido] = useState("");
  const [salesDate, setSalesDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rangeStart, setRangeStart] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rangeEnd, setRangeEnd] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [quantity, setQuantity] = useState("");
  // 판매량 수정용
  const [editSalesDate, setEditSalesDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editQuantity, setEditQuantity] = useState("");
  // AI 리포트
  const [reportPending, setReportPending] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  // 지도에서 선택한 지점 → 날짜별 판매량 보기
  const [selectedMapStoreId, setSelectedMapStoreId] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [detailQuantity, setDetailQuantity] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailEditQuantity, setDetailEditQuantity] = useState("");
  // 케어 필요 지점 & 검색
  const [careThreshold, setCareThreshold] = useState(100);
  const [storeSearch, setStoreSearch] = useState("");

  // 신규 지점 추가 모달 상태
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreRegion, setNewStoreRegion] = useState("");
  const [newStoreManagerPhone, setNewStoreManagerPhone] = useState("");

  const storeOptions = useMemo(
    () =>
      summaries.map((s) => {
        const region = s.store.region ?? "";
        const [sido, ...rest] = region.split(" ");
        const gu = rest.join(" ") || region;
        return {
          id: s.store.id,
          name: s.store.name,
          region,
          sido,
          gu,
          managerPhone: s.store.managerPhone ?? "",
          totalQuantity: s.totalQuantity,
        };
      }),
    [summaries],
  );

  const sidoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          storeOptions
            .map((s) => s.sido)
            .filter((sido): sido is string => !!sido),
        ),
      ),
    [storeOptions],
  );

  const filteredStoreOptions = useMemo(
    () =>
      storeOptions.filter((s) => {
        if (selectedSido && s.sido !== selectedSido) return false;
        if (!storeSearch.trim()) return true;
        const q = storeSearch.trim().toLowerCase();
        const phoneLast4 = s.managerPhone.slice(-4);
        return (
          s.name.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          phoneLast4.includes(q)
        );
      }),
    [storeOptions, selectedSido, storeSearch],
  );

  async function refresh(periodKey: PeriodKey) {
    const data = await getStoreSummaries(periodKey);
    setSummaries(data);
  }

  useEffect(() => {
    startTransition(() => {
      refresh(period);
    });
  }, [period]);

  // 지도에서 선택한 지점 + 날짜 → 해당 일 판매량 조회
  useEffect(() => {
    if (!selectedMapStoreId || !detailDate) {
      setDetailQuantity(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getSaleQuantityByStoreAndDate(selectedMapStoreId, detailDate)
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
  }, [selectedMapStoreId, detailDate]);

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreName.trim() || !newStoreRegion.trim()) {
      toast.error("지점명과 시/도·구 정보를 모두 입력해주세요.");
      return;
    }
    if (!newStoreManagerPhone.trim()) {
      toast.error("지점장 연락처를 입력해주세요.");
      return;
    }
    const fullRegion = selectedSido
      ? `${selectedSido} ${newStoreRegion.trim()}`
      : newStoreRegion.trim();
    try {
      await createStore({
        name: newStoreName.trim(),
        region: fullRegion,
        managerPhone: newStoreManagerPhone.trim(),
      });
      toast.success("신규 지점이 등록되었습니다.");
      setNewStoreName("");
      setNewStoreRegion("");
      setNewStoreManagerPhone("");
      if (selectedSido && !sidoOptions.includes(selectedSido)) {
        setSelectedSido("");
      }
      setIsStoreModalOpen(false);
      startTransition(() => {
        refresh(period);
      });
    } catch (err: any) {
      toast.error(err.message ?? "지점 등록에 실패했습니다.");
    }
  }

  async function handleDeleteStore(storeId: string) {
    if (!window.confirm("해당 지점을 삭제하시겠습니까? 관련 판매 기록도 함께 사라집니다.")) {
      return;
    }
    try {
      await deleteStore(storeId);
      toast.success("지점이 삭제되었습니다.");
      if (selectedStoreId === storeId) {
        setSelectedStoreId("");
      }
      startTransition(() => {
        refresh(period);
      });
    } catch (err: any) {
      toast.error(err.message ?? "삭제에 실패했습니다.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStoreId || !quantity) {
      toast.error("지점과 판매 마리 수를 모두 입력해주세요.");
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
      return;
    }

    try {
      if (mode === "single") {
        if (!salesDate) {
          toast.error("판매일자를 입력해주세요.");
          return;
        }
        await addSale({
          storeId: selectedStoreId,
          salesDate,
          quantity: qty,
        });
        toast.success("일일 판매 데이터가 등록되었습니다.");
      } else {
        if (!rangeStart || !rangeEnd) {
          toast.error("시작일과 종료일을 모두 입력해주세요.");
          return;
        }
        await addSaleRange({
          storeId: selectedStoreId,
          startDate: rangeStart,
          endDate: rangeEnd,
          quantity: qty,
        });
        toast.success("기간 총 마리 수가 일자별로 분배되어 등록되었습니다.");
      }
      setQuantity("");
      startTransition(() => {
        refresh(period);
      });
    } catch (err: any) {
      toast.error(err.message ?? "등록에 실패했습니다.");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStoreId || !editSalesDate || editQuantity === "") {
      toast.error("지점, 수정할 일자, 새 마리 수를 모두 입력해주세요.");
      return;
    }
    const qty = Number(editQuantity);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
      return;
    }
    try {
      await updateSale({
        storeId: selectedStoreId,
        salesDate: editSalesDate,
        quantity: qty,
      });
      toast.success("판매 마리 수가 수정되었습니다.");
      setEditQuantity("");
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "수정에 실패했습니다.");
    }
  }

  async function handleGenerateReport() {
    setReportPending(true);
    setReportError(null);
    setReportMarkdown(null);
    setReportPanelOpen(true);
    const result = await generateAiReport(period);
    setReportPending(false);
    if (result.ok) {
      setReportMarkdown(result.markdown);
    } else {
      setReportError(result.error);
      toast.error(result.error);
    }
  }

  useEffect(() => {
    if (mapScrollTick <= 0) return;
    if (!isMapOpen) setIsMapOpen(true);
    const el = document.getElementById("map-section");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mapScrollTick, isMapOpen]);

  async function handleMapDetailSave() {
    if (!selectedMapStoreId || !detailDate) {
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
      await updateSale({
        storeId: selectedMapStoreId,
        salesDate: detailDate,
        quantity: qty,
      });
      toast.success("해당 일자의 판매 마리 수가 수정되었습니다.");
      setDetailEditQuantity("");
      // 다시 조회
      const refreshed = await getSaleQuantityByStoreAndDate(
        selectedMapStoreId,
        detailDate,
      );
      setDetailQuantity(refreshed);
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "수정에 실패했습니다.");
    }
  }

  async function handleMapDetailDelete() {
    if (!selectedMapStoreId || !detailDate) {
      toast.error("지점과 날짜를 먼저 선택해주세요.");
      return;
    }
    if (
      !window.confirm(
        `${detailDate}의 판매 데이터를 모두 삭제하시겠습니까?`,
      )
    ) {
      return;
    }
    try {
      await deleteSalesByStoreAndDate(selectedMapStoreId, detailDate);
      toast.success("해당 일자의 판매 데이터가 삭제되었습니다.");
      setDetailQuantity(0);
      setDetailEditQuantity("");
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950">
      <aside className="w-full md:w-[32%] max-w-md border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 md:p-6 flex flex-col gap-6 overflow-y-auto md:overflow-y-visible max-h-[55dvh] md:max-h-none">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            창조통닭 지역별 판매량
          </h1>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <p>구 단위 지점과 기간별 판매 마리 수를 관리합니다.</p>
            <a
              href="/calendar"
              className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              일별 캘린더 보기
            </a>
          </div>
        </div>

        {/* 빠른 메뉴 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
          <button
            type="button"
            onClick={() => {
              if (!isMapOpen) setIsMapOpen(true);
              setMapScrollTick((v) => v + 1);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            지도 열기
          </button>
          <button
            type="button"
            onClick={() => setIsMapOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isMapOpen ? "지도 닫기" : "지도 열기"}
          </button>
          <a
            href="/ranking"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            랭킹·히트맵 보기
          </a>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={reportPending}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {reportPending ? "분석 중…" : "AI 리포트 분석"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsStoreModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-950/30"
          >
            신규 지점 추가
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          AI 리포트 분석은 선택한 기간 데이터를 바탕으로 <strong>1만 개 지점 목표</strong> 관점의 요약·액션과
          급등·급락 포인트를 정리합니다.
        </p>

        {/* 지점 검색 + 케어 필요 지점 설정 */}
        <div className="mt-1 flex flex-col gap-2 rounded-lg bg-zinc-50/70 p-3 text-[11px] dark:bg-zinc-800/40">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                지점 검색
              </label>
              <input
                type="text"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="지점명, 지역, 연락처 뒤 4자리"
                className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                케어 기준
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={careThreshold}
                onChange={(e) => setCareThreshold(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            케어 기준 마리 수 미만인 지점은 아래 「케어 필요 지점」 목록에 표시됩니다.
          </p>
        </div>

        {/* 일일 / 기간 판매량 입력 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              시/도 선택
            </label>
            <select
              value={selectedSido}
              onChange={(e) => {
                setSelectedSido(e.target.value);
                setSelectedStoreId("");
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">전체 시/도</option>
              {SIDO_LIST.map((sido) => (
                <option key={sido} value={sido}>
                  {sido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              지점 선택
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">지점을 선택하세요</option>
              {filteredStoreOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.region})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`rounded-full px-2 py-1 border ${
                    mode === "single"
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                      : "border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  단일 일자
                </button>
                <button
                  type="button"
                  onClick={() => setMode("range")}
                  className={`rounded-full px-2 py-1 border ${
                    mode === "range"
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                      : "border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  기간 선택
                </button>
              </div>
              {mode === "single" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    판매일자
                  </label>
                  <input
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        시작일
                      </label>
                      <input
                        type="date"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        종료일
                      </label>
                      <input
                        type="date"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    기간 전체의 <span className="font-semibold">총 판매 마리 수</span>를 입력하세요. 일자별로 균등 분배되어 저장됩니다.
                  </p>
                </div>
              )}
            </div>
            <div className="w-28">
              <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {mode === "range" ? "기간 총 마리 수" : "판매 마리 수"}
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={mode === "range" ? "예: 700" : "예: 100"}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            일일 판매량 저장
          </button>
        </form>

        {/* 케어 필요 지점 리스트 */}
        {summaries.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3 text-[11px] dark:border-red-900/60 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-red-700 dark:text-red-300">
                케어 필요 지점
              </span>
              <span className="text-[10px] text-red-500 dark:text-red-400">
                기준: {careThreshold.toLocaleString()}마리 미만
              </span>
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {storeOptions
                .filter((s) => s.totalQuantity < careThreshold)
                .slice(0, 20)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded bg-white/80 px-2 py-1 text-[11px] shadow-sm dark:bg-zinc-900/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                        {s.name}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                        {s.region}
                        {s.managerPhone && ` · ${s.managerPhone}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-semibold text-red-700 dark:text-red-300">
                      {s.totalQuantity.toLocaleString()}마리
                    </div>
                  </div>
                ))}
              {storeOptions.filter((s) => s.totalQuantity < careThreshold).length === 0 && (
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  현재 케어 필요 지점이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 판매량 수정 */}
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            판매 마리수 수정
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            이미 입력된 특정 일자의 판매량만 변경합니다. 지점·일자는 위와 동일하게 선택하세요.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              수정할 일자
            </label>
            <input
              type="date"
              value={editSalesDate}
              onChange={(e) => setEditSalesDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              새 판매 마리 수
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="예: 120"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
          >
            수정 저장
          </button>
        </form>

        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          지도 수치는 선택한 기간(전일/1주/한달 등)에 <strong>실제 입력된</strong> 판매 데이터만 집계한 누적 마리 수입니다.
        </div>
      </aside>

      <main
        id="map-section"
        className={`flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 ${
          isMapOpen ? "min-h-[45dvh] md:min-h-0" : "min-h-0"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white/80 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/80 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 font-medium text-zinc-700 dark:text-zinc-200">기간</span>
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-full px-3 py-1 ${
                  period === key
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                } text-sm font-medium`}
              >
                {label}
              </button>
            ))}
            {isPending && <span className="ml-2 text-sm text-zinc-400">로딩 중…</span>}
          </div>

          <button
            type="button"
            onClick={() => setIsMapOpen((v) => !v)}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isMapOpen ? "지도 닫기" : "지도 열기"}
          </button>
        </div>

        {isMapOpen ? (
          <div className="relative flex-1 min-h-[45dvh] md:min-h-0">
            <RegionMapInner
              summaries={summaries}
              onDeleteStore={handleDeleteStore}
              onStoreSelect={setSelectedMapStoreId}
            />

            {/* 지도 위 선택 지점 일별 판매 패널 */}
            {selectedMapStoreId && (
              <div className="pointer-events-auto absolute right-3 top-3 z-[500] w-[18.5rem] rounded-xl border border-zinc-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                    일별 판매 (조회/수정/삭제)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMapStoreId(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    닫기
                  </button>
                </div>
                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {summaries.find((s) => s.store.id === selectedMapStoreId)?.store.name ?? "지점"} · 마커 클릭 후 날짜 선택
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
                    onClick={handleMapDetailSave}
                    className="flex-1 rounded-lg bg-amber-500 py-2 text-center text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    수정 저장
                  </button>
                  <button
                    type="button"
                    onClick={handleMapDetailDelete}
                    className="flex-1 rounded-lg border border-red-500 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
            지도가 닫혀있습니다. 필요할 때 <span className="mx-1 font-semibold text-amber-600 dark:text-amber-400">지도 열기</span>를 눌러주세요.
          </div>
        )}
      </main>

      {/* AI 리포트 패널 (슬라이드) */}
      {reportPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="w-full max-w-lg overflow-hidden bg-white shadow-xl dark:bg-zinc-900 md:max-w-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                일일 AI 판매 리포트 (1만 지점 목표)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setReportPanelOpen(false);
                  setReportMarkdown(null);
                  setReportError(null);
                }}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4">
              {reportPending && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  선택한 기간 데이터로 1만 지점 목표 관점의 일일 리포트를 작성 중입니다…
                </p>
              )}
              {reportError && !reportPending && (
                <p className="text-sm text-red-600 dark:text-red-400">{reportError}</p>
              )}
              {reportMarkdown && !reportPending && (
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {reportMarkdown}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 신규 지점 추가 모달 */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              신규 지점 추가
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              지점명과 시/도, 구 단위 정보를 입력하면 됩니다.
            </p>
            <form onSubmit={handleCreateStore} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  지점명
                </label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="예: 더레스트마린점"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  지점장 연락처
                </label>
                <input
                  type="tel"
                  value={newStoreManagerPhone}
                  onChange={(e) => setNewStoreManagerPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  시/도
                </label>
                <select
                  value={selectedSido}
                  onChange={(e) => setSelectedSido(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">시/도를 선택하세요</option>
                  {SIDO_LIST.map((sido) => (
                    <option key={sido} value={sido}>
                      {sido}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  구 단위 (예: 해운대구)
                </label>
                <input
                  type="text"
                  value={newStoreRegion}
                  onChange={(e) => setNewStoreRegion(e.target.value)}
                  placeholder="예: 해운대구"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

