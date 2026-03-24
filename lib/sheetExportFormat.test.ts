import { describe, expect, it } from "vitest";
import {
  buildSheetAppendValues,
  buildSheetValueRows,
  SHEET_EXPORT_HEADERS,
} from "./sheetExportFormat";
import type { StoreSalesSummary } from "./types/store";

const sampleSummary: StoreSalesSummary = {
  store: {
    id: "u1",
    name: "테스트점",
    region: "서울 강남구",
    managerPhone: "010-0000-0000",
    lat: 37.5,
    lng: 127.0,
    created_at: "",
  },
  totalQuantity: 42,
};

describe("sheetExportFormat", () => {
  it("buildSheetValueRows matches header order and types", () => {
    const at = new Date("2025-03-17T12:00:00.000Z");
    const rows = buildSheetValueRows([sampleSummary], "1w", at);
    expect(rows).toEqual([
      [
        "2025-03-17T12:00:00.000Z",
        "u1",
        "테스트점",
        "서울 강남구",
        "010-0000-0000",
        42,
        "1w",
      ],
    ]);
  });

  it("buildSheetAppendValues prepends header row by default", () => {
    const at = new Date("2025-03-17T12:00:00.000Z");
    const values = buildSheetAppendValues([sampleSummary], "1m", {
      exportedAt: at,
    });
    expect(values[0]).toEqual([...SHEET_EXPORT_HEADERS]);
    expect(values).toHaveLength(2);
  });

  it("buildSheetAppendValues can omit header", () => {
    const at = new Date("2025-03-17T12:00:00.000Z");
    const values = buildSheetAppendValues([sampleSummary], "all", {
      includeHeader: false,
      exportedAt: at,
    });
    expect(values).toHaveLength(1);
    expect(values[0]?.[6]).toBe("all");
  });
});
