 "use server";

import { createClient } from "@/lib/supabase/server";
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

  return data as Store;
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

  const stores = (storesData ?? []) as Store[];

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

