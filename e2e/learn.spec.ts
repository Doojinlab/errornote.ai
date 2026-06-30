/**
 * learn.spec.ts — Core learning flow (highest priority).
 *
 * Runs in the "student" Playwright project, which supplies a pre-authenticated
 * session via storageState (created by student.setup.ts).
 *
 * The /api/analyze endpoint is mocked with page.route() so no real LLM call
 * is made.  All Supabase REST queries that happen browser-side are also mocked.
 * Server component data (initial page render) uses real Supabase via the
 * saved session cookies — this is the normal Next.js SSR flow.
 */
import { test, expect } from '@playwright/test'
import { mockAnalyzeAPI, mockAnalyzeAPIError, MOCK_ANALYSIS_RESULT } from './helpers/mocks'
import {
  readRealLoopEnv,
  setupCoreLoopFixture,
  cleanupCoreLoopFixture,
  readGamification,
  CHINESE_DRAFT_WITH_ERRORS,
  XP_FOR_DRAFT,
  XP_FOR_ZERO_ERROR_REVISION,
  type CoreLoopFixture,
} from './helpers/real-loop'
import { adminClient } from './helpers/supabase-clients'

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Learn index redirect', () => {
  test('/learn redirects to a chapter page', async ({ page }) => {
    await page.goto('/learn')
    // The index page reads the last session from DB and redirects to /learn/:id
    await page.waitForURL(/\/learn\/\d+/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/learn\/\d+/)
  })
})

// ---------------------------------------------------------------------------
// Document editor
// ---------------------------------------------------------------------------

test.describe('Document editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('shows the contenteditable editor with correct aria-label', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await expect(editor).toBeVisible()
  })

  test('shows the chapter label', async ({ page }) => {
    await page.goto('/learn/1')
    await expect(page.getByText(/제1장/)).toBeVisible()
  })

  test('submit button is disabled when editor is empty', async ({ page }) => {
    await page.goto('/learn/1')
    // Clear any pre-loaded content
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.clear()
    await expect(page.getByRole('button', { name: '재진단' })).toBeDisabled()
  })

  test('student can type Chinese text in the editor', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await expect(editor).toContainText('我去学校了。')
  })

  test('submit button becomes enabled after typing', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await expect(page.getByRole('button', { name: '재진단' })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

test.describe('Analysis flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('clicking 재진단 shows loading state', async ({ page }) => {
    // Slow the response so the in-flight loading indicator is catchable
    await page.route('/api/analyze', async (route) => {
      await new Promise((r) => setTimeout(r, 400))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYSIS_RESULT),
      })
    })

    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('분석 중…')).toBeVisible()
  })

  test('error panel shows correct error count after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    const expectedCount = MOCK_ANALYSIS_RESULT.error_count
    await expect(
      page.getByText(new RegExp(`오류 카드 \\(${expectedCount}\\)`))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('annotated text view appears after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    // After analysis, the header switches to "분석 결과" and an edit link appears
    await expect(page.getByText('분석 결과')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('수정하기')).toBeVisible()
  })

  test('clicking 수정하기 returns to edit mode', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('분석 결과')).toBeVisible({ timeout: 10_000 })
    await page.getByText('수정하기').click()

    await expect(page.getByText('문서 작성')).toBeVisible()
    await expect(page.locator('[aria-label="중국어 문장 입력"]')).toBeVisible()
  })

  test('error panel shows overall feedback after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去학교了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('전체 피드백')).toBeVisible({ timeout: 10_000 })
  })

  test('API error is shown as an alert', async ({ page }) => {
    // Override the beforeEach mock with an error response
    await mockAnalyzeAPIError(page, '분석 요청에 실패했습니다.')

    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Mobile tab navigation
// ---------------------------------------------------------------------------

test.describe('Mobile tab navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('tab bar is visible on mobile', async ({ page }) => {
    await page.goto('/learn/1')
    await expect(page.locator('[aria-label="뷰 전환"]')).toBeVisible()
  })

  test('switching to 오류 tab changes active tab', async ({ page }) => {
    await page.goto('/learn/1')
    const errorsTab = page.locator('[aria-label="뷰 전환"] button').filter({ hasText: '오류' })
    await errorsTab.click()
    await expect(errorsTab).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to 채팅 tab changes active tab', async ({ page }) => {
    await page.goto('/learn/1')
    const chatTab = page.locator('[aria-label="뷰 전환"] button').filter({ hasText: '채팅' })
    await chatTab.click()
    await expect(chatTab).toHaveAttribute('aria-pressed', 'true')
  })
})

