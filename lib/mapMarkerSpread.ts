import type { StoreSalesSummary } from "@/lib/types/store";

/**
 * 겹침 판별용 반올림 (4자리 ≈ 11m) — 지오코딩이 조금씩 달라도 한 덩어리로 묶음
 * 동일 5자리만 쓰면 문자열은 다른데 좌표만 같은 경우는 잡히지만, 소수 오차로 안 잡히는 경우가 있어 4자리 사용
 */
const CLUSTER_DECIMALS = 4;

function roundForCluster(n: number): number {
  const f = 10 ** CLUSTER_DECIMALS;
  return Math.round(n * f) / f;
}

/**
 * 위도 1° ≈ 111km — 기본 반경 약 130~150m, 뱃지(가로 긴 pill) 겹침 완화
 */
const R_BASE = 0.00125;

/** 가로 라벨이 길어 동서로 더 벌림 (남북은 상대적으로 작게) */
const EAST_SCALE = 1.75;
const NORTH_SCALE = 0.82;

export type SpreadPositionsResult = {
  positions: Map<string, { lat: number; lng: number }>;
  adjustedIds: Set<string>;
};

/**
 * 지도상 같은 위치(근접 좌표)에 있는 지점끼리 원형으로 벌려 겹침 방지.
 * 시·도·구 문자열은 보지 않음(표기 차이로 안 묶이는 문제 제거).
 */
export function spreadPositionsForSummaries(
  summaries: StoreSalesSummary[],
): SpreadPositionsResult {
  const positions = new Map<string, { lat: number; lng: number }>();
  const adjustedIds = new Set<string>();

  type Group = { rows: StoreSalesSummary[]; sumLat: number; sumLng: number };
  const groups = new Map<string, Group>();

  for (const row of summaries) {
    const { lat, lng } = row.store;
    const key = `${roundForCluster(lat)}|${roundForCluster(lng)}`;
    let g = groups.get(key);
    if (!g) {
      g = { rows: [], sumLat: 0, sumLng: 0 };
      groups.set(key, g);
    }
    g.rows.push(row);
    g.sumLat += lat;
    g.sumLng += lng;
  }

  for (const g of groups.values()) {
    const n = g.rows.length;
    if (n === 1) {
      const s = g.rows[0]!;
      positions.set(s.store.id, { lat: s.store.lat, lng: s.store.lng });
      continue;
    }

    const centerLat = g.sumLat / n;
    const centerLng = g.sumLng / n;
    const latRad = (centerLat * Math.PI) / 180;
    const cosLat = Math.max(0.35, Math.cos(latRad));

    const rawR = R_BASE * (0.85 + 0.28 * Math.max(0, n - 2));
    const radius = Math.min(rawR, 0.02);

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const north = NORTH_SCALE * radius * Math.cos(angle);
      const east =
        (EAST_SCALE * radius * Math.sin(angle)) / cosLat;
      const row = g.rows[i]!;
      const lat = centerLat + north;
      const lng = centerLng + east;
      positions.set(row.store.id, { lat, lng });
      adjustedIds.add(row.store.id);
    }
  }

  return { positions, adjustedIds };
}
