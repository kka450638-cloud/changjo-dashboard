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
