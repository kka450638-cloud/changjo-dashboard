"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Store } from "@/lib/types/store";

function getMarkerStyle(dailyCount: number | null | undefined) {
  const r = dailyCount ?? 0;
  if (r >= 300) return { color: "#D97706", fillColor: "#F59E0B", radius: 14, fillOpacity: 0.9 };
  if (r >= 150) return { color: "#EA580C", fillColor: "#FB923C", radius: 11, fillOpacity: 0.85 };
  if (r >= 50) return { color: "#F59E0B", fillColor: "#FCD34D", radius: 9, fillOpacity: 0.8 };
  return { color: "#78716c", fillColor: "#a8a29e", radius: 7, fillOpacity: 0.75 };
}

export default function StoreMap({ stores }: { stores: Store[] }) {
  const withCoords = stores.filter((s) => s.lat != null && s.lng != null) as (Store & { lat: number; lng: number })[];
  const defaultCenter: [number, number] = [37.5665, 126.978]; // 서울
  const defaultZoom = 11;

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="h-full w-full rounded-xl z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map((store) => {
        const style = getMarkerStyle(store.revenue);
        return (
          <CircleMarker
            key={store.id}
            center={[store.lat, store.lng]}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: style.fillOpacity,
              weight: 2,
            }}
            radius={style.radius}
          >
            <Popup>
              <div className="min-w-[200px] text-left">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">{store.name}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{store.address}</p>
                {store.category && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">{store.category}</p>
                )}
                {store.revenue != null && (
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-1">
                    일 판매 닭 수: {Number(store.revenue).toLocaleString()}마리
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
