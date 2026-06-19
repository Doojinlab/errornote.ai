// LTI 1.3 context → errornote class 매핑 (#47).
//
// 런치 컨텍스트(context.id)를 errornote classes 에 연결한다. 사용자 프로비저닝
// (lib/lti-provisioning.ts) 이후 호출한다. 어드민(service_role) 전용.
//
// 순수 헬퍼(invite code 파생)는 단위 테스트로, resolve/ensure 는 mock 어드민으로 검증한다.

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

/** (issuer, contextId) → 결정적 8자 초대코드(대문자 hex). 자동 생성 클래스용. */
export function deriveInviteCode(issuer: string, contextId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${issuer}\n${contextId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
}

export interface ContextMapParams {
  issuer: string
  contextId: string | null
  contextTitle?: string | null
  /** 플랫폼 등록(lti_platforms)에 미리 바인딩된 class. 있으면 우선. */
  preboundClassId?: string | null
}

export interface ClassResolution {
  classId: string | null
  created: boolean
}

/**
 * LTI context 에 대응하는 class 를 찾거나(교수자면) 생성한다.
 * - prebound class 가 있으면 그것을 사용.
 * - 기존 매핑(lti_context_links)이 있으면 그 class.
 * - 없고 교수자 런치면 class 생성 + 매핑(동시 런치 충돌 시 재조회 수렴).
 * - 없고 학생 런치면 null(교수자 셋업 전까지 보류).
 */
export async function resolveClassForContext(
  admin: Admin,
  params: ContextMapParams,
  userId: string,
  isInstructor: boolean
): Promise<ClassResolution> {
  if (params.preboundClassId) return { classId: params.preboundClassId, created: false }
  if (!params.contextId) return { classId: null, created: false }

  const existing = await lookupContext(admin, params.issuer, params.contextId)
  if (existing) return { classId: existing, created: false }

  if (!isInstructor) return { classId: null, created: false }

  const { data: created, error } = await admin
    .from('classes')
    .insert({
      professor_id: userId,
      name: (params.contextTitle?.trim() || params.contextId).slice(0, 200),
      semester: 'LTI',
      invite_code: deriveInviteCode(params.issuer, params.contextId),
      is_active: true,
    } as never)
    .select('id')
    .single()
  if (error || !created) {
    throw new Error(`LTI 클래스 생성 실패: ${error?.message ?? 'unknown'}`)
  }
  const classId = (created as { id: string }).id

  const { error: linkErr } = await admin
    .from('lti_context_links')
    .insert({ issuer: params.issuer, context_id: params.contextId, class_id: classId } as never)
  if (linkErr) {
    const raced = await lookupContext(admin, params.issuer, params.contextId)
    if (raced) return { classId: raced, created: false }
    throw new Error(`LTI 컨텍스트 매핑 저장 실패: ${linkErr.message}`)
  }
  return { classId, created: true }
}

/** 학생을 class 에 멱등 등록한다(이미 등록되어 있으면 무시). */
export async function ensureEnrollment(
  admin: Admin,
  classId: string,
  studentId: string
): Promise<void> {
  const { error } = await admin
    .from('enrollments')
    .insert({ class_id: classId, student_id: studentId } as never)
  // unique(class_id, student_id) 충돌은 "이미 등록됨" — 정상.
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(`수강 등록 실패: ${error.message}`)
  }
}

async function lookupContext(
  admin: Admin,
  issuer: string,
  contextId: string
): Promise<string | null> {
  const { data } = await admin
    .from('lti_context_links')
    .select('class_id')
    .eq('issuer', issuer)
    .eq('context_id', contextId)
    .maybeSingle()
  return (data as { class_id: string } | null)?.class_id ?? null
}
