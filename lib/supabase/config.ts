/**
 * Supabase 공개 환경 변수 검증
 * - Error Boundary(`app/error.tsx`)는 메시지에 이 태그가 있으면 전용 UI를 표시합니다.
 */

export const SUPABASE_CONFIG_ERROR_TAG = "[SUPABASE_CONFIG]";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

/** createClient() 호출 전 검증 실패 시 throw */
export class SupabaseConfigError extends Error {
  override readonly name = "SupabaseConfigError";

  constructor() {
    super(
      `${SUPABASE_CONFIG_ERROR_TAG} .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해 주세요. (.env.local.example 참고)`,
    );
  }
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigError();
  }
}

/** assert 이후 url·anon 키 반환 (이미 trim 됨) */
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  assertSupabaseConfigured();
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  };
}
