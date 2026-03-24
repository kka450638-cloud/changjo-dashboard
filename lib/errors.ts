import { SUPABASE_CONFIG_ERROR_TAG } from "@/lib/supabase/config";

/** Error Boundary 등에서 Supabase 설정 오류인지 판별 */
export function isSupabaseConfigMessage(message: string | undefined): boolean {
  return Boolean(message?.includes(SUPABASE_CONFIG_ERROR_TAG));
}

/** 네트워크·일시적 장애로 추정되는 메시지 (재시도 안내용) */
export function looksLikeNetworkOrTimeoutError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    (m.includes("supabase") &&
      (m.includes("502") || m.includes("503") || m.includes("504")))
  );
}

export const RETRY_HINT_KO =
  "인터넷 연결을 확인한 뒤 아래 「다시 시도」를 눌러 주세요. Supabase·OpenAI 서버가 잠시 불안정할 수 있습니다.";

export const GENERIC_ERROR_HINT_KO =
  "문제가 계속되면 페이지를 새로고침하거나, 잠시 후 다시 시도해 주세요.";
