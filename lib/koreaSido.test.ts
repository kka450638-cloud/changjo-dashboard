import { describe, expect, it } from "vitest";
import { normalizeSidoToken, regionMatchesSidoFilter } from "./koreaSido";

describe("regionMatchesSidoFilter", () => {
  it("matches official name in region to dropdown official name", () => {
    expect(
      regionMatchesSidoFilter("서울특별시 강남구", "서울특별시"),
    ).toBe(true);
  });

  it("matches short first token in region to full sido in dropdown", () => {
    expect(regionMatchesSidoFilter("서울 강남구", "서울특별시")).toBe(true);
    expect(regionMatchesSidoFilter("부산 해운대구", "부산광역시")).toBe(true);
  });

  it("returns true when filter empty (caller skips filter)", () => {
    expect(regionMatchesSidoFilter("서울 강남구", "")).toBe(true);
    expect(regionMatchesSidoFilter("서울 강남구", "   ")).toBe(true);
  });

  it("returns false for empty region when filter set", () => {
    expect(regionMatchesSidoFilter("", "서울특별시")).toBe(false);
    expect(regionMatchesSidoFilter(undefined, "서울특별시")).toBe(false);
  });
});

describe("normalizeSidoToken", () => {
  it("passes through official list values", () => {
    expect(normalizeSidoToken("경기도")).toBe("경기도");
  });

  it("expands common abbreviations", () => {
    expect(normalizeSidoToken("서울")).toBe("서울특별시");
    expect(normalizeSidoToken("경기")).toBe("경기도");
  });
});
