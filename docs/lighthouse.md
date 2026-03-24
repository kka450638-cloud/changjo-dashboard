# Lighthouse (성능·접근성·SEO)

README에 적어 둔 **접근성(a11y)·성능** 주장을 뒷받침하려면, Chrome DevTools → **Lighthouse** 또는 CLI로 측정한 뒤 결과를 스크린샷으로 보관하는 것을 권장합니다.

## 권장 절차

1. 프로덕션 빌드 후 로컬 실행: `npm run build && npm start`
2. 시크릿 창에서 `/login` → 로그인 후 메인 대시보드까지 진입
3. Lighthouse에서 **Desktop** 또는 **Mobile** 선택 후 **Analyze page load**
4. **Performance / Accessibility / Best Practices / SEO** 점수 캡처
5. `docs/screenshots/` 에 `lighthouse-main.png` 등으로 저장 후 README 하단에 링크

## 목표 (참고)

- 접근성: 레이블·대비·이름 없는 버튼 없음을 유지할수록 90+ 달성이 수월합니다.
- SEO: 메타데이터(`app/layout.tsx` `metadata`)가 채워져 있으면 기본 점수가 올라갑니다.

CLI 예시 (Chrome 필요):

```bash
npx lighthouse http://localhost:3000 --only-categories=performance,accessibility,seo --view
```
