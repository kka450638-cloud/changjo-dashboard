/**
 * 관리자 번호 정책
 * - 프로덕션: ADMIN_ACCESS_CODE 필수 (미설정 시 로그인 불가)
 * - 개발: 미설정 시에만 테스트용 0000 허용
 */

export type ExpectedCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "production_missing" };

export function resolveExpectedAdminCode(
  env: NodeJS.ProcessEnv,
  nodeEnv: string | undefined,
): ExpectedCodeResult {
  const raw = env.ADMIN_ACCESS_CODE?.trim();
  if (raw) {
    return { ok: true, code: raw };
  }
  if (nodeEnv === "development") {
    return { ok: true, code: "0000" };
  }
  return { ok: false, reason: "production_missing" };
}

export function adminCodeErrorMessage(
  reason: Extract<ExpectedCodeResult, { ok: false }>,
): string {
  if (reason.reason === "production_missing") {
    return "운영 환경에서는 ADMIN_ACCESS_CODE 환경 변수가 필수입니다. 배포 설정을 확인하세요.";
  }
  return "관리자 번호 설정을 확인하세요.";
}
