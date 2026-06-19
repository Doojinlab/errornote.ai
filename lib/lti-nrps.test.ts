import { describe, it, expect, vi } from 'vitest'
import {
  NRPS_ACCEPT,
  parseNrpsService,
  parseMembership,
  activeMembers,
  nextPageUrl,
  fetchMembershipPage,
  fetchAllMemberships,
} from './lti-nrps'

const INSTRUCTOR = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'
const LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'

describe('parseNrpsService', () => {
  it('context_memberships_url + service_versions 파싱', () => {
    expect(
      parseNrpsService({
        context_memberships_url: 'https://lms.test/ctx/1/memberships',
        service_versions: ['2.0'],
      })
    ).toEqual({ contextMembershipsUrl: 'https://lms.test/ctx/1/memberships', serviceVersions: ['2.0'] })
  })
  it('URL 없으면 null', () => {
    expect(parseNrpsService({ service_versions: ['2.0'] })).toBeNull()
    expect(parseNrpsService(null)).toBeNull()
  })
})

describe('parseMembership', () => {
  it('구성원 정규화 + 역할 판별', () => {
    const members = parseMembership({
      members: [
        { user_id: 'u1', name: '김교수', email: 'prof@uni.edu', roles: [INSTRUCTOR], status: 'Active' },
        { user_id: 'u2', name: '이학생', roles: [LEARNER], status: 'Active' },
      ],
    })
    expect(members).toHaveLength(2)
    expect(members[0]).toMatchObject({ userId: 'u1', isInstructor: true, isLearner: false, email: 'prof@uni.edu' })
    expect(members[1]).toMatchObject({ userId: 'u2', isLearner: true, isInstructor: false, email: null })
  })
  it('user_id 없는 항목·비배열은 제거/빈배열', () => {
    expect(parseMembership({ members: [{ name: 'x' }] })).toEqual([])
    expect(parseMembership({ members: 'nope' })).toEqual([])
    expect(parseMembership(null)).toEqual([])
  })
  it('status 기본값 Active', () => {
    expect(parseMembership({ members: [{ user_id: 'u', roles: [] }] })[0].status).toBe('Active')
  })
})

describe('activeMembers', () => {
  it('Active 만 남긴다', () => {
    const list = parseMembership({
      members: [
        { user_id: 'a', roles: [], status: 'Active' },
        { user_id: 'b', roles: [], status: 'Inactive' },
      ],
    })
    expect(activeMembers(list).map((m) => m.userId)).toEqual(['a'])
  })
})

describe('nextPageUrl', () => {
  it('rel="next" 추출', () => {
    expect(nextPageUrl('<https://lms.test/m?page=2>; rel="next"')).toBe('https://lms.test/m?page=2')
  })
  it('여러 rel 중 next 선택', () => {
    const h = '<https://lms.test/m?page=1>; rel="prev", <https://lms.test/m?page=3>; rel="next"'
    expect(nextPageUrl(h)).toBe('https://lms.test/m?page=3')
  })
  it('next 없거나 헤더 없으면 null', () => {
    expect(nextPageUrl('<https://lms.test/m>; rel="prev"')).toBeNull()
    expect(nextPageUrl(null)).toBeNull()
  })
})

function jsonResponse(body: unknown, link?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (link) headers['Link'] = link
  return new Response(JSON.stringify(body), { status: 200, headers })
}

describe('fetchMembershipPage', () => {
  it('Accept/Bearer 헤더로 GET, 구성원 + next 반환', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ members: [{ user_id: 'u1', roles: [LEARNER] }] }, '<https://lms.test/m?p=2>; rel="next"')
    ) as unknown as typeof fetch
    const res = await fetchMembershipPage({ url: 'https://lms.test/m', accessToken: 'tok', fetchFn })
    expect(res.members).toHaveLength(1)
    expect(res.next).toBe('https://lms.test/m?p=2')
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers.Accept).toBe(NRPS_ACCEPT)
    expect(call[1].headers.Authorization).toBe('Bearer tok')
  })
  it('비정상 응답이면 throw', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof fetch
    await expect(
      fetchMembershipPage({ url: 'https://lms.test/m', accessToken: 't', fetchFn })
    ).rejects.toThrow(/멤버십 조회 실패/)
  })
})

describe('fetchAllMemberships', () => {
  it('Link 를 따라 모든 페이지를 모은다', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === 'https://lms.test/m') {
        return jsonResponse({ members: [{ user_id: 'u1', roles: [] }] }, '<https://lms.test/m?p=2>; rel="next"')
      }
      return jsonResponse({ members: [{ user_id: 'u2', roles: [] }] })
    }) as unknown as typeof fetch
    const all = await fetchAllMemberships({ url: 'https://lms.test/m', accessToken: 't', fetchFn })
    expect(all.map((m) => m.userId)).toEqual(['u1', 'u2'])
  })
  it('maxPages 상한을 지킨다', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ members: [{ user_id: 'x', roles: [] }] }, '<https://lms.test/loop>; rel="next"')
    ) as unknown as typeof fetch
    const all = await fetchAllMemberships({ url: 'https://lms.test/loop', accessToken: 't', fetchFn, maxPages: 3 })
    expect(all).toHaveLength(3)
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3)
  })
})
