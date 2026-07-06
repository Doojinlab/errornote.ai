import { describe, it, expect } from 'vitest'
import {
  isStudentNavActive,
  STUDENT_NAV_GROUPS,
  type StudentNavGroupKey,
} from './studentNavGroups'

// 학생 NAV 활성 판정 + 그룹 정의 무결성 계약 테스트.
// 소스(studentNavGroups.ts)는 수정하지 않고, 로직/데이터 계약만 검증한다.
// (스타일·클래스명이 아니라 라우팅 규칙과 데이터 형태만 assert.)

describe('isStudentNavActive', () => {
  it('정확히 일치하는 경로를 활성으로 본다', () => {
    expect(isStudentNavActive('/errors', '/errors')).toBe(true)
    expect(isStudentNavActive('/settings', '/settings')).toBe(true)
  })

  it('하위 경로(href + "/...")를 활성으로 본다', () => {
    expect(isStudentNavActive('/errors/123', '/errors')).toBe(true)
    expect(isStudentNavActive('/assignments/42/submit', '/assignments')).toBe(true)
  })

  it('일치하지 않는 형제 경로는 비활성이다', () => {
    expect(isStudentNavActive('/vocabulary', '/errors')).toBe(false)
    expect(isStudentNavActive('/error-dex', '/errors')).toBe(false)
  })

  it('접두어가 같아도 경계(/)가 아니면 비활성이다', () => {
    // '/errorsss' 는 '/errors' 로 시작하지만 하위 경로가 아니다.
    expect(isStudentNavActive('/errorsss', '/errors')).toBe(false)
    expect(isStudentNavActive('/settings-backup', '/settings')).toBe(false)
  })

  describe('/learn 특례 (href="/learn/1")', () => {
    it('정적 챕터 href 자기 자신을 활성으로 본다', () => {
      expect(isStudentNavActive('/learn/1', '/learn/1')).toBe(true)
    })

    it('/learn 하위의 다른 챕터도 활성으로 본다', () => {
      expect(isStudentNavActive('/learn/2', '/learn/1')).toBe(true)
      expect(isStudentNavActive('/learn/12/quiz', '/learn/1')).toBe(true)
    })

    it('/learn 자체(베이스)도 활성으로 본다', () => {
      expect(isStudentNavActive('/learn', '/learn/1')).toBe(true)
    })

    it('/learn 을 접두어로 갖지만 경계가 아닌 경로는 비활성이다', () => {
      expect(isStudentNavActive('/learned', '/learn/1')).toBe(false)
    })

    it('무관한 경로는 비활성이다', () => {
      expect(isStudentNavActive('/errors', '/learn/1')).toBe(false)
    })
  })
})

describe('STUDENT_NAV_GROUPS 무결성', () => {
  const allItems = STUDENT_NAV_GROUPS.flatMap((g) => g.items)

  it('그룹 키가 중복되지 않는다', () => {
    const keys = STUDENT_NAV_GROUPS.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('그룹 키는 알려진 도메인 키 집합에 속한다', () => {
    const known: ReadonlyArray<StudentNavGroupKey> = [
      'study',
      'assignments',
      'play',
      'tools',
      'account',
    ]
    for (const g of STUDENT_NAV_GROUPS) {
      expect(known).toContain(g.key)
    }
  })

  it('모든 그룹은 최소 1개 이상의 항목을 가진다', () => {
    for (const g of STUDENT_NAV_GROUPS) {
      expect(g.items.length).toBeGreaterThan(0)
    }
  })

  it('항목 key(내비 식별자)가 전역적으로 중복되지 않는다', () => {
    const itemKeys = allItems.map((i) => i.key)
    expect(new Set(itemKeys).size).toBe(itemKeys.length)
  })

  it('href 가 전역적으로 중복되지 않는다', () => {
    const hrefs = allItems.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('모든 href 는 "/"로 시작하는 소문자 kebab 절대경로 형식이다 (locale 프리픽스·트레일링 슬래시 없음)', () => {
    // 앞뒤 슬래시 규칙: 선행 '/' 필수, 트레일링 '/' 금지, 세그먼트는 [a-z0-9-].
    const hrefPattern = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
    for (const item of allItems) {
      expect(item.href, `href 형식 위반: ${item.href}`).toMatch(hrefPattern)
      expect(item.href.startsWith('/'), `선행 슬래시 누락: ${item.href}`).toBe(true)
      expect(item.href.endsWith('/'), `트레일링 슬래시 금지: ${item.href}`).toBe(false)
      // ko('/') locale 프리픽스는 붙지 않아야 한다.
      expect(item.href).not.toMatch(/^\/(ko|en|ja)(\/|$)/)
    }
  })

  it('모든 항목 key 는 비어있지 않은 문자열이다', () => {
    for (const item of allItems) {
      expect(typeof item.key).toBe('string')
      expect(item.key.length).toBeGreaterThan(0)
    }
  })
})
