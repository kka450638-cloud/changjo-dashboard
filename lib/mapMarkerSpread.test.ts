import { describe, it, expect } from "vitest";
import { spreadPositionsForSummaries } from "./mapMarkerSpread";
import type { StoreSalesSummary } from "./types/store";

function summary(
  id: string,
  lat: number,
  lng: number,
  region: string,
): StoreSalesSummary {
  return {
    store: {
      id,
      name: `store-${id}`,
      lat,
      lng,
      region,
      created_at: "2025-01-01T00:00:00Z",
    },
    totalQuantity: 10,
  };
}

describe("spreadPositionsForSummaries", () => {
  it("한 지점은 원래 좌표 유지", () => {
    const rows = [summary("a", 35.87, 128.6, "대구광역시 수성구")];
    const { positions, adjustedIds } = spreadPositionsForSummaries(rows);
    expect(positions.get("a")).toEqual({ lat: 35.87, lng: 128.6 });
    expect(adjustedIds.size).toBe(0);
  });

  it("동일 좌표 2지점은 벌어짐", () => {
    const rows = [
      summary("a", 35.87123, 128.60123, "대구광역시 수성구"),
      summary("b", 35.87123, 128.60123, "대구광역시 수성구"),
    ];
    const { positions, adjustedIds } = spreadPositionsForSummaries(rows);
    const pa = positions.get("a")!;
    const pb = positions.get("b")!;
    expect(adjustedIds.has("a")).toBe(true);
    expect(adjustedIds.has("b")).toBe(true);
    // 2지점은 동일 위도·반대 방향 경도로 벌어질 수 있음
    expect(pa.lat !== pb.lat || pa.lng !== pb.lng).toBe(true);
  });

  it("서로 다른 좌표는 각각 유지", () => {
    const rows = [
      summary("a", 35.87, 128.6, "A"),
      summary("b", 36.0, 129.0, "B"),
    ];
    const { positions, adjustedIds } = spreadPositionsForSummaries(rows);
    expect(positions.get("a")).toEqual({ lat: 35.87, lng: 128.6 });
    expect(positions.get("b")).toEqual({ lat: 36.0, lng: 129.0 });
    expect(adjustedIds.size).toBe(0);
  });

  it("4자리 반올림 기준으로 같은 셀에 묶이면 벌어짐", () => {
    const rows = [
      summary("a", 35.87124, 128.60124, "X"),
      summary("b", 35.87124999, 128.60124999, "Y"),
    ];
    const { adjustedIds } = spreadPositionsForSummaries(rows);
    expect(adjustedIds.size).toBe(2);
  });
});