// ---------------------------------------------------------------------------
// Real end-to-end smoke (실 Claude + 실 Supabase) — NO mocking
// ---------------------------------------------------------------------------
//
// 위의 테스트들은 /api/analyze 를 page.route() 로 목킹해 빠른 회귀를 본다.
// 이 블록은 목킹 없이 과제 제출 라우트(/api/assignments/:id/submit)를 통해
//   제출 → 실 Claude 분석 → 오류카드 영속화 → XP 반영
// 까지를 단 1회의 실제 호출로 검증하는 "진짜" 스모크다.
//
// 비용·시간이 발생하므로 필요한 env(ANTHROPIC_API_KEY · Supabase · TEST_STUDENT_*)가
// 모두 있을 때만 돌고, 하나라도 없으면 전체 블록을 스킵한다 → CI 비결정성 방지.
// 모델 설정은 app/api/analyze 와 동일한 lib/analysis(lib/claude)를 공유한다.
//
// 셸에 실 키를 노출하고(예: .env.local 을 export) dev server 와 같은 env 로 실행해야
// "키 있음 → 실행 / 키 없음 → 스킵" 판정이 서버 실제 상태와 일치한다.

const realEnv = readRealLoopEnv()

test.describe('Core loop real smoke', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(
    !realEnv,
    'ANTHROPIC_API_KEY / Supabase / TEST_STUDENT_* 미설정 — 실호출 스모크 스킵'
  )

  let fixture: CoreLoopFixture | undefined

  test.beforeAll(async () => {
    if (!realEnv) return
    fixture = await setupCoreLoopFixture(realEnv)
  })

  test.afterAll(async () => {
    if (!realEnv || !fixture) return
    await cleanupCoreLoopFixture(realEnv, fixture)
  })

  test('제출→실 Claude 분석→오류카드→XP 반영이 실제로 동작한다', async ({ request }) => {
    // 실 Claude 응답까지 기다려야 하므로 기본 30s 타임아웃을 넉넉히 늘린다.
    test.setTimeout(120_000)
    // realEnv/fixture 는 위 skip·beforeAll 로 보장되지만 타입 좁힘을 위해 가드.
    if (!realEnv || !fixture) test.skip()
    const env = realEnv!
    const fx = fixture!
    const admin = adminClient(env)

    // 1) 과제 제출 — dev server 라우트가 실제 Claude 를 호출한다.
    const res = await request.post(`/api/assignments/${fx.assignmentId}/submit`, {
      data: { draftText: CHINESE_DRAFT_WITH_ERRORS, chapterNumber: 0 },
      timeout: 100_000,
    })
    expect(
      res.ok(),
      `submit 응답 실패: ${res.status()} ${await res.text()}`
    ).toBeTruthy()

    const body = (await res.json()) as {
      session_id: string
      error_count: number
      errors: unknown[]
      annotated_text: string
    }
    expect(typeof body.session_id).toBe('string')
    expect(body.session_id.length).toBeGreaterThan(0)
    expect(typeof body.error_count).toBe('number')
    expect(Array.isArray(body.errors)).toBe(true)
    // 응답 errors 길이와 집계 error_count 는 일치해야 한다.
    expect(body.errors).toHaveLength(body.error_count)

    // 2) 세션이 실제로 DB 에 영속화됐는지 확인.
    const { data: sessionRow, error: sErr } = await admin
      .from('sessions')
      .select('id, student_id, assignment_id')
      .eq('id', body.session_id)
      .single()
    expect(sErr).toBeNull()
    const session = sessionRow as {
      student_id: string
      assignment_id: string | null
    }
    expect(session.student_id).toBe(fx.studentId)
    expect(session.assignment_id).toBe(fx.assignmentId)

    // 3) 오류카드 — 응답 error_count 와 동일 개수로 영속화돼야 한다(파이프라인 일관성).
    const { data: cards, error: cErr } = await admin
      .from('error_cards')
      .select('id')
      .eq('session_id', body.session_id)
    expect(cErr).toBeNull()
    expect(cards ?? []).toHaveLength(body.error_count)

    // 4) XP 반영 — 오류 0 이면 보너스, 그 외 초고 제출 XP.
    const expectedDelta =
      body.error_count === 0 ? XP_FOR_ZERO_ERROR_REVISION : XP_FOR_DRAFT
    const after = await readGamification(admin, fx.studentId)
    expect(after.xp).toBe(fx.baselineXp + expectedDelta)
  })
})
