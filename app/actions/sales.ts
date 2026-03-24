 "use server";

import { createClient } from "@/lib/supabase/server";
import { regionMatchesSidoFilter } from "@/lib/koreaSido";
import { storeFromSupabaseRow, type SupabaseStoreRow } from "@/lib/storeMapper";
import { storeMatchesSearchQuery } from "@/lib/storeSearch";
import type { Store, StoreSalesSummary } from "@/lib/types/store";

export type PeriodKey = "yesterday" | "1w" | "1m" | "6m" | "all";

function getFromDate(period: PeriodKey): string | null {
  const today = new Date();
  if (period === "all") return null;

  const d = new Date(today);
  if (period === "yesterday") d.setDate(d.getDate() - 1);
  if (period === "1w") d.setDate(d.getDate() - 7);
  if (period === "1m") d.setMonth(d.getMonth() - 1);
  if (period === "6m") d.setMonth(d.getMonth() - 6);

  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 구 단위 지오코딩 (예: "부산 해운대구")
// 국내만, 구/동 수준까지만 단순 변환 + 실패 시 대략적인 기본 좌표 사용
async function geocodeRegion(region: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: region.trim(), // 필요에 따라 "부산 해운대구" 등으로 확장 가능
    format: "json",
    limit: "1",
    countrycodes: "kr",
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "ChangjoDashboard/1.0" },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
}

// ---------- 지점 CRUD ----------

export async function createStore(params: {
  name: string;
  region: string;
  managerPhone?: string;
}) {
  const supabase = createClient();
  const { name, region, managerPhone } = params;

  // 지표 데이터 목적이라 좌표가 아주 정확할 필요는 없음.
  // 지오코딩이 실패하면 부산 해운대 근처 기본 좌표를 사용.
  const coords =
    (await geocodeRegion(region)) ?? {
      lat: 35.1631,
      lng: 129.1635,
    };

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: name.trim(),
      region: region.trim(),
      manager_phone: managerPhone?.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return storeFromSupabaseRow(data as SupabaseStoreRow);
}

export async function updateStore(params: {
  storeId: string;
  name: string;
  region: string;
  managerPhone?: string;
}) {
  const supabase = createClient();
  const { storeId, name, region, managerPhone } = params;
  const regionTrim = region.trim();
  const nameTrim = name.trim();
  if (!nameTrim || !regionTrim) {
    throw new Error("지점명과 지역을 입력해주세요.");
  }

  const { data: cur, error: curErr } = await supabase
    .from("stores")
    .select("lat, lng")
    .eq("id", storeId)
    .maybeSingle();

  if (curErr) throw new Error(curErr.message);
  if (!cur) throw new Error("지점을 찾을 수 없습니다.");

  const curRow = cur as { lat: number; lng: number };
  const coords =
    (await geocodeRegion(regionTrim)) ?? {
      lat: Number(curRow.lat),
      lng: Number(curRow.lng),
    };

  const { error } = await supabase
    .from("stores")
    .update({
      name: nameTrim,
      region: regionTrim,
      manager_phone: managerPhone?.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
    })
    .eq("id", storeId);

  if (error) throw new Error(error.message);
}

export async function deleteStore(storeId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) {
    throw new Error(error.message);
  }
}

// ---------- 일일 판매량 입력 ----------

