import { describe, it, expect } from "vitest";
import { digitsOnly, storeMatchesSearchQuery } from "./storeSearch";

describe("digitsOnly", () => {
  it("숫자만 남김", () => {
    expect(digitsOnly("010-1234-5678")).toBe("01012345678");
  });
  it("빈 문자열", () => {
    expect(digitsOnly("")).toBe("");
  });
});

describe("storeMatchesSearchQuery", () => {
  const base = {
    name: "수성점",
    region: "대구광역시 수성구",
    /** 본문에 "12"가 부분 문자열로 들어가지 않게 (짧은 숫자 테스트용) */
    managerPhone: "010-9999-8888",
  };

  it("빈 검색어는 항상 일치", () => {
    expect(storeMatchesSearchQuery(base, "")).toBe(true);
    expect(storeMatchesSearchQuery(base, "   ")).toBe(true);
  });

  it("지점명 부분 일치", () => {
    expect(storeMatchesSearchQuery(base, "수성")).toBe(true);
    expect(storeMatchesSearchQuery(base, "없는이름")).toBe(false);
  });

  it("지역 문자열 일치", () => {
    expect(storeMatchesSearchQuery(base, "수성구")).toBe(true);
    expect(storeMatchesSearchQuery(base, "대구")).toBe(true);
  });

  it("전화번호 일부(숫자)", () => {
    expect(storeMatchesSearchQuery(base, "8888")).toBe(true);
    expect(storeMatchesSearchQuery(base, "0109999")).toBe(true);
  });

  it("짧은 숫자 검색은 전화 매칭 안 함", () => {
    expect(storeMatchesSearchQuery(base, "12")).toBe(false);
  });
});
