// LTI 1.3 AGS (Assignment and Grade Services) — 점수 회신 (#47).
//
// 런치 시 받은 AGS endpoint 클레임(lineitem/scopes)을 이용해 LMS 성적부에 점수를 보낸다.
//   1) 플랫폼 토큰 엔드포인트에서 client_credentials 액세스 토큰 획득(JWT client assertion).
//   2) {lineitem}/scores 로 Score 를 POST.
//
// 순수 빌더(엔드포인트 파싱/점수 페이로드/URL)와 HTTP(주입형 fetch)를 단위 테스트한다.
// client assertion 서명(jose, 도구 개인키)·실제 LMS 연동은 런타임 검증 항목(docs/verification-runbook.md).

export const AGS_SCOPE = {
  SCORE: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  LINEITEM: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  RESULT: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const

export interface AgsEndpoint {
  scopes: string[]
  lineitem: string | null
  lineitems: string | null
}

/** 런치 AGS 클레임에서 endpoint 정보를 파싱(순수). lineitem/lineitems 둘 다 없으면 null. */
export function parseAgsEndpoint(claim: unknown): AgsEndpoint | null {
  if (!claim || typeof claim !== 'object') return null
  const c = claim as Record<string, unknown>
  const scopes = Array.isArray(c.scope)
    ? c.scope.filter((s): s is string => typeof s === 'string')
    : []
  const lineitem = typeof c.lineitem === 'string' ? c.lineitem : null
  const lineitems = typeof c.lineitems === 'string' ? c.lineitems : null
  if (!lineitem && !lineitems) return null
  return { scopes, lineitem, lineitems }
}

/** 이 endpoint 로 점수 회신이 가능한지(score scope + lineitem 보유). */
export function canPostScore(ep: AgsEndpoint): boolean {
  return ep.scopes.includes(AGS_SCOPE.SCORE) && !!ep.lineitem
}

export type ActivityProgress =
  | 'Initialized'
  | 'Started'
  | 'InProgress'
  | 'Submitted'
  | 'Completed'
export type GradingProgress =
  | 'NotReady'
  | 'Failed'
  | 'Pending'
  | 'PendingManual'
  | 'FullyGraded'

export interface AgsScore {
  userId: string
  scoreGiven: number
  scoreMaximum: number
  timestamp: string
  activityProgress: ActivityProgress
  gradingProgress: GradingProgress
  comment?: string
}

/** AGS Score 페이로드 생성(순수). scoreGiven 은 [0, scoreMaximum] 으로 클램프. */
export function buildScore(params: {
  userId: string
  scoreGiven: number
  scoreMaximum: number
  timestamp: string
  comment?: string
  activityProgress?: ActivityProgress
  gradingProgress?: GradingProgress
}): AgsScore {
  if (!(params.scoreMaximum > 0)) {
    throw new Error('buildScore: scoreMaximum 은 0 보다 커야 합니다')
  }
  const given = Math.max(0, Math.min(params.scoreGiven, params.scoreMaximum))
  return {
    userId: params.userId,
    scoreGiven: given,
    scoreMaximum: params.scoreMaximum,
    timestamp: params.timestamp,
    activityProgress: params.activityProgress ?? 'Completed',
    gradingProgress: params.gradingProgress ?? 'FullyGraded',
    ...(params.comment ? { comment: params.comment } : {}),
  }
}

/** {lineitem}/scores URL 생성(순수). 쿼리스트링·트레일링 슬래시를 보존/정규화. */
export function scoresUrl(lineitem: string): string {
  const u = new URL(lineitem)
  u.pathname = u.pathname.replace(/\/+$/, '') + '/scores'
  return u.toString()
}

/** client_credentials 액세스 토큰 요청(주입형 fetch). client assertion(JWT)은 상위에서 서명. */
export async function requestAccessToken(opts: {
  tokenUrl: string
  clientAssertion: string
  scopes: string[]
  fetchFn?: typeof fetch
}): Promise<string> {
  const f = opts.fetchFn ?? fetch
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: opts.clientAssertion,
    scope: opts.scopes.join(' '),
  })
  const res = await f(opts.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`AGS 토큰 요청 실패: ${res.status}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('AGS 토큰 응답에 access_token 이 없습니다')
  return json.access_token
}

/** lineitem 에 Score 를 POST(주입형 fetch). */
export async function sendScore(opts: {
  lineitem: string
  score: AgsScore
  accessToken: string
  fetchFn?: typeof fetch
}): Promise<{ ok: boolean; status: number }> {
  const f = opts.fetchFn ?? fetch
  const res = await f(scoresUrl(opts.lineitem), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.ims.lis.v1.score+json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(opts.score),
  })
  return { ok: res.ok, status: res.status }
}
