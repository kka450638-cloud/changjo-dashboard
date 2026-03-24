/**
 * 시/도 드롭다운·지역 색상 기준으로 동일 순서 유지
 * (region 문자열 첫 토큰과 매칭)
 */
export const KOREA_SIDO_LIST = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원도",
  "충청북도",
  "충청남도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

export type KoreaSidoName = (typeof KOREA_SIDO_LIST)[number];

/**
 * DB·입력에 흔한 첫 토큰 약칭 → 드롭다운과 동일한 공식명 (KOREA_SIDO_LIST 값)
 */
const SIDO_FIRST_TOKEN_ALIASES: Record<string, KoreaSidoName> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전라북도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
  /** 구 명칭 변경 대비 */
  강원특별자치도: "강원도",
};

const OFFICIAL_SIDO_SET = new Set<string>(KOREA_SIDO_LIST as unknown as string[]);

/**
 * region 첫 토큰 또는 드롭다운 값을 공식 시/도 키로 맞춤 (필터·표시 일치용)
 */
export function normalizeSidoToken(token: string): string {
  const t = token.trim();
  if (!t) return t;
  if (OFFICIAL_SIDO_SET.has(t)) return t;
  const alias = SIDO_FIRST_TOKEN_ALIASES[t];
  if (alias) return alias;
  return t;
}

/**
 * stores.region 과 시/도 드롭다운 선택값이 같은 광역 행정구역인지 (약칭/공식명 혼용 허용)
 */
export function regionMatchesSidoFilter(
  region: string | null | undefined,
  sidoFilter: string,
): boolean {
  const sf = sidoFilter.trim();
  if (!sf) return true;
  const first =
    (region ?? "")
      .trim()
      .split(/\s+/)
      .find((p) => p.length > 0) ?? "";
  if (!first) return false;
  return normalizeSidoToken(first) === normalizeSidoToken(sf);
}
