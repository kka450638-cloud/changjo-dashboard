"use client";

import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { StoreSalesSummary } from "@/lib/types/store";
import { mapMarkerColorForRegion, sigunguLabelFromRegion } from "@/lib/regionColors";
import { spreadPositionsForSummaries } from "@/lib/mapMarkerSpread";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createBadgeIcon(
  name: string,
  quantity: number,
  opts?: {
    highlight?: boolean;
    mapFilterDate?: string | null;
    searchMatch?: boolean;
    searchDimmed?: boolean;
    /** 막대 그래프(시·도·구)와 동일 규칙의 배경색 */
    fillColor?: string;
  },
) {
  const q = quantity ?? 0;
  let scale = 1;
  if (q >= 1000) scale = 1.6;
  else if (q >= 500) scale = 1.4;
  else if (q >= 200) scale = 1.25;
  else if (q >= 100) scale = 1.15;

  const ring = opts?.searchMatch
    ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
    : opts?.highlight && q > 0
      ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
      : "";

  let opacityClass = "";
  if (opts?.searchDimmed) opacityClass = "opacity-35";
  else if (opts?.mapFilterDate && q === 0) opacityClass = "opacity-60";

  const bg = opts?.fillColor ?? "#d97706";
  const safeName = escapeHtml(name);

  const html = `
    <div class="inline-flex items-center justify-center rounded-full shadow-lg px-3 py-1 text-xs md:text-sm font-semibold whitespace-nowrap ${opacityClass} ${ring}"
         style="transform: scale(${scale}); transform-origin: center; background-color: ${bg}; border: 1px solid rgba(0,0,0,0.32); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">
      <span class="mr-1">${safeName}</span>
      <span style="opacity:0.88">/ ${quantity.toLocaleString()}마리</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "store-sales-marker",
    iconSize: [0, 0],
  });
}

function formatDelta(delta: number | undefined): { text: string; cls: string } {
  if (delta === undefined) return { text: "", cls: "" };
  if (delta === 0) return { text: "전일 대비 → 0", cls: "text-zinc-500" };
  if (delta > 0) {
    return {
      text: `전일 대비 ↑ +${delta.toLocaleString()}마리`,
      cls: "text-emerald-600 dark:text-emerald-400",
    };
  }
  return {
    text: `전일 대비 ↓ ${delta.toLocaleString()}마리`,
    cls: "text-red-600 dark:text-red-400",
  };
}

function MapFlyToTarget({
  flyTo,
  summaries,
  spreadPositions,
}: {
  flyTo: { id: string; nonce: number } | null;
  summaries: StoreSalesSummary[];
  spreadPositions: Map<string, { lat: number; lng: number }>;
}) {
  const map = useMap();
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!flyTo || flyTo.nonce === lastNonce.current) return;
    lastNonce.current = flyTo.nonce;
    const row = summaries.find((x) => x.store.id === flyTo.id);
    if (!row) return;
    const pos = spreadPositions.get(row.store.id);
    const lat = pos?.lat ?? row.store.lat;
    const lng = pos?.lng ?? row.store.lng;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), {
      duration: 0.75,
    });
  }, [flyTo, map, summaries, spreadPositions]);

  return null;
}

type Props = {
  summaries: StoreSalesSummary[];
  onDeleteStore: (id: string) => void;
  onStoreSelect?: (storeId: string) => void;
  mapFilterDate?: string | null;
  storeDayDelta?: Record<string, number>;
  /** 검색어가 있을 때 일치 지점 id — 지도에서 강조 / 비일치는 흐리게 */
  searchMatchIds?: Set<string> | null;
  /** 사이드바에서 지점 선택 시 해당 마커로 이동 */
  flyTo?: { id: string; nonce: number } | null;
};

export default function RegionMapInner({
  summaries,
  onDeleteStore,
  onStoreSelect,
  mapFilterDate,
  storeDayDelta,
  searchMatchIds,
  flyTo,
}: Props) {
  const defaultCenter: [number, number] = [35.1631, 129.1635];
  const defaultZoom = 11;
  /** null이면 검색 필터 없음(전부 동일 강조). Set이면 일치만 강조·나머지 흐림 */
  const hasSearchFilter = searchMatchIds != null;

  const { positions: spreadPositions, adjustedIds } = useMemo(
    () => spreadPositionsForSummaries(summaries),
    [summaries],
  );

  return (
    <MapContainer
      key="changjo-main-map"
      center={defaultCenter}
      zoom={defaultZoom}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />
      <MapFlyToTarget
        flyTo={flyTo ?? null}
        summaries={summaries}
        spreadPositions={spreadPositions}
      />

      {summaries.map(({ store, totalQuantity }) => {
        const delta = storeDayDelta?.[store.id];
        const { text: deltaText, cls: deltaCls } = formatDelta(delta);
        const highlight = Boolean(mapFilterDate && totalQuantity > 0);
        const inSearch = Boolean(searchMatchIds?.has(store.id));
        const searchMatch = hasSearchFilter && inSearch;
        const searchDimmed = hasSearchFilter && !inSearch;
        const fillColor = mapMarkerColorForRegion(store.region);
        const sigunguLabel = sigunguLabelFromRegion(store.region);
        const disp = spreadPositions.get(store.id) ?? {
          lat: store.lat,
          lng: store.lng,
        };

        return (
          <Marker
            key={`${store.id}-${totalQuantity}-${mapFilterDate ?? ""}-${searchMatch ? "m" : ""}-${fillColor}`}
            position={[disp.lat, disp.lng]}
            icon={createBadgeIcon(store.name, totalQuantity, {
              highlight,
              mapFilterDate: mapFilterDate ?? undefined,
              searchMatch,
              searchDimmed,
              fillColor,
            })}
            eventHandlers={{
              click: () => onStoreSelect?.(store.id),
            }}
          >
            <Popup eventHandlers={{ add: () => onStoreSelect?.(store.id) }}>
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-zinc-800 dark:text-zinc-100">{store.name}</div>
                <div className="text-zinc-500 dark:text-zinc-400">
                  {store.region ?? "지역 미지정"}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-zinc-300 dark:border-zinc-600"
                    style={{ backgroundColor: fillColor }}
                    title="막대 차트 시·도·구 구간과 동일 색"
                  />
                  <span>구간 색: {sigunguLabel}</span>
                </div>
                {adjustedIds.has(store.id) && (
                  <p className="text-[10px] leading-snug text-sky-700 dark:text-sky-300">
                    이 위치에 겹치는 지점이 있어, 지도에서만 옆으로 벌려 표시합니다. 실제 좌표(DB)는 그대로입니다.
                  </p>
                )}
                {store.managerPhone && (
                  <div className="text-zinc-500 dark:text-zinc-400">
                    지점장: <span className="font-medium">{store.managerPhone}</span>
                  </div>
                )}
                {mapFilterDate ? (
                  <div className="text-amber-700 dark:text-amber-300">
                    <span className="font-medium">{mapFilterDate}</span> 판매:{" "}
                    {totalQuantity.toLocaleString()}마리
                  </div>
                ) : (
                  <div className="text-amber-700 dark:text-amber-300">
                    선택한 기간 누적: {totalQuantity.toLocaleString()}마리
                  </div>
                )}
                {deltaText && (
                  <div className={`text-[11px] font-medium ${deltaCls}`}>{deltaText}</div>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteStore(store.id)}
                  className="mt-2 inline-flex items-center rounded border border-red-500 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  지점 삭제
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
