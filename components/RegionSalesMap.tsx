"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import type { StoreSalesSummary } from "@/lib/types/store";
import {
  addSale,
  addSaleRange,
  buildFilteredStoreSalesCsv,
  createStore,
  deleteStore,
  deleteSalesByStoreAndDate,
  getChartRegionSeries,
  getDayOverDayComparison,
  getQuantitiesByStoreForDate,
  getSaleQuantityByStoreAndDate,
  getStoreSummaries,
  updateSale,
  upsertSaleForStoreDate,
  type PeriodKey,
  type RegionChartSeriesPayload,
  type SidoDayOver,
} from "@/app/actions/sales";
import { consumeOpenAiSseStream } from "@/lib/openaiSse";
import { toast } from "sonner";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import DashboardCharts from "@/components/DashboardCharts";
import { KOREA_SIDO_LIST } from "@/lib/koreaSido";
import { storeMatchesSearchQuery } from "@/lib/storeSearch";

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

type RegionSalesMapProps = {
  initialMapDate?: string | null;
};

export default function RegionSalesMap({
  initialMapDate = null,
}: RegionSalesMapProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [period, setPeriod] = useState<PeriodKey>("1w");
  const [summaries, setSummaries] = useState<StoreSalesSummary[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isMapOpen, setIsMapOpen] = useState(true);

  /** 캘린더 ↔ 지도: 특정 일자만 지도에 반영 */
  const [mapFilterDate, setMapFilterDate] = useState<string | null>(
    initialMapDate,
  );
  const [quantitiesByStoreForDay, setQuantitiesByStoreForDay] = useState<
    Record<string, number> | null
  >(null);
  const [mapDayLoading, setMapDayLoading] = useState(false);

  /** 전일 대비 (어제 − 그전날) */
  const [storeDayDelta, setStoreDayDelta] = useState<Record<string, number>>(
    {},
  );
  const [sidoDayOver, setSidoDayOver] = useState<SidoDayOver[]>([]);
  const [dodMeta, setDodMeta] = useState<{
    yesterdayDate: string;
    prevDate: string;
  } | null>(null);

  /** 차트용 일별 합계 */
  const [chartRegion, setChartRegion] = useState<RegionChartSeriesPayload>({
    trendRows: [],
    trendKeys: [],
    sigunguBars: [],
  });
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [csvExportPending, setCsvExportPending] = useState(false);

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
  const [reportMarkdown, setReportMarkdown] = useState<string>("");
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
  /** 검색 결과 클릭 시 지도 flyTo (nonce로 같은 지점 재클릭도 동작) */
  const [flyToStore, setFlyToStore] = useState<{
    id: string;
    nonce: number;
  } | null>(null);

  /** 지도에서 지점을 새로 찍을 때만 날짜·사이드바 동기화 (같은 지점이면 날짜 유지) */
  const lastSyncedMapStoreRef = useRef<string | null>(null);

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
        return storeMatchesSearchQuery(
          {
            name: s.name,
            region: s.region,
            managerPhone: s.managerPhone,
          },
          storeSearch,
        );
      }),
    [storeOptions, selectedSido, storeSearch],
  );

  /** 지도 마커 강조용: 검색어가 있을 때만 Set 전달 */
  const searchMatchIdSet = useMemo(() => {
    if (!storeSearch.trim()) return null;
    return new Set(filteredStoreOptions.map((s) => s.id));
  }, [storeSearch, filteredStoreOptions]);

  async function refresh(periodKey: PeriodKey) {
    const data = await getStoreSummaries(periodKey);
    setSummaries(data);
    try {
      const r = await getDayOverDayComparison();
      const m: Record<string, number> = {};
      for (const row of r.byStore) m[row.storeId] = row.delta;
      setStoreDayDelta(m);
      setSidoDayOver(r.bySido);
      setDodMeta({ yesterdayDate: r.yesterdayDate, prevDate: r.prevDate });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    setMapFilterDate(initialMapDate);
    if (initialMapDate) {
      setDetailDate(initialMapDate);
      setIsMapOpen(true);
    }
  }, [initialMapDate]);

  /** 지도 마커 선택 → 왼쪽 「지점 선택」·판매일자·일별 패널 날짜 맞춤 + 빠른 입력 준비 */
  useEffect(() => {
    if (!selectedMapStoreId) {
      lastSyncedMapStoreRef.current = null;
      return;
    }
    const isNewPick = lastSyncedMapStoreRef.current !== selectedMapStoreId;
    if (isNewPick) {
      lastSyncedMapStoreRef.current = selectedMapStoreId;
      setSelectedStoreId(selectedMapStoreId);
      const pickDate =
        mapFilterDate ?? new Date().toISOString().slice(0, 10);
      setSalesDate(pickDate);
      setDetailDate(pickDate);
      setEditSalesDate(pickDate);
      setMode("single");
      setDetailEditQuantity("");
    }

    const row = summaries.find((s) => s.store.id === selectedMapStoreId);
    const sido = row?.store.region?.trim().split(/\s+/)[0] ?? "";
    if (row && sido && (KOREA_SIDO_LIST as readonly string[]).includes(sido)) {
      setSelectedSido(sido);
    }
  }, [selectedMapStoreId, mapFilterDate, summaries]);

  /** 지도 패널 날짜 ↔ 왼쪽 「판매일자」 동기화 (같은 지점이 선택된 경우만) */
  useEffect(() => {
    if (!selectedMapStoreId || selectedStoreId !== selectedMapStoreId) return;
    setSalesDate(detailDate);
    setEditSalesDate(detailDate);
  }, [detailDate, selectedMapStoreId, selectedStoreId]);

  useEffect(() => {
    if (!selectedMapStoreId || selectedStoreId !== selectedMapStoreId) return;
    setDetailDate(salesDate);
  }, [salesDate, selectedMapStoreId, selectedStoreId]);

  useEffect(() => {
    startTransition(() => {
      refresh(period);
    });
  }, [period]);

  const fetchCharts = useCallback(() => {
    setChartLoading(true);
    setChartError(null);
    getChartRegionSeries(period)
      .then((d) => {
        setChartRegion(d);
        setChartError(null);
      })
      .catch((err: unknown) => {
        setChartError(
          err instanceof Error ? err.message : "차트 데이터를 불러오지 못했습니다.",
        );
      })
      .finally(() => setChartLoading(false));
  }, [period]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  async function handleExportCsv() {
    setCsvExportPending(true);
    try {
      const csv = await buildFilteredStoreSalesCsv({
        period,
        sidoFilter: selectedSido.trim() || undefined,
        searchQuery: storeSearch.trim() || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `changjo-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 파일을 저장했습니다. (현재 기간·시/도·검색어 필터 반영)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "CSV보내기에 실패했습니다.");
    } finally {
      setCsvExportPending(false);
    }
  }

  useEffect(() => {
    if (!mapFilterDate) {
      setQuantitiesByStoreForDay(null);
      setMapDayLoading(false);
      return;
    }
    let cancelled = false;
    setMapDayLoading(true);
    getQuantitiesByStoreForDate(mapFilterDate)
      .then((m) => {
        if (!cancelled) setQuantitiesByStoreForDay(m);
      })
      .catch(() => {
        if (!cancelled) setQuantitiesByStoreForDay({});
      })
      .finally(() => {
        if (!cancelled) setMapDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mapFilterDate]);

  const mapDisplaySummaries = useMemo((): StoreSalesSummary[] => {
    if (!mapFilterDate) return summaries;
    if (!quantitiesByStoreForDay) {
      return summaries.map((s) => ({ ...s, totalQuantity: 0 }));
    }
    return summaries.map((s) => ({
      ...s,
      totalQuantity: quantitiesByStoreForDay[s.store.id] ?? 0,
    }));
  }, [summaries, mapFilterDate, quantitiesByStoreForDay]);

  const periodLabelForChart =
    PERIOD_LABELS.find((x) => x.key === period)?.label ?? String(period);

  function clearMapDateFilter() {
    setMapFilterDate(null);
    router.replace(pathname || "/", { scroll: false });
  }

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

  /** 조회 완료 시 지도 패널 입력란에 현재 마리 수 반영(수정 편의) */
  useEffect(() => {
    if (!selectedMapStoreId || detailLoading) return;
    if (detailQuantity === null) return;
    setDetailEditQuantity(String(detailQuantity));
  }, [selectedMapStoreId, detailDate, detailLoading, detailQuantity]);

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
    setReportMarkdown("");
    setReportPanelOpen(true);
    try {
      const res = await fetch("/api/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ period }),
      });

      if (res.status === 401) {
        const msg = "로그인이 필요합니다. 다시 로그인해 주세요.";
        setReportError(msg);
        toast.error(msg);
        return;
      }

      if (!res.ok) {
        let msg = `리포트 요청 실패 (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; detail?: string };
          if (j.error) msg = j.error;
          if (j.detail) msg += `: ${j.detail.slice(0, 120)}`;
        } catch {
          const t = await res.text();
          if (t) msg = t.slice(0, 200);
        }
        setReportError(msg);
        toast.error(msg);
        return;
      }

      const ctype = res.headers.get("content-type") ?? "";
      if (!res.body || !ctype.includes("event-stream")) {
        setReportError("스트림 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
        toast.error("AI 스트림 연결에 실패했습니다.");
        return;
      }

      await consumeOpenAiSseStream(res.body, (delta) => {
        setReportMarkdown((prev) => prev + delta);
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setReportError(message);
      toast.error(message);
    } finally {
      setReportPending(false);
    }
  }

  function scrollToMap() {
    const el = document.getElementById("map-section");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** 검색 결과 또는 빠른 선택: 폼 지점·지도 포커스·마커로 이동 */
  function pickStoreFromSearch(storeId: string) {
    const opt = storeOptions.find((o) => o.id === storeId);
    if (opt && (KOREA_SIDO_LIST as readonly string[]).includes(opt.sido)) {
      setSelectedSido(opt.sido);
    } else {
      setSelectedSido("");
    }
    setSelectedStoreId(storeId);
    setSelectedMapStoreId(storeId);
    setIsMapOpen(true);
    setFlyToStore({ id: storeId, nonce: Date.now() });
    requestAnimationFrame(() => scrollToMap());
  }

  function handleToggleMapFromSidebar() {
    if (isMapOpen) {
      setIsMapOpen(false);
      setSelectedMapStoreId(null);
      return;
    }
    setIsMapOpen(true);
    // DOM 반영 후 스크롤
    requestAnimationFrame(() => {
      scrollToMap();
    });
  }

  async function handleMapDetailSave() {
    if (!selectedMapStoreId || !detailDate) {
      toast.error("지점과 날짜를 먼저 선택해주세요.");
      return;
    }
    if (detailEditQuantity === "") {
      toast.error("판매 마리 수를 입력해주세요.");
      return;
    }
    const qty = Number(detailEditQuantity);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
      return;
    }
    try {
      await upsertSaleForStoreDate({
        storeId: selectedMapStoreId,
        salesDate: detailDate,
        quantity: qty,
      });
      toast.success("일일 판매 마리 수를 저장했습니다.");
      setDetailEditQuantity("");
      const refreshed = await getSaleQuantityByStoreAndDate(
        selectedMapStoreId,
        detailDate,
      );
      setDetailQuantity(refreshed);
      startTransition(() => refresh(period));
    } catch (err: any) {
      toast.error(err.message ?? "저장에 실패했습니다.");
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
    <div className="flex h-[100dvh] w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      {mapFilterDate && (
        <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/50 md:px-6 shrink-0">
          <span className="text-amber-950 dark:text-amber-100">
            <strong>캘린더 연동</strong>: {mapFilterDate} 하루 판매만 지도에 표시합니다.
            {mapDayLoading && (
              <span className="ml-2 font-normal text-amber-800/80 dark:text-amber-200/80">
                불러오는 중…
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={clearMapDateFilter}
            className="rounded-full border border-amber-600 bg-white px-3 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:bg-zinc-900 dark:text-amber-100 dark:hover:bg-zinc-800"
            aria-label="캘린더에서 선택한 날짜 지도 필터 해제"
          >
            날짜 필터 해제
          </button>
        </div>
      )}
      <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white/90 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/90 md:px-6">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-labelledby="period-filter-label"
        >
          <span id="period-filter-label" className="mr-2 font-medium text-zinc-700 dark:text-zinc-200">
            기간
          </span>
          {PERIOD_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-full px-3 py-1 ${
                period === key
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              } text-sm font-medium`}
              aria-pressed={period === key}
              aria-label={`집계 기간 ${label}`}
            >
              {label}
            </button>
          ))}
          {isPending && <span className="ml-2 text-sm text-zinc-400">로딩 중…</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminLogoutButton />
          <button
            type="button"
            onClick={() => setIsMapOpen((v) => !v)}
            className="pointer-events-auto rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-expanded={isMapOpen}
            aria-controls="map-section"
            aria-label={isMapOpen ? "지도 패널 닫기" : "지도 패널 열기"}
          >
            {isMapOpen ? "지도 닫기" : "지도 열기"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:min-h-0 md:flex-row">
        <aside
          aria-label="필터, 검색, 판매 입력"
          className={`flex w-full flex-col gap-6 overflow-y-auto border-b border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 md:border-b-0 md:border-r md:p-6 ${
            isMapOpen
              ? "max-h-[55dvh] shrink-0 md:max-h-none md:w-[32%] md:max-w-md md:shrink-0"
              : "min-h-0 flex-1 md:max-w-none"
          }`}
        >
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            창조 지점 관리
          </h1>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <p>구 단위 지점과 기간별 판매 마리 수를 관리합니다.</p>
            <a
              href="/calendar"
              className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="일별 판매 캘린더 페이지로 이동"
            >
              일별 캘린더 보기
            </a>
          </div>
        </div>

        {/* 빠른 메뉴 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
          <button
            type="button"
            onClick={handleToggleMapFromSidebar}
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            aria-label={isMapOpen ? "지도 닫기" : "지도 열기"}
          >
            {isMapOpen ? "지도 닫기" : "지도 열기"}
          </button>
          <a
            href="/ranking"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="랭킹 및 히트맵 페이지로 이동"
          >
            랭킹·히트맵 보기
          </a>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={reportPending}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            aria-label="선택 기간으로 AI 판매 리포트 생성"
            aria-busy={reportPending}
          >
            {reportPending ? "분석 중…" : "AI 리포트 분석"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsStoreModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-950/30"
            aria-label="신규 지점 추가 모달 열기"
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
              <label
                htmlFor="store-search-input"
                className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300"
              >
                지점 검색
              </label>
              <div className="flex gap-1">
                <input
                  id="store-search-input"
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder="지점명, 지역, 전화번호(일부·전체)"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                  aria-label="지점 검색"
                />
                {storeSearch.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setStoreSearch("")}
                    className="shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    title="검색어 지우기"
                    aria-label="지점 검색어 지우기"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>
            <div className="w-28">
              <label
                htmlFor="care-threshold-input"
                className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300"
              >
                케어 기준
              </label>
              <input
                id="care-threshold-input"
                type="number"
                min={0}
                step={1}
                value={careThreshold}
                onChange={(e) => setCareThreshold(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                aria-describedby="care-threshold-hint"
              />
            </div>
          </div>
          <p id="care-threshold-hint" className="text-[10px] text-zinc-500 dark:text-zinc-400">
            <strong>용도:</strong> 아래 「지점 선택」 목록을 좁히고,{" "}
            <strong>지도에서 일치 지점은 파란 링·나머지는 흐림</strong> 처리합니다. 목록에서 지점을 누르면
            판매 입력 폼에 반영되고 지도가 해당 마커로 이동합니다. 「케어 필요 지점」도 같은 검색어로
            걸러집니다.
          </p>
          {storeSearch.trim() !== "" && (
            <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-900/80">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>
                  일치 <strong className="text-zinc-700 dark:text-zinc-200">{filteredStoreOptions.length}</strong>곳
                  {selectedSido ? ` · 시/도 필터: ${selectedSido}` : ""}
                </span>
              </div>
              {filteredStoreOptions.length === 0 ? (
                <p className="text-[10px] text-zinc-400">조건에 맞는 지점이 없습니다.</p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto">
                  {filteredStoreOptions.slice(0, 15).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => pickStoreFromSearch(s.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        aria-label={`검색 결과에서 지점 ${s.name} 선택`}
                      >
                        <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-100">
                          {s.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-amber-700 dark:text-amber-300">
                          {s.totalQuantity.toLocaleString()}마리
                        </span>
                      </button>
                      <div className="truncate px-2 pb-1 text-[9px] text-zinc-400 dark:text-zinc-500">
                        {s.region}
                        {s.managerPhone ? ` · ${s.managerPhone}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {filteredStoreOptions.length > 15 && (
                <p className="mt-1 text-[9px] text-zinc-400">상위 15개만 표시 · 드롭다운에서 전체 확인</p>
              )}
            </div>
          )}
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            케어 기준 마리 수 미만인 지점은 아래 「케어 필요 지점」에 표시됩니다 (검색어 적용).
          </p>
        </div>

        {/* 전일 대비 (어제 vs 그전날) */}
        {dodMeta && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-[11px] dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="font-semibold text-zinc-800 dark:text-zinc-100">
              전일 대비 증감
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              기준일 {dodMeta.yesterdayDate} vs {dodMeta.prevDate} (지점·시·도 합계)
            </p>
            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
              <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                시·도 (변화 큰 순)
              </div>
              {sidoDayOver.slice(0, 8).map((row) => (
                <div
                  key={row.sido}
                  className="flex items-center justify-between gap-2 rounded bg-white/90 px-2 py-0.5 dark:bg-zinc-900/80"
                >
                  <span className="truncate text-zinc-700 dark:text-zinc-200">{row.sido}</span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      row.delta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : row.delta < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {row.delta > 0 ? "↑" : row.delta < 0 ? "↓" : "→"}{" "}
                    {row.delta > 0 ? "+" : ""}
                    {row.delta.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-zinc-200 pt-2 dark:border-zinc-600">
              <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                지점 (변화 큰 순)
              </div>
              {[...summaries]
                .map((s) => ({
                  id: s.store.id,
                  name: s.store.name,
                  delta: storeDayDelta[s.store.id] ?? 0,
                }))
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .slice(0, 8)
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded bg-white/90 px-2 py-0.5 dark:bg-zinc-900/80"
                  >
                    <span className="truncate text-zinc-700 dark:text-zinc-200">{row.name}</span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        row.delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.delta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {row.delta > 0 ? "↑" : row.delta < 0 ? "↓" : "→"}{" "}
                      {row.delta > 0 ? "+" : ""}
                      {row.delta.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 일일 / 기간 판매량 입력 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="store-sido-filter"
              className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              시/도 선택
            </label>
            <select
              id="store-sido-filter"
              value={selectedSido}
              onChange={(e) => {
                setSelectedSido(e.target.value);
                setSelectedStoreId("");
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
            >
              <option value="">전체 시/도</option>
              {KOREA_SIDO_LIST.map((sido) => (
                <option key={sido} value={sido}>
                  {sido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="store-picker"
              className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              지점 선택
            </label>
            <select
              id="store-picker"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
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
                  aria-pressed={mode === "single"}
                  aria-label="판매 입력 모드: 단일 일자"
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
                  aria-pressed={mode === "range"}
                  aria-label="판매 입력 모드: 기간 선택"
                >
                  기간 선택
                </button>
              </div>
              {mode === "single" ? (
                <div>
                  <label
                    htmlFor="sales-date-input"
                    className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    판매일자
                  </label>
                  <input
                    id="sales-date-input"
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label
                        htmlFor="range-start-input"
                        className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        시작일
                      </label>
                      <input
                        id="range-start-input"
                        type="date"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor="range-end-input"
                        className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        종료일
                      </label>
                      <input
                        id="range-end-input"
                        type="date"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
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
              <label
                htmlFor="sale-quantity-input"
                className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                {mode === "range" ? "기간 총 마리 수" : "판매 마리 수"}
              </label>
              <input
                id="sale-quantity-input"
                type="number"
                min={0}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={mode === "range" ? "예: 700" : "예: 100"}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
              />
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            <strong>팁:</strong> 지도에서 마커를 누르면 위 지점·판매일자가 맞춰지고, 지도 오른쪽 패널에서도 같은 값으로 바로 저장할 수 있습니다.
          </p>
          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
            aria-label="선택한 지점과 일자에 일일 판매량 저장"
          >
            일일 판매량 저장
          </button>
        </form>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              상단 <strong>기간</strong>, 위 폼의 <strong>시/도</strong>, <strong>지점 검색</strong>어가 CSV에
              반영됩니다. UTF-8(BOM)으로 엑셀에서 열 수 있습니다.
            </p>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={csvExportPending}
              className="shrink-0 rounded-lg border border-zinc-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              aria-label="필터가 적용된 지점 판매 데이터 CSV 다운로드"
              aria-busy={csvExportPending}
            >
              {csvExportPending ? "CSV 만드는 중…" : "CSV 다운로드"}
            </button>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-900/40">
            <p className="border-b border-zinc-200 px-2 py-1.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
              엑셀 붙여넣기용 표 (상단 기간·시/도·검색과 동일 필터)
            </p>
            <div className="max-h-48 overflow-auto">
              <table
                className="min-w-full border-collapse text-left text-[10px] text-zinc-800 dark:text-zinc-200"
                aria-label={`${periodLabelForChart} 기간 필터 적용 지점 판매 요약 표`}
              >
                <caption className="sr-only">
                  지점명, 지역, 연락처, 기간 누적 마리 수. 셀을 드래그해 엑셀에 붙여넣을 수 있습니다.
                </caption>
                <thead className="sticky top-0 z-[1] bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    <th scope="col" className="border border-zinc-200 px-2 py-1 font-semibold dark:border-zinc-600">
                      지점명
                    </th>
                    <th scope="col" className="border border-zinc-200 px-2 py-1 font-semibold dark:border-zinc-600">
                      지역
                    </th>
                    <th scope="col" className="border border-zinc-200 px-2 py-1 font-semibold dark:border-zinc-600">
                      연락처
                    </th>
                    <th scope="col" className="border border-zinc-200 px-2 py-1 font-semibold tabular-nums dark:border-zinc-600">
                      마리(누적)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStoreOptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-zinc-200 px-2 py-2 text-zinc-500 dark:border-zinc-600">
                        표시할 지점이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredStoreOptions.map((s) => (
                      <tr key={s.id}>
                        <td className="border border-zinc-200 px-2 py-1 dark:border-zinc-600">{s.name}</td>
                        <td className="border border-zinc-200 px-2 py-1 dark:border-zinc-600">{s.region}</td>
                        <td className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-600">
                          {s.managerPhone || "—"}
                        </td>
                        <td className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-600">
                          {s.totalQuantity.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DashboardCharts
            trendRows={chartRegion.trendRows}
            trendKeys={chartRegion.trendKeys}
            sigunguBars={chartRegion.sigunguBars}
            periodLabel={periodLabelForChart}
            loading={chartLoading}
            error={chartError}
            onRetry={fetchCharts}
          />
        </div>

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
                .filter((s) =>
                  storeMatchesSearchQuery(
                    {
                      name: s.name,
                      region: s.region,
                      managerPhone: s.managerPhone,
                    },
                    storeSearch,
                  ),
                )
                .slice(0, 20)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickStoreFromSearch(s.id)}
                    className="flex w-full items-center justify-between gap-2 rounded bg-white/80 px-2 py-1 text-left text-[11px] shadow-sm hover:bg-red-100/50 dark:bg-zinc-900/80 dark:hover:bg-red-950/40"
                    aria-label={`케어 필요 지점 ${s.name} 선택`}
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
                  </button>
                ))}
              {storeOptions.filter((s) => s.totalQuantity < careThreshold).filter((s) =>
                storeMatchesSearchQuery(
                  {
                    name: s.name,
                    region: s.region,
                    managerPhone: s.managerPhone,
                  },
                  storeSearch,
                ),
              ).length === 0 && (
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {storeOptions.filter((s) => s.totalQuantity < careThreshold).length === 0
                    ? "현재 케어 필요 지점이 없습니다."
                    : "검색 조건에 맞는 케어 지점이 없습니다."}
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
            <label
              htmlFor="edit-sales-date-input"
              className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              수정할 일자
            </label>
            <input
              id="edit-sales-date-input"
              type="date"
              value={editSalesDate}
              onChange={(e) => setEditSalesDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
            />
          </div>
          <div>
            <label
              htmlFor="edit-quantity-input"
              className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              새 판매 마리 수
            </label>
            <input
              id="edit-quantity-input"
              type="number"
              min={0}
              step={1}
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="예: 120"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
            aria-label="선택한 지점·일자의 판매 마리 수 수정 저장"
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
          aria-label="지도 영역"
          className={
            isMapOpen
              ? "relative flex min-h-[45dvh] flex-1 flex-col bg-zinc-50 dark:bg-zinc-950 md:min-h-0"
              : "hidden"
          }
        >
        <div
          className={`relative min-h-0 flex-1 ${
            isMapOpen ? "min-h-[45dvh] md:min-h-0" : "h-0 overflow-hidden"
          }`}
        >
          {isMapOpen && (
            <RegionMapInner
              summaries={mapDisplaySummaries}
              onDeleteStore={handleDeleteStore}
              onStoreSelect={setSelectedMapStoreId}
              mapFilterDate={mapFilterDate}
              storeDayDelta={storeDayDelta}
              searchMatchIds={searchMatchIdSet}
              flyTo={flyToStore}
            />
          )}

          {/* 지도 위 선택 지점 일별 판매 패널 */}
          {isMapOpen && selectedMapStoreId && (
              <div
                className="pointer-events-auto absolute right-2 top-2 z-[500] w-[min(100vw-1rem,18.5rem)] max-w-[18.5rem] rounded-xl border border-zinc-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 sm:right-3 sm:top-3"
                role="dialog"
                aria-label="지도에서 선택한 지점 일별 판매 빠른 입력"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                    일별 판매 · 빠른 입력
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMapStoreId(null)}
                    className="rounded px-1 text-xs text-zinc-400 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:hover:text-zinc-200"
                    aria-label="일별 판매 패널 닫기"
                  >
                    닫기
                  </button>
                </div>
                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {summaries.find((s) => s.store.id === selectedMapStoreId)?.store.name ?? "지점"}{" "}
                  · 왼쪽 「지점 선택」·「일일 판매량 저장」과 동기화됩니다. 날짜·마리 수 입력 후{" "}
                  <strong>저장</strong>하면 신규 등록·수정 모두 반영됩니다.
                </div>

                <label
                  htmlFor="map-detail-date-input"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  날짜
                </label>
                <input
                  id="map-detail-date-input"
                  type="date"
                  value={detailDate}
                  onChange={(e) => setDetailDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                />

                <div className="mt-2 min-h-[1.5rem] text-sm" role="status" aria-live="polite">
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

                <label
                  htmlFor="map-detail-quantity-input"
                  className="mt-3 mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  판매 마리 수 (등록·수정)
                </label>
                <input
                  id="map-detail-quantity-input"
                  type="number"
                  min={0}
                  step={1}
                  value={detailEditQuantity}
                  onChange={(e) => setDetailEditQuantity(e.target.value)}
                  placeholder="예: 120 — 바로 입력 후 저장"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleMapDetailSave}
                    className="flex-1 rounded-lg bg-amber-500 py-2 text-center text-xs font-semibold text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
                    aria-label="지도에서 선택한 일자 일일 판매 마리 수 저장"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={handleMapDetailDelete}
                    className="flex-1 rounded-lg border border-red-500 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/30"
                    aria-label="지도에서 선택한 일자 판매 데이터 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
          )}
        </div>
        </main>
      </div>

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
                  setReportMarkdown("");
                  setReportError(null);
                }}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4">
              <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                OpenAI로 스트리밍 생성됩니다. 네트워크가 끊기면 「다시 시도」를 눌러 주세요.
              </p>
              {reportError && !reportPending && (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-red-600 dark:text-red-400">{reportError}</p>
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    className="rounded-lg border border-red-600 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 dark:border-red-500 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-zinc-800"
                    aria-label="AI 리포트 다시 생성"
                  >
                    다시 시도
                  </button>
                </div>
              )}
              {reportPending && reportMarkdown === "" && !reportError && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
                  스트림 연결 중… 집계 데이터를 전송했습니다.
                </p>
              )}
              {(reportMarkdown.length > 0 || (!reportPending && !reportError)) && (
                <div
                  className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                  aria-live="polite"
                  aria-busy={reportPending}
                >
                  {reportMarkdown.length > 0 ? (
                    <>
                      {reportMarkdown}
                      {reportPending ? (
                        <span
                          className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-amber-500 align-middle"
                          aria-hidden
                        />
                      ) : null}
                    </>
                  ) : !reportPending && !reportError ? (
                    <span className="text-zinc-400">생성된 텍스트가 없습니다.</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 신규 지점 추가 모달 */}
      {isStoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-store-modal-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <h2
              id="new-store-modal-title"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              신규 지점 추가
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              지점명과 시/도, 구 단위 정보를 입력하면 됩니다.
            </p>
            <form onSubmit={handleCreateStore} className="mt-4 flex flex-col gap-3">
              <div>
                <label
                  htmlFor="new-store-name-input"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  지점명
                </label>
                <input
                  id="new-store-name-input"
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="예: 더레스트마린점"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="new-store-phone-input"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  지점장 연락처
                </label>
                <input
                  id="new-store-phone-input"
                  type="tel"
                  value={newStoreManagerPhone}
                  onChange={(e) => setNewStoreManagerPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="new-store-sido-select"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  시/도
                </label>
                <select
                  id="new-store-sido-select"
                  value={selectedSido}
                  onChange={(e) => setSelectedSido(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                >
                  <option value="">시/도를 선택하세요</option>
                  {KOREA_SIDO_LIST.map((sido) => (
                    <option key={sido} value={sido}>
                      {sido}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="new-store-gu-input"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  구 단위 (예: 해운대구)
                </label>
                <input
                  id="new-store-gu-input"
                  type="text"
                  value={newStoreRegion}
                  onChange={(e) => setNewStoreRegion(e.target.value)}
                  placeholder="예: 해운대구"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-offset-zinc-900"
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label="신규 지점 추가 취소"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                  aria-label="신규 지점 저장"
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

