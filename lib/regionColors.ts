/**
 * 대시보드 차트·지도 마커 공통 색상
 * - 막대: 시·도·구 라벨 → 첫 토큰이 행정시도면 고정색, 아니면 해시
 * - 지도 마커: mapMarkerColorForRegion(store.region)
 * - 추이 라인: mapMarkerColorForRegion(시도키) — 같은 시·도는 지도(구 단위)와 동일 색
 *
 * 참고: 예전 단순 해시는 "대구광역시"와 "부산광역시"처럼 다른 이름이 같은 팔레트 슬롯으로
 * 충돌하는 경우가 있어, 17개 시·도는 고정 팔레트로 구분합니다.
 */

import { KOREA_SIDO_LIST } from "@/lib/koreaSido";

/** 라벨 문자열 해시용 (시·도 외 · 구만 있는 등 예외 라벨) */
const REGION_PALETTE = [
  "#d97706",
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#0d9488",
  "#ea580c",
  "#65a30d",
  "#e11d48",
  "#7c3aed",
  "#0284c7",
  "#b45309",
  "#52525b",
  "#c2410c",
  "#15803d",
  "#1d4ed8",
];

/** KOREA_SIDO_LIST 순서와 1:1 대응 — 서로 다른 색 */
const SIDO_DISTINCT_COLORS = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#6366f1",
  "#0d9488",
  "#65a30d",
  "#be123c",
  "#0369a1",
  "#a16207",
  "#0f766e",
  "#9f1239",
  "#4f46e5",
  "#c026d3",
] as const;

const SIDO_COLOR_BY_FIRST_TOKEN: Record<string, string> = Object.fromEntries(
  KOREA_SIDO_LIST.map((name, i) => [name, SIDO_DISTINCT_COLORS[i]!]),
);

function colorByDjb2Fallback(label: string): string {
  let h = 5381;
  for (let i = 0; i < label.length; i++) {
    h = (h * 33 + label.charCodeAt(i)) >>> 0;
  }
  return REGION_PALETTE[h % REGION_PALETTE.length]!;
}

export function colorForRegionLabel(label: string): string {
  const t = label.trim();
  if (!t) return "#71717a";
  if (t === "기타") return "#71717a";
  const first = t.split(/\s+/)[0] ?? "";
  const sidoColor = SIDO_COLOR_BY_FIRST_TOKEN[first];
  if (sidoColor) return sidoColor;
  return colorByDjb2Fallback(t);
}

/** stores.region → 막대 그래프와 동일 키 (앞 두 토큰 = 시·도·구) */
export function sigunguLabelFromRegion(region: string | null | undefined): string {
  if (!region?.trim()) return "기타";
  const p = region.trim().split(/\s+/);
  if (p.length >= 2) return `${p[0]} ${p[1]}`;
  return p[0] || "기타";
}

/** 지점 region 문자열 → 지도 마커/막대와 동일 색 */
export function mapMarkerColorForRegion(region: string | null | undefined): string {
  return colorForRegionLabel(sigunguLabelFromRegion(region));
}
