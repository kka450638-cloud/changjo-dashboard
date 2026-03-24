/** 숫자만 추출 (전화번호 검색용) */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export type StoreSearchFields = {
  name: string;
  region: string;
  managerPhone: string;
};

/**
 * 지점명·지역·지점장 연락처(부분/전체/숫자만)로 검색
 */
export function storeMatchesSearchQuery(
  s: StoreSearchFields,
  qRaw: string,
): boolean {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;

  if (s.name.toLowerCase().includes(q)) return true;
  if (s.region.toLowerCase().includes(q)) return true;
  if (s.managerPhone.toLowerCase().includes(q)) return true;

  const qDigits = digitsOnly(qRaw);
  const phoneDigits = digitsOnly(s.managerPhone);
  if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return true;

  return false;
}
