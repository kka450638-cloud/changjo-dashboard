import type { PeriodKey } from "@/app/actions/sales";
import type { StoreSalesSummary } from "@/lib/types/store";

/** CSV와 동일 의미 컬럼 + 배치 시각(같은 보내기 묶음) */
export const SHEET_EXPORT_HEADERS = [
  "exported_at",
  "store_id",
  "store_name",
  "region",
  "manager_phone",
  "total_quantity_mari",
  "period_key",
] as const;

export function buildSheetValueRows(
  summaries: StoreSalesSummary[],
  period: PeriodKey,
  exportedAt: Date = new Date(),
): (string | number)[][] {
  const iso = exportedAt.toISOString();
  return summaries.map(({ store, totalQuantity }) => [
    iso,
    store.id,
    store.name,
    store.region ?? "",
    store.managerPhone ?? "",
    totalQuantity,
    period,
  ]);
}

/** 헤더 1행 + 데이터 (Sheets append 한 번에 넣기) */
export function buildSheetAppendValues(
  summaries: StoreSalesSummary[],
  period: PeriodKey,
  options?: { includeHeader?: boolean; exportedAt?: Date },
): (string | number)[][] {
  const includeHeader = options?.includeHeader !== false;
  const rows = buildSheetValueRows(
    summaries,
    period,
    options?.exportedAt ?? new Date(),
  );
  if (includeHeader) {
    return [[...SHEET_EXPORT_HEADERS], ...rows];
  }
  return rows;
}
