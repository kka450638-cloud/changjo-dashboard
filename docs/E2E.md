# E2E 테스트 (Playwright) 가이드

핵심 사용자 흐름 **로그인 → 대시보드 → (선택) 지점 등록**을 자동화하려면 Playwright를 권장합니다.

## 설치

```bash
npm install -D @playwright/test
npx playwright install
```

## 예시 설정 (`playwright.config.ts` 요약)

- `baseURL`: `http://localhost:3000`
- `webServer`: `npm run dev` 자동 기동(로컬 전용)
- `.env.local`에 테스트용 `ADMIN_ACCESS_CODE`, Supabase 키 필요

## 샘플 시나리오 (개념)

1. `/login` 접속 → 관리자 번호 입력 → 제출
2. `/` 에서 제목·지도 영역 노출 확인
3. (선택) 가맹점 등록 폼이 있는 페이지에서 주소 입력 후 제출

실제 셀렉터는 UI 변경 시 맞춰 조정하세요.

## CI

서버·DB·시크릿이 준비된 환경에서만 E2E를 돌리고, 그렇지 않으면 `test.skip` 또는 별도 워크플로로 분리하는 것이 안전합니다.
