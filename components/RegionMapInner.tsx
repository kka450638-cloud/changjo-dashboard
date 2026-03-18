"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { StoreSalesSummary } from "@/lib/types/store";

function createBadgeIcon(name: string, quantity: number) {
  // 판매 마리 수에 따라 배지 크기 스케일 조정
  const q = quantity ?? 0;
  let scale = 1;
  if (q >= 1000) scale = 1.6;
  else if (q >= 500) scale = 1.4;
  else if (q >= 200) scale = 1.25;
  else if (q >= 100) scale = 1.15;

  const html = `
    <div class="inline-flex items-center justify-center rounded-full bg-amber-500 shadow-lg px-3 py-1 border border-amber-600 text-xs md:text-sm font-semibold text-white whitespace-nowrap"
         style="transform: scale(${scale}); transform-origin: center;">
      <span class="mr-1">${name}</span>
      <span class="opacity-80">/ ${quantity.toLocaleString()}마리</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "store-sales-marker",
    iconSize: [0, 0],
  });
}

type Props = {
  summaries: StoreSalesSummary[];
  onDeleteStore: (id: string) => void;
  onStoreSelect?: (storeId: string) => void;
};

export default function RegionMapInner({ summaries, onDeleteStore, onStoreSelect }: Props) {
  const defaultCenter: [number, number] = [35.1631, 129.1635]; // 부산 해운대 근처
  const defaultZoom = 11;

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

      {summaries.map(({ store, totalQuantity }) => (
        <Marker
          key={store.id}
          position={[store.lat, store.lng]}
          icon={createBadgeIcon(store.name, totalQuantity)}
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
              {store.managerPhone && (
                <div className="text-zinc-500 dark:text-zinc-400">
                  지점장: <span className="font-medium">{store.managerPhone}</span>
                </div>
              )}
              <div className="text-amber-700 dark:text-amber-300">
                선택한 기간 누적: {totalQuantity.toLocaleString()}마리
              </div>
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
      ))}
    </MapContainer>
  );
}

