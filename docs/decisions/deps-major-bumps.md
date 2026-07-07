# 의존성 메이저 업그레이드 트리아지 (#53)

> 결정/추적 문서. `#45`(deps-audit-2026-05)에서 minor/patch만 적용하고 메이저는 보류했다.
> 각 메이저는 **별도 PR + 검증**으로 진행한다. 아래는 현재 상태(`npm outdated` 기준)와
> 패키지별 리스크·권장 순서다. 보안 fix는 아니므로 우선순위 Medium.

## ✅ 상태 업데이트 (2026-07-07)

문서 최초 작성 이후 대부분의 메이저 bump가 완료됐다. `package.json` 기준 현황:

| 패키지 | 문서작성시 | 현재 | 상태 |
|---|---|---|---|
| `jsdom` | 25 | 29 | ✅ 완료 (#89) |
| `eslint` / `eslint-config-next` | 8 / 14 | 9 / 16 | ✅ 완료 (flat config) |
| `pdf-parse` | 1.1.4 | 2.4.5 | ✅ 완료 |
| `react` / `react-dom` | 18.3.1 | 19.2.x | ✅ 완료 |
| `tailwindcss` | 3.4.19 | 4.3.x | ✅ 완료 |
| `typescript` | 5.9.3 | 6.0.3 | ✅ 완료 |
| `@supabase/ssr` | 0.5.2 | 0.10.3 | ◐ 부분 (→0.12 잔여) |
| `@types/node` | 20 | 24 | ◐ CI 런타임 Node 20과 불일치 |
| **lock 정착 → `npm ci`** | 드리프트 | 정착 | ✅ 완료 (`.github/workflows/ci.yml` = `npm ci`) |

**잔여 코드 작업(각각 단독 PR·직렬):**
1. `@supabase/ssr` 0.10 → 0.12 — `lib/supabase.ts` 쿠키/세션 시그니처 회귀 검증(런타임).
2. **CI 런타임 Node 20 → 22/24 LTS** — GitHub Actions 가 이미 Node 20 deprecation 으로
   워크플로를 Node 24에서 강제 실행 중(경고 발생). 아래 "메모: npm 메이저 불일치" 참조.

> 아래 원문(현황 표·권장 순서·블로커)은 이력 보존용이며, 최신 상태는 위 표가 권위다.

## 현황 (npm outdated, 문서 최초 작성 시점)

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

- **[✅ 완료] lock 정착**: package-lock 재생성 완료 → CI 가 `npm ci`(엄격·결정적) 사용 중.
  (이하 원문은 정착 이전 상황 기록.) 현재 `package-lock.json`이 package.json과 드리프트(#52 next 16 bump 후
  미재생성). 표준 npm으로 lock을 재생성하면 CI를 `npm install`→`npm ci`(엄격)로 승급 가능.
  **2026-06-19 eslint bump 시도가 이 드리프트로 ERESOLVE 실패** → lock 정착은 권장이 아니라
  **eslint·@supabase/ssr·pdf-parse·대형 bump의 하드 선행 조건**이다. 별도 PR로 먼저 처리할 것
  (`rm -rf node_modules package-lock.json && npm install` → typecheck/lint/test/build 검증).
- **@supabase/ssr·pdf-parse·react·tailwind·typescript**: typecheck만으로는 불충분(런타임/빌드/시각
  회귀 필요) → 실배포·staging 검증 단계에서 진행. `docs/verification-runbook.md` 참조.
- 각 PR은 `typecheck`/`lint`/`test:coverage` 게이트 통과 필수. react/tailwind는 빌드·시각 회귀까지.
- 우선순위 낮음 단계(1~2)부터 점진 진행 → 회귀 시 롤백 범위 최소화.
- **메모(2026-07-07, #130): npm 메이저 불일치 실증** — `@sentry/nextjs` 추가 시 로컬 npm 11
  이 생성한 lock 을 CI(Node 20 = npm 10)의 `npm ci` 가 `@swc/helpers@0.5.23` 중첩 항목 누락으로
  거부(EUSAGE)했다. 동일 npm 10 으로 lock 재생성해 해결. **CI Node 를 24(npm 11)로 올리면
  이 클래스의 lock-format 불일치가 사라진다** → 위 "잔여 2번(Node 런타임 bump)"의 추가 근거.

## 다음 단계 (수용 기준)

- [x] 메이저 후보 정리 문서화 (`docs/decisions/deps-major-bumps.md`) — 본 문서
- [x] 1번 `jsdom` 25→29 (#89)
- [x] **lock 정착 → `npm ci` 승급** — `.github/workflows/ci.yml` 이 `npm ci` 사용(엄격·결정적)
- [x] eslint(+config-next) 9/16 · pdf-parse 2 · react 19 · tailwind 4 · typescript 6 — 완료
- [ ] `@supabase/ssr` 0.10 → 0.12 (단독 PR, 런타임 회귀 검증)
- [ ] CI 런타임 Node 20 → 22/24 LTS + `@types/node` 정렬 (npm 메이저 정합 · lock-format 불일치 방지)