export async function addSale(params: { storeId: string; salesDate: string; quantity: number }) {
  const supabase = createClient();
  const { storeId, salesDate, quantity } = params;

  const { error } = await supabase.from("sales_logs").insert({
    store_id: storeId,
    sales_date: salesDate,
    quantity,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// 기간 전체의 총 마리 수를 입력하면 일자별로 균등 분배해 저장
export async function addSaleRange(params: {
  storeId: string;
  startDate: string;
  endDate: string;
  quantity: number; // 기간 총 마리 수
}) {
  const supabase = createClient();
  const { storeId, startDate, endDate, quantity: totalQuantity } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("시작일과 종료일을 올바르게 입력해주세요.");
  }
  if (end < start) {
    throw new Error("종료일이 시작일보다 빠를 수 없습니다.");
  }

  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  if (dates.length === 0) return;

  const numDays = dates.length;
  const perDayFloor = Math.floor(totalQuantity / numDays);
  const remainder = totalQuantity - perDayFloor * numDays;

  const rows: { store_id: string; sales_date: string; quantity: number }[] = dates.map(
    (salesDate, i) => ({
      store_id: storeId,
      sales_date: salesDate,
      quantity: perDayFloor + (i < remainder ? 1 : 0),
    }),
  );

  const { error } = await supabase.from("sales_logs").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

// ---------- 지점·일자별 판매량 조회 / 삭제 (일별 보기용) ----------

export async function getSaleQuantityByStoreAndDate(
  storeId: string,
  salesDate: string,
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_logs")
    .select("quantity")
    .eq("store_id", storeId)
    .eq("sales_date", salesDate);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { quantity: number }[];
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

export async function deleteSalesByStoreAndDate(
  storeId: string,
  salesDate: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales_logs")
    .delete()
    .eq("store_id", storeId)
    .eq("sales_date", salesDate);
  if (error) throw new Error(error.message);
}

// ---------- 판매 마리수 수정 (지점 + 일자 기준) ----------

export async function updateSale(params: {
  storeId: string;
  salesDate: string;
  quantity: number;
}) {
  const supabase = createClient();
  const { storeId, salesDate, quantity } = params;

  const qty = Math.floor(Number(quantity));
  if (Number.isNaN(qty) || qty < 0) {
    throw new Error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
  }

  const { data, error } = await supabase
    .from("sales_logs")
    .update({ quantity: qty })
    .eq("store_id", storeId)
    .eq("sales_date", salesDate)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("해당 지점·일자의 판매 데이터가 없습니다. 먼저 일일 판매량을 입력해주세요.");
  }
}

/** 지도·빠른 입력용: 해당 일자 행이 없으면 insert, 있으면 update */
export async function upsertSaleForStoreDate(params: {
  storeId: string;
  salesDate: string;
  quantity: number;
}): Promise<void> {
  const supabase = createClient();
  const { storeId, salesDate, quantity } = params;
  const qty = Math.floor(Number(quantity));
  if (Number.isNaN(qty) || qty < 0) {
    throw new Error("판매 마리 수는 0 이상의 숫자로 입력해주세요.");
  }

  const { data: existing, error: selErr } = await supabase
    .from("sales_logs")
    .select("id")
    .eq("store_id", storeId)
    .eq("sales_date", salesDate)
    .limit(1);

  if (selErr) throw new Error(selErr.message);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("sales_logs")
      .update({ quantity: qty })
      .eq("store_id", storeId)
      .eq("sales_date", salesDate);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("sales_logs").insert({
    store_id: storeId,
    sales_date: salesDate,
    quantity: qty,
  });
  if (error) throw new Error(error.message);
}

// ---------- 기간별 합산 (모든 지점 + 0 포함) ----------

export async function getStoreSummaries(period: PeriodKey): Promise<StoreSalesSummary[]> {
  const supabase = createClient();
  const fromDate = getFromDate(period);

  // 1) 모든 지점 조회
  const { data: storesData, error: storesError } = await supabase
    .from("stores")
    .select("id, name, region, lat, lng, created_at, manager_phone")
    .order("created_at", { ascending: true });

  if (storesError) {
    // 테이블이 아직 생성되지 않은 초기 상태에서는 빈 결과로 처리
    if (storesError.message.includes("Could not find the table")) {
      return [];
    }
    throw new Error(storesError.message);
  }

  const stores = (storesData ?? []).map((row) =>
    storeFromSupabaseRow(row as SupabaseStoreRow),
  );

  // 2) 기간 내 판매 로그 조회
  let logsQuery = supabase.from("sales_logs").select("store_id, quantity, sales_date");
  if (fromDate) {
    logsQuery = logsQuery.gte("sales_date", fromDate);
  }

  const { data: logsData, error: logsError } = await logsQuery;
  if (logsError) {
    throw new Error(logsError.message);
  }

  type LogRow = {
    store_id: string;
    quantity: number;
    sales_date: string;
  };

  const logs = (logsData ?? []) as LogRow[];
  const totals = new Map<string, number>();

  for (const log of logs) {
    const prev = totals.get(log.store_id) ?? 0;
    totals.set(log.store_id, prev + log.quantity);
  }

  // 3) 모든 지점에 대해 합산 결과 매핑 (없으면 0마리)
  const summaries: StoreSalesSummary[] = stores.map((store) => ({
    store,
    totalQuantity: totals.get(store.id) ?? 0,
  }));

  return summaries;
}

// ---------- 캘린더용: 일자별 전체 합계 / 일자·지점별 합계 ----------

export type DailyTotal = {
  salesDate: string;
  totalQuantity: number;
};

export type DailyStoreTotal = {
  storeId: string;
  storeName: string;
  region: string | null;
  totalQuantity: number;
};

// 기간 내 모든 일자에 대해 전체 판매 합계 (모든 지점)
export async function getDailyTotals(params: {
  startDate: string;
  endDate: string;
}): Promise<DailyTotal[]> {
  const supabase = createClient();
  const { startDate, endDate } = params;

  const { data, error } = await supabase
    .from("sales_logs")
    .select("sales_date, quantity")
    .gte("sales_date", startDate)
    .lte("sales_date", endDate)
    .order("sales_date", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = { sales_date: string; quantity: number };
  const rows = (data ?? []) as Row[];

  const map = new Map<string, number>();
  for (const row of rows) {
    const d = row.sales_date;
    const prev = map.get(d) ?? 0;
    map.set(d, prev + row.quantity);
  }

  return Array.from(map.entries())
    .map(([salesDate, totalQuantity]) => ({ salesDate, totalQuantity }))
    .sort((a, b) => (a.salesDate < b.salesDate ? -1 : 1));
}

// 특정 일자의 지점별 판매 합계
export async function getDailyStoreTotals(
  salesDate: string,
): Promise<DailyStoreTotal[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales_logs")
    .select(
      `
      sales_date,
      quantity,
      store_id,
      stores (
        id,
        name,
        region
      )
    `,
    )
    .eq("sales_date", salesDate);

  if (error) throw new Error(error.message);

  type StoreJoin = { id: string; name: string; region: string | null };
  type RawRow = {
    sales_date?: unknown;
    quantity?: unknown;
    store_id?: unknown;
    stores?: unknown; // object | array | null
  };

  const rows = ((data ?? []) as RawRow[]).map((item) => {
    const rawStores = item.stores;
    let store: StoreJoin | null = null;

    if (rawStores && typeof rawStores === "object") {
      if (Array.isArray(rawStores)) {
        const first = rawStores[0] as any;
        if (first && typeof first === "object") {
          store = {
            id: String(first.id ?? ""),
            name: String(first.name ?? ""),
            region: first.region == null ? null : String(first.region),
          };
        }
      } else {
        const s = rawStores as any;
        store = {
          id: String(s.id ?? ""),
          name: String(s.name ?? ""),
          region: s.region == null ? null : String(s.region),
        };
      }
    }

    return {
      sales_date: String(item.sales_date ?? ""),
      quantity: Number(item.quantity ?? 0),
      store_id: String(item.store_id ?? ""),
      store,
    };
  });
  const map = new Map<
    string,
    { storeId: string; storeName: string; region: string | null; totalQuantity: number }
  >();

  for (const row of rows) {
    const store = row.store;
    if (!store || !store.id) continue;
    const key = store.id;
    const prev =
      map.get(key) ?? {
        storeId: store.id,
        storeName: store.name,
        region: store.region,
        totalQuantity: 0,
      };
    prev.totalQuantity += row.quantity;
    map.set(key, prev);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalQuantity - a.totalQuantity,
  );
}

// ---------- 전일 대비 (지점·시·도) / 특정일 지점별 수량 / 차트용 기간 ----------

/** 어제·그전날 YYYY-MM-DD (서버 로컬 달력 기준) */
function getYesterdayAndPrevDates(): { yesterday: string; prevDay: string } {
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const p = new Date(today);
  p.setDate(p.getDate() - 2);
  return {
    yesterday: y.toISOString().slice(0, 10),
    prevDay: p.toISOString().slice(0, 10),
  };
}

function parseSidoFromRegion(region: string | null | undefined): string {
  if (!region?.trim()) return "기타";
  const first = region.trim().split(/\s+/)[0];
  return first || "기타";
}

export type StoreDayOver = {
  storeId: string;
  yesterdayQty: number;
  prevDayQty: number;
  delta: number;
};

export type SidoDayOver = {
  sido: string;
  yesterdayQty: number;
  prevDayQty: number;
  delta: number;
};

/** 어제 vs 그전날 지점별·시도별 합계 */
export async function getDayOverDayComparison(): Promise<{
  yesterdayDate: string;
  prevDate: string;
  byStore: StoreDayOver[];
  bySido: SidoDayOver[];
}> {
  const supabase = createClient();
  const { yesterday, prevDay } = getYesterdayAndPrevDates();

  const { data: logRows, error: logError } = await supabase
    .from("sales_logs")
    .select("store_id, sales_date, quantity")
    .in("sales_date", [yesterday, prevDay]);

  if (logError) throw new Error(logError.message);

  type LogRow = { store_id: string; sales_date: string; quantity: number };
  const logs = (logRows ?? []) as LogRow[];

  const yMap = new Map<string, number>();
  const pMap = new Map<string, number>();
  for (const row of logs) {
    const sid = String(row.store_id ?? "");
    const q = Number(row.quantity ?? 0);
    if (!sid) continue;
    if (row.sales_date === yesterday) {
      yMap.set(sid, (yMap.get(sid) ?? 0) + q);
    } else if (row.sales_date === prevDay) {
      pMap.set(sid, (pMap.get(sid) ?? 0) + q);
    }
  }

  const { data: stores, error: storeError } = await supabase
    .from("stores")
    .select("id, region");

  if (storeError) throw new Error(storeError.message);

  type StoreRow = { id: string; region: string | null };
  const storeList = (stores ?? []) as StoreRow[];

  const byStore: StoreDayOver[] = storeList.map((s) => {
    const yesterdayQty = yMap.get(s.id) ?? 0;
    const prevDayQty = pMap.get(s.id) ?? 0;
    return {
      storeId: s.id,
      yesterdayQty,
      prevDayQty,
      delta: yesterdayQty - prevDayQty,
    };
  });

  const sidoY = new Map<string, number>();
  const sidoP = new Map<string, number>();
  for (const s of storeList) {
    const sido = parseSidoFromRegion(s.region);
    sidoY.set(sido, (sidoY.get(sido) ?? 0) + (yMap.get(s.id) ?? 0));
    sidoP.set(sido, (sidoP.get(sido) ?? 0) + (pMap.get(s.id) ?? 0));
  }

  const sidoKeys = new Set([...sidoY.keys(), ...sidoP.keys()]);
  const bySido: SidoDayOver[] = Array.from(sidoKeys).map((sido) => {
    const yesterdayQty = sidoY.get(sido) ?? 0;
    const prevDayQty = sidoP.get(sido) ?? 0;
    return { sido, yesterdayQty, prevDayQty, delta: yesterdayQty - prevDayQty };
  });
  bySido.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    yesterdayDate: yesterday,
    prevDate: prevDay,
    byStore,
    bySido,
  };
}

/** 특정 일자 지점별 판매 합계 (지도 필터용) */
export async function getQuantitiesByStoreForDate(
  salesDate: string,
): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_logs")
    .select("store_id, quantity")
    .eq("sales_date", salesDate);

  if (error) throw new Error(error.message);

  type Row = { store_id: string; quantity: number };
  const rows = (data ?? []) as Row[];
  const map: Record<string, number> = {};
  for (const row of rows) {
    const id = String(row.store_id ?? "");
    if (!id) continue;
    map[id] = (map[id] ?? 0) + Number(row.quantity ?? 0);
  }
  return map;
}

function getChartBoundsForPeriod(period: PeriodKey): { startStr: string; endStr: string } {
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  let startStr: string;
  if (period === "yesterday") {
    const s = new Date();
    s.setDate(s.getDate() - 7);
    startStr = s.toISOString().slice(0, 10);
  } else if (period === "all") {
    const s = new Date();
    s.setFullYear(s.getFullYear() - 1);
    startStr = s.toISOString().slice(0, 10);
  } else {
    const from = getFromDate(period);
    startStr = from ?? "1970-01-01";
  }
  return { startStr, endStr };
}

/** 선택 기간과 맞춘 일별 전체 판매 추이 (차트용). 전일만 선택 시 최근 7일 포함 */
export async function getDailyTotalsForChartPeriod(
  period: PeriodKey,
): Promise<DailyTotal[]> {
  const { startStr, endStr } = getChartBoundsForPeriod(period);
  return getDailyTotals({ startDate: startStr, endDate: endStr });
}

function regionStringFromStoresJoin(rawStores: unknown): string | null {
  if (rawStores == null || typeof rawStores !== "object") return null;
  if (Array.isArray(rawStores)) {
    const first = rawStores[0] as { region?: unknown } | undefined;
    if (first && typeof first === "object" && "region" in first) {
      return first.region == null ? null : String(first.region);
    }
    return null;
  }
  const s = rawStores as { region?: unknown };
  return s.region == null ? null : String(s.region);
}

function sidoFromRegionString(region: string | null): string {
  if (!region?.trim()) return "기타";
  const p = region.trim().split(/\s+/);
  return p[0] || "기타";
}

/** 시·도 + 구/군 (앞 두 토큰), 없으면 시·도만 */
function sigunguLabelFromRegionString(region: string | null): string {
  if (!region?.trim()) return "기타";
  const p = region.trim().split(/\s+/);
  if (p.length >= 2) return `${p[0]} ${p[1]}`;
  return p[0] || "기타";
}

function addOneCalendarDay(ymd: string): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + 1);
  const y2 = dt.getFullYear();
  const m2 = String(dt.getMonth() + 1).padStart(2, "0");
  const d2 = String(dt.getDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

function enumerateDateStrRange(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  let cur = startStr;
  let guard = 0;
  while (cur <= endStr && guard < 800) {
    out.push(cur);
    if (cur === endStr) break;
    cur = addOneCalendarDay(cur);
    guard += 1;
  }
  return out;
}

export type SigunguBarPoint = { label: string; total: number };

export type RegionChartSeriesPayload = {
  /** 멀티 라인용 (시·도별, 상위 N + 기타) */
  trendRows: Record<string, string | number>[];
  trendKeys: string[];
  /** 시·도·구 누적 막대 */
  sigunguBars: SigunguBarPoint[];
};

const TREND_TOP_SIDO = 8;
const BAR_TOP_SIGUNGU = 16;

/**
 * 차트용: 기간 내 일자×시·도 추이 + 시·도·구 누적 막대 (한 번에 조회)
 */
export async function getChartRegionSeries(
  period: PeriodKey,
): Promise<RegionChartSeriesPayload> {
  const { startStr, endStr } = getChartBoundsForPeriod(period);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales_logs")
    .select(
      `
      sales_date,
      quantity,
      stores ( region )
    `,
    )
    .gte("sales_date", startStr)
    .lte("sales_date", endStr);

  if (error) throw new Error(error.message);

  type RawRow = { sales_date?: unknown; quantity?: unknown; stores?: unknown };
  const byDateSido = new Map<string, Map<string, number>>();
  const totalsSido = new Map<string, number>();
  const totalsSigungu = new Map<string, number>();

  for (const item of (data ?? []) as RawRow[]) {
    const salesDate = String(item.sales_date ?? "");
    const q = Number(item.quantity ?? 0);
    if (!salesDate || q === 0) continue;
    const region = regionStringFromStoresJoin(item.stores);
    const sido = sidoFromRegionString(region);
    const sg = sigunguLabelFromRegionString(region);

    totalsSido.set(sido, (totalsSido.get(sido) ?? 0) + q);
    totalsSigungu.set(sg, (totalsSigungu.get(sg) ?? 0) + q);

    let dayMap = byDateSido.get(salesDate);
    if (!dayMap) {
      dayMap = new Map();
      byDateSido.set(salesDate, dayMap);
    }
    dayMap.set(sido, (dayMap.get(sido) ?? 0) + q);
  }

  const sortedSidos = [...totalsSido.entries()].sort((a, b) => b[1] - a[1]);
  const topSidoKeys = sortedSidos.slice(0, TREND_TOP_SIDO).map(([k]) => k);
  const topSet = new Set(topSidoKeys);

  let hasEtc = false;
  for (const smap of byDateSido.values()) {
    for (const [sido, qty] of smap) {
      if (!topSet.has(sido) && qty > 0) {
        hasEtc = true;
        break;
      }
    }
    if (hasEtc) break;
  }

  const trendKeys = hasEtc ? [...topSidoKeys, "기타"] : [...topSidoKeys];
  const allDates = enumerateDateStrRange(startStr, endStr);

  const trendRows: Record<string, string | number>[] = allDates.map((salesDate) => {
    const row: Record<string, string | number> = {
      salesDate,
      label: salesDate.slice(5),
    };
    const smap = byDateSido.get(salesDate);
    let etc = 0;
    for (const key of topSidoKeys) {
      row[key] = smap?.get(key) ?? 0;
    }
    if (hasEtc) {
      if (smap) {
        for (const [sido, qty] of smap) {
          if (!topSet.has(sido)) etc += qty;
        }
      }
      row["기타"] = etc;
    }
    return row;
  });

  const sigunguBars: SigunguBarPoint[] = [...totalsSigungu.entries()]
    .filter(([, t]) => t > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, BAR_TOP_SIGUNGU)
    .map(([label, total]) => ({ label, total }));

  return { trendRows, trendKeys, sigunguBars };
}

function csvEscapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 필터된 지점 목록 + 전체 지점 등록순 번호(1부터, created_at 오름차순) */
export type FilteredStoreExportPayload = {
  summaries: StoreSalesSummary[];
  registrationRankById: Map<string, number>;
};

/**
 * CSV 보내기와 동일한 필터로 지점별 판매 요약 목록
 */
export async function getFilteredStoreSummariesForExport(params: {
  period: PeriodKey;
  /** 시/도 드롭다운과 동일: region 첫 토큰 일치 */
  sidoFilter?: string;
  /** 지점 검색어(이름·지역·전화) */
  searchQuery?: string;
}): Promise<FilteredStoreExportPayload> {
  let summaries = await getStoreSummaries(params.period);

  const registrationRankById = new Map<string, number>(
    summaries.map((s, i) => [s.store.id, i + 1]),
  );

  if (params.sidoFilter?.trim()) {
    const sf = params.sidoFilter.trim();
    summaries = summaries.filter((s) =>
      regionMatchesSidoFilter(s.store.region, sf),
    );
  }

  if (params.searchQuery?.trim()) {
    const q = params.searchQuery;
    summaries = summaries.filter((s) =>
      storeMatchesSearchQuery(
        {
          name: s.store.name,
          region: s.store.region ?? "",
          managerPhone: s.store.managerPhone ?? "",
        },
        q,
      ),
    );
  }

  summaries.sort(
    (a, b) =>
      (registrationRankById.get(a.store.id) ?? 0) -
      (registrationRankById.get(b.store.id) ?? 0),
  );

  return { summaries, registrationRankById };
}

/**
 * 선택 기간 + (선택) 시/도·지점 검색 필터로 지점별 누적 판매 CSV (UTF-8 BOM, 엑셀 호환)
 */
export async function buildFilteredStoreSalesCsv(params: {
  period: PeriodKey;
  /** 시/도 드롭다운과 동일: region 첫 토큰 일치 */
  sidoFilter?: string;
  /** 지점 검색어(이름·지역·전화) */
  searchQuery?: string;
}): Promise<string> {
  const { summaries, registrationRankById } =
    await getFilteredStoreSummariesForExport(params);

  const headers = [
    "지점번호",
    "지점명",
    "지역",
    "담당연락처",
    "누적마리",
    "집계기간",
    "시스템ID",
  ];

  const lines = [
    headers.join(","),
    ...summaries.map(({ store, totalQuantity }) => {
      const no = registrationRankById.get(store.id) ?? "";
      return [
        csvEscapeField(String(no)),
        csvEscapeField(store.name),
        csvEscapeField(store.region ?? ""),
        csvEscapeField(store.managerPhone ?? ""),
        csvEscapeField(String(totalQuantity)),
        csvEscapeField(params.period),
        csvEscapeField(store.id),
      ].join(",");
    }),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

