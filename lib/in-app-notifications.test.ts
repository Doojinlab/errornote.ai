import { describe, it, expect } from 'vitest'
import { buildWeeklyReportNotificationCopy } from './in-app-notifications'

describe('buildWeeklyReportNotificationCopy() — 무벌점 톤', () => {
  it('활동이 있으면(세션>0) 제안 도착 톤 + headline 을 body 로', () => {
    const copy = buildWeeklyReportNotificationCopy({ totalSessions: 3, headline: '把자문이 좋아지고 있어요' })
    expect(copy.title).toContain('학습 제안')
    expect(copy.body).toBe('把자문이 좋아지고 있어요')
  })

  it('활동이 없으면(세션 0) 복귀 환영 톤 — 탓하지 않음', () => {
    const copy = buildWeeklyReportNotificationCopy({ totalSessions: 0, headline: '' })
    expect(copy.title).toContain('반가워')
    // 죄책감/벌점 어휘가 없어야 한다.
    const text = `${copy.title} ${copy.body}`
    expect(text).not.toMatch(/실패|놓쳤|벌점|경고|부족|게을/)
  })

  it('headline 이 비면 무벌점 기본 격려 문구로 대체', () => {
    const withSessions = buildWeeklyReportNotificationCopy({ totalSessions: 5 })
    expect(withSessions.body.length).toBeGreaterThan(0)
    const noSessions = buildWeeklyReportNotificationCopy({ totalSessions: 0 })
    expect(noSessions.body).toContain('한 문장')
  })

  it('headline 의 공백을 trim 한다', () => {
    const copy = buildWeeklyReportNotificationCopy({ totalSessions: 1, headline: '  좋아요  ' })
    expect(copy.body).toBe('좋아요')
  })
})
