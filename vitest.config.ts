import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // jsdom gives us window, localStorage, MessageEvent, etc. for the
    // offline-queue / SoundManager / OfflineQueueFlusher tests. Pure-logic
    // lib tests don't touch the DOM globals so the upgrade is transparent.
    environment: 'jsdom',
    globals: true,
    // fake-indexeddb/auto patches global indexedDB onto the test runtime so
    // lib/offline-queue.ts works under vitest exactly like in a real browser.
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      // 커버리지 게이트는 단위 테스트 대상인 순수 비즈니스 로직(lib/)에만 적용한다.
      // UI(app/·components/)는 Playwright e2e 영역이라 unit coverage 에서 제외.
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/**/__tests__/**', 'lib/prompts/**'],
      reporter: ['text-summary'],
      // 회귀 게이트(#51): 현재 lib/ 커버리지를 *바닥*으로 고정한다. 커버리지가 이 아래로
      // 떨어지면(=테스트 없는 코드 유입) CI 가 막는다. 테스트가 쌓이면 이 값을 점진적으로
      // 올린다(ratchet). 2026-06 측정값: stmts 39.4 / branch 30.8 / func 41.1 / lines 40.6.
      // (lti-*·tutor-stream·web-push-client·api-* 등 단위 테스트 누적 → 임계 상향. 측정값 대비 ~2~3% 헤드룸.)
      thresholds: {
        statements: 37,
        branches: 28,
        functions: 38,
        lines: 38
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
