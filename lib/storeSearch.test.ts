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

  it("공백으로 나뉜 지역 키워드는 행정구역 전체 문장과 달라도 AND 매칭", () => {
    const busan = {
      name: "해운대점",
      region: "부산광역시 해운대구",
      managerPhone: "010-2000-3000",
    };
    expect(storeMatchesSearchQuery(busan, "부산 해운대")).toBe(true);
    expect(storeMatchesSearchQuery(busan, "부산 해운대구")).toBe(true);
    expect(storeMatchesSearchQuery(busan, "서울 강남")).toBe(false);
  });

  it("하이픈 포함 전화번호 전체 검색", () => {
    expect(storeMatchesSearchQuery(base, "010-9999-8888")).toBe(true);
    expect(storeMatchesSearchQuery(base, "010 9999 8888")).toBe(true);
  });

  it("지역명 공백 없이 붙여 쓴 검색", () => {
    const row = {
      name: "점",
      region: "대구광역시 수성구",
      managerPhone: "",
    };
    expect(storeMatchesSearchQuery(row, "대구광역시수성구")).toBe(true);
  });
});
