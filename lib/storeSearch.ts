/** 숫자만 추출 (전화번호 검색용) */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export type StoreSearchFields = {
  name: string;
  region: string;
  managerPhone: string;
};

function normalizeWs(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** 토큰이 전화 일부로 보이면 true (숫자 3자리 이상, 허용 문자만) */
function tokenLooksLikePhoneChunk(t: string): boolean {
  const d = digitsOnly(t);
  if (d.length < 3) return false;
  return /^[\d\s\-+().]+$/u.test(t.trim());
}

/**
 * 지점명·지역·지점장 연락처 검색
 * - 공백으로 나뉜 단어는 모두 만족(AND). 예: "부산 해운대" → 지역이 "부산광역시 해운대구"여도 매칭
 * - 연속 부분 문자열 1회 매칭(공백 포함·무공백 압축) 시 통과
 * - 숫자·하이픈 등만 있는 검색어는 전화번호 숫자열에 부분 일치
 */
export function storeMatchesSearchQuery(
  s: StoreSearchFields,
  qRaw: string,
): boolean {
  const qTrim = qRaw.trim();
  if (!qTrim) return true;

  const name = String(s.name ?? "");
  const region = String(s.region ?? "");
  const phone = String(s.managerPhone ?? "");
  const phoneDigits = digitsOnly(phone);
  const haystack = normalizeWs(`${name} ${region} ${phone}`).toLowerCase();
  const qLower = normalizeWs(qTrim).toLowerCase();

  if (haystack.includes(qLower)) return true;

  const compactHay = haystack.replace(/\s/g, "");
  const compactQ = qLower.replace(/\s/g, "");
  if (compactQ.length > 0 && compactHay.includes(compactQ)) return true;

  const qDigitsFull = digitsOnly(qTrim);
  if (
    qDigitsFull.length >= 3 &&
    qTrim.replace(/[\d\s\-+().]/gu, "").length === 0
  ) {
    if (phoneDigits.includes(qDigitsFull)) return true;
  }

  const tokens = qTrim
    .normalize("NFC")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return false;

  for (const t of tokens) {
    if (tokenLooksLikePhoneChunk(t)) {
      const td = digitsOnly(t);
      if (!phoneDigits.includes(td)) return false;
    } else {
      const tl = normalizeWs(t).toLowerCase();
      if (!tl) continue;
      if (!haystack.includes(tl) && !compactHay.includes(tl.replace(/\s/g, ""))) {
        return false;
      }
    }
  }

  return true;
}
