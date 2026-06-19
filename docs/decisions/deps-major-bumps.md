# 의존성 메이저 업그레이드 트리아지 (#53)

> 결정/추적 문서. `#45`(deps-audit-2026-05)에서 minor/patch만 적용하고 메이저는 보류했다.
> 각 메이저는 **별도 PR + 검증**으로 진행한다. 아래는 현재 상태(`npm outdated` 기준)와
> 패키지별 리스크·권장 순서다. 보안 fix는 아니므로 우선순위 Medium.

## 현황 (npm outdated)

| 패키지 | 현재 | 최신 | 종류 | 리스크 |
|---|---|---|---|---|
| `@supabase/ssr` | 0.5.2 | 0.12.0 | major | 중 — `lib/supabase.ts` 쿠키/세션 API |
| `react` / `react-dom` | 18.3.1 | 19.x | major | 높음 — 전역, `@types/react(-dom)` 동시 |
| `typescript` | 5.9.3 | 6.0.3 | major | 높음 — 전역 타입 추론 |
| `tailwindcss` | 3.4.19 | 4.x | major | 높음 — CSS-first config 전환 |
| `eslint` / `eslint-config-next` | 8 / 14 | 10 / 16 | major | 중 — flat config 의무 |
| `jsdom` | 25 | 29 | major | 낮음 — Vitest 환경 |
| `pdf-parse` | 1.1.4 | 2.4.5 | major | 중 — `lib/` PDF 파싱 API 변경 |
| `@types/node` | 20 | 25 | major(types) | 낮음 — Node LTS 동기화 |

### 범위 내(minor/patch) — lock 재생성 트랙
`^` 범위 안이라 package.json 변경 없이 lock 재생성 시 따라온다(별도 lock 정착 작업에서 처리):
`@playwright/test` 1.61 · `@supabase/supabase-js` 2.108 · `@vitest/coverage-v8`·`vitest` 4.1.9 ·
`next-intl` 4.13 · `@types/howler` 2.2.13 · `@types/react` 18.3.31 · `@types/node` 20.19.43.

## 권장 순서 (각 단독/묶음 PR + CI 그린)

1. **`jsdom` 25→29** — ✅ 완료(#89). Vitest 환경만 영향, 테스트 382 통과로 검증.
2. **`@types/node` 20→25** — 단독. **CI 런타임이 Node 20이므로 보류** — 런타임을 Node 22/24 LTS로
   올리는 결정 후 동시 진행(현 상태에서 types만 25로 올리면 런타임과 불일치).
3. **`eslint` 8→9/10 + `eslint-config-next` 14→16** — 묶음. flat config(`eslint.config.mjs`) 마이그레이션.
   - 비고: `next`는 이미 16(#52). `eslint-config-next` 16 정합. CI lint 게이트로 검증.
   - ⚠️ **lock 정착 선행 필수(실증됨)**: 2026-06-19 시도 시 드리프트된 lock 때문에 npm이
     `eslint@undefined`로 ERESOLVE 실패. lock 재생성 전에는 eslint 메이저 bump 불가.
4. **`@supabase/ssr` 0.5→0.12** — 단독. `lib/supabase.ts`의 `createServerClient`/쿠키 핸들러
   시그니처 회귀 검증 필수(런타임 확인).
5. **`pdf-parse` 1→2** — 단독. `lib/corpus-parser.ts` PDF 경로 회귀 테스트.
6. **`react` 18→19 + `@types/react(-dom)` 19** — 묶음. 전역. Next 16은 React 19 지원.
   - 영향: Server/Client 컴포넌트 전반, `use`/폼 액션 등. 빌드+e2e 검증.
7. **`tailwindcss` 3→4** — 단독. CSS-first config 전환(`@tailwind` 디렉티브 폐지,
   `tailwind.config.ts`→CSS). 시각 회귀 점검.
8. **`typescript` 5.9→6.0** — 단독(마지막). 전역 타입 추론 변화가 가장 광범위.

## 블로커 / 메모

- **[선행·필수] lock 정착**: 현재 `package-lock.json`이 package.json과 드리프트(#52 next 16 bump 후
  미재생성). 표준 npm으로 lock을 재생성하면 CI를 `npm install`→`npm ci`(엄격)로 승급 가능.
  **2026-06-19 eslint bump 시도가 이 드리프트로 ERESOLVE 실패** → lock 정착은 권장이 아니라
  **eslint·@supabase/ssr·pdf-parse·대형 bump의 하드 선행 조건**이다. 별도 PR로 먼저 처리할 것
  (`rm -rf node_modules package-lock.json && npm install` → typecheck/lint/test/build 검증).
- **@supabase/ssr·pdf-parse·react·tailwind·typescript**: typecheck만으로는 불충분(런타임/빌드/시각
  회귀 필요) → 실배포·staging 검증 단계에서 진행. `docs/verification-runbook.md` 참조.
- 각 PR은 `typecheck`/`lint`/`test:coverage` 게이트 통과 필수. react/tailwind는 빌드·시각 회귀까지.
- 우선순위 낮음 단계(1~2)부터 점진 진행 → 회귀 시 롤백 범위 최소화.

## 다음 단계 (수용 기준)

- [x] 메이저 후보 정리 문서화 (`docs/decisions/deps-major-bumps.md`) — 본 문서
- [x] 1번 `jsdom` 25→29 (#89)
- [ ] **lock 정착(선행) → `npm ci` 승급** — eslint 등 이후 bump의 하드 선행 조건
- [ ] eslint(+config-next) → @supabase/ssr → pdf-parse → react → tailwind → typescript 순차(lock 정착 후)
- [ ] lock 정착(표준 npm 재생성) → `npm ci` 승급
