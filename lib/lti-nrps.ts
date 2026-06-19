// LTI 1.3 NRPS (Names and Role Provisioning Services) — 수강생 명단 동기화 (#47).
//
// 런치 시 받은 NRPS 클레임(context_memberships_url)으로 LMS의 강의 구성원 목록을 가져온다.
//   GET {context_memberships_url} (Bearer 토큰, Accept: membershipcontainer+json)
//   → { members: [{ user_id, name, email, roles, status }] }, 페이지네이션은 Link: rel="next".
//
// 순수 파서(서비스/멤버십/Link)와 HTTP(주입형 fetch)를 단위 테스트한다.
// 토큰(client_credentials)·실 LMS 연동은 런타임 검증 항목(docs/verification-runbook.md).

export const NRPS_SCOPE =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
export const NRPS_ACCEPT =
  'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'

const ROLE_INSTRUCTOR =
  /#(Instructor|Administrator|TeachingAssistant|ContentDeveloper|Mentor)\b/
const ROLE_LEARNER = /#(Learner|Student)\b/

export interface NrpsService {
  contextMembershipsUrl: string
  serviceVersions: string[]
}

/** 런치 NRPS 클레임에서 서비스 정보를 파싱(순수). URL 없으면 null. */
export function parseNrpsService(claim: unknown): NrpsService | null {
  if (!claim || typeof claim !== 'object') return null
  const c = claim as Record<string, unknown>
  const url = c.context_memberships_url
  if (typeof url !== 'string' || !url) return null
  const versions = Array.isArray(c.service_versions)
    ? c.service_versions.filter((v): v is string => typeof v === 'string')
    : []
  return { contextMembershipsUrl: url, serviceVersions: versions }
}

export interface NrpsMember {
  userId: string
  name: string | null
  email: string | null
  roles: string[]
  isInstructor: boolean
  isLearner: boolean
  status: string
}

/** 멤버십 컨테이너 JSON에서 구성원 목록을 정규화(순수). 비정상이면 []. */
export function parseMembership(json: unknown): NrpsMember[] {
  if (!json || typeof json !== 'object') return []
  const members = (json as Record<string, unknown>).members
  if (!Array.isArray(members)) return []
  const out: NrpsMember[] = []
  for (const m of members) {
    if (!m || typeof m !== 'object') continue
    const mm = m as Record<string, unknown>
    const userId = typeof mm.user_id === 'string' ? mm.user_id : ''
    if (!userId) continue
    const roles = Array.isArray(mm.roles)
      ? mm.roles.filter((r): r is string => typeof r === 'string')
      : []
    out.push({
      userId,
      name: typeof mm.name === 'string' ? mm.name : null,
      email: typeof mm.email === 'string' ? mm.email : null,
      roles,
      isInstructor: roles.some((r) => ROLE_INSTRUCTOR.test(r)),
      isLearner: roles.some((r) => ROLE_LEARNER.test(r)),
      status: typeof mm.status === 'string' ? mm.status : 'Active',
    })
  }
  return out
}

/** Active 상태 구성원만 필터(순수). */
export function activeMembers(members: NrpsMember[]): NrpsMember[] {
  return members.filter((m) => m.status === 'Active')
}

/** HTTP Link 헤더에서 rel="next" URL 추출(순수). 없으면 null. */
export function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i)
    if (m) return m[1]
  }
  return null
}

/** 멤버십 한 페이지 조회(주입형 fetch). 구성원 + 다음 페이지 URL 반환. */
export async function fetchMembershipPage(opts: {
  url: string
  accessToken: string
  fetchFn?: typeof fetch
}): Promise<{ members: NrpsMember[]; next: string | null }> {
  const f = opts.fetchFn ?? fetch
  const res = await f(opts.url, {
    method: 'GET',
    headers: {
      Accept: NRPS_ACCEPT,
      Authorization: `Bearer ${opts.accessToken}`,
    },
  })
  if (!res.ok) throw new Error(`NRPS 멤버십 조회 실패: ${res.status}`)
  const json = await res.json()
  return {
    members: parseMembership(json),
    next: nextPageUrl(res.headers.get('link')),
  }
}

/** 모든 페이지를 따라가며 구성원을 모은다(주입형 fetch, maxPages 안전 상한). */
export async function fetchAllMemberships(opts: {
  url: string
  accessToken: string
  fetchFn?: typeof fetch
  maxPages?: number
}): Promise<NrpsMember[]> {
  const maxPages = opts.maxPages ?? 20
  const all: NrpsMember[] = []
  let url: string | null = opts.url
  let page = 0
  while (url && page < maxPages) {
    page++
    const { members, next }: { members: NrpsMember[]; next: string | null } =
      await fetchMembershipPage({ url, accessToken: opts.accessToken, fetchFn: opts.fetchFn })
    all.push(...members)
    url = next
  }
  return all
}
