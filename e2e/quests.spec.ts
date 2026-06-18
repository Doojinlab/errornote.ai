/**
 * quests.spec.ts — 데일리 퀘스트(닫힘 루프) 페이지.
 *
 * student 프로젝트(사전 인증)에서 실행. 퀘스트는 서버에서 생성되며, 생성 실패 시
 * 페이지는 빈 상태로 폴백한다(500 없음). 따라서 제목/네비게이션의 존재만 결정적으로
 * 검증한다(미션 내용은 계정/AI 상태에 따라 가변).
 */
import { test, expect } from '@playwright/test'

test.describe('Daily quests', () => {
  test('퀘스트 페이지가 제목과 함께 로드된다', async ({ page }) => {
    await page.goto('/quests')
    await expect(page.getByRole('heading', { name: '오늘의 퀘스트' })).toBeVisible()
  })

  test('퀘스트 페이지는 미션 또는 빈 상태 중 하나를 보여준다(크래시 없음)', async ({ page }) => {
    await page.goto('/quests')
    // 미션 완료 버튼이 있거나, 빈 상태 안내문이 보여야 한다.
    const complete = page.getByRole('button', { name: '완료' })
    const empty = page.getByText('오늘의 퀘스트를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.')
    await expect(complete.first().or(empty)).toBeVisible()
  })

  test('학생 네비게이션에 퀘스트 링크가 있고 이동된다', async ({ page }) => {
    await page.goto('/learn/1')
    await page.getByRole('link', { name: '퀘스트' }).first().click()
    await expect(page).toHaveURL(/\/quests$/)
  })
})
