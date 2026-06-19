// LTI 1.3 사용자 프로비저닝 (#47) — LTI subject(issuer+sub)를 errornote 계정에 매핑.
//
// 런치 검증 후 호출한다. (issuer, sub) 로 기존 매핑을 찾고, 없으면 Supabase 사용자와
// profiles 행(트리거 생성)을 만들어 연결한다. 어드민(service_role) 클라이언트 전용.
//
// 순수 헬퍼(역할 매핑·합성 이메일)는 단위 테스트로 검증하고, resolveOrProvisionIdentity 는
// mock 어드민으로 분기 검증한다. 세션 수립(매직링크)은 라우트에서 수행한다.

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

export type ProvisionRole = 'student' | 'professor'

/** LTI 역할 → errornote 역할. */
export function mapLtiRole(isInstructor: boolean): ProvisionRole {
  return isInstructor ? 'professor' : 'student'
}

/**
 * (issuer, sub) → 결정적 합성 이메일. 플랫폼이 실제 이메일을 주지 않을 때 계정 식별용.
 * issuer+sub 해시를 사용해 추측·충돌을 막는다(예약 도메인 .local).
 */
export function deriveLtiEmail(issuer: string, sub: string): string {
  const hash = crypto.createHash('sha256').update(`${issuer}\n${sub}`).digest('hex').slice(0, 32)
  return `lti+${hash}@lti.errornote.local`
}

export interface LtiIdentityParams {
  issuer: string
  sub: string
  isInstructor: boolean
  name?: string | null
  /** 플랫폼이 제공한 실제 이메일(있으면 사용, 없으면 합성). */
  email?: string | null
}

export interface ProvisionResult {
  userId: string
  email: string
  created: boolean
}

/**
 * (issuer, sub) 매핑을 찾거나 새로 프로비저닝한다.
 * - 기존: lti_identities → user_id, 이메일은 getUserById 로 회수.
 * - 신규: createUser → profiles.role 보정 → lti_identities insert.
 * 동시 런치로 unique(issuer,sub) 충돌 시 재조회로 수렴한다.
 */
export async function resolveOrProvisionIdentity(
  admin: Admin,
  params: LtiIdentityParams
): Promise<ProvisionResult> {
  const existing = await lookupIdentity(admin, params.issuer, params.sub)
  if (existing) {
    const { data } = await admin.auth.admin.getUserById(existing)
    const email = data?.user?.email ?? deriveLtiEmail(params.issuer, params.sub)
    return { userId: existing, email, created: false }
  }

  const email = params.email?.trim() || deriveLtiEmail(params.issuer, params.sub)
  const password = crypto.randomBytes(24).toString('base64url')
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: params.name ?? null, lti: true },
  })
  if (createErr || !created?.user) {
    throw new Error(`LTI 사용자 생성 실패: ${createErr?.message ?? 'unknown'}`)
  }
  const userId = created.user.id

  // profiles 행은 handle_new_user 트리거가 생성 — role/name 만 보정.
  await admin
    .from('profiles')
    .update({
      role: mapLtiRole(params.isInstructor),
      ...(params.name ? { name: params.name } : {}),
    } as never)
    .eq('id', userId)

  const { error: linkErr } = await admin
    .from('lti_identities')
    .insert({ issuer: params.issuer, sub: params.sub, user_id: userId } as never)
  if (linkErr) {
    // 경쟁 삽입(unique 충돌) 가능 — 재조회로 수렴.
    const raced = await lookupIdentity(admin, params.issuer, params.sub)
    if (raced) return { userId: raced, email, created: false }
    throw new Error(`LTI 매핑 저장 실패: ${linkErr.message}`)
  }

  return { userId, email, created: true }
}

async function lookupIdentity(
  admin: Admin,
  issuer: string,
  sub: string
): Promise<string | null> {
  const { data } = await admin
    .from('lti_identities')
    .select('user_id')
    .eq('issuer', issuer)
    .eq('sub', sub)
    .maybeSingle()
  return (data as { user_id: string } | null)?.user_id ?? null
}
