// 핵심 루프 "진짜" 스모크용 헬퍼/픽스처.
//
// helpers/mocks.ts 가 page.route() 로 /api/analyze 를 가짜 응답으로 덮는 것과 달리,
// 이 모듈은 목킹 없이 실제 dev server → 실 Claude → 실 Supabase 를 태운다.
// 과제 제출 라우트(/api/assignments/:id/submit)를 통해
//   제출 → 실 Claude 분석 → 오류카드 영속화 → XP 반영
// 까지의 핵심 루프를 단 한 번의 실제 호출로 검증하기 위한 픽스처를 만든다.
//
// 비용·시간이 발생하므로 호출부(learn.spec.ts)는 readRealLoopEnv() !== null,
// 즉 아래 env 가 모두 갖춰졌을 때만 돌린다(없으면 test.skip).
//
// 필요 env:
//   ANTHROPIC_API_KEY          dev server 가 실 Claude 를 호출할 수 있어야 한다.
//                              (서버가 읽는 .env.local 과 동일하게 셸에도 노출해 두는 것을 권장 —
//                               그래야 "키 있음=실행 / 키 없음=스킵" 판정이 서버 실제 상태와 일치한다.)
//   SUPABASE_TEST_URL          (없으면 NEXT_PUBLIC_SUPABASE_URL fallback)
//   SUPABASE_TEST_ANON_KEY     (없으면 NEXT_PUBLIC_SUPABASE_ANON_KEY fallback)
//   SUPABASE_SERVICE_ROLE_KEY  픽스처 생성/검증/정리(RLS 우회). 필수.
//   TEST_STUDENT_EMAIL/PASSWORD storageState 학생과 동일 계정 — 이 계정으로 제출하고 XP 를 검증한다.
//
// dev/staging DB 전용 — 운영 DB 에서는 절대 실행하지 말 것(rls.spec.ts 와 동일 주의).

import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, readRlsEnv, signInClient, tag, type RlsEnv } from './supabase-clients'
import type { Database } from '@/types/database'

export interface RealLoopEnv extends RlsEnv {
  studentEmail: string
  studentPassword: string
}

/**
 * 실호출 스모크에 필요한 모든 env 가 갖춰졌을 때만 RealLoopEnv 를 돌려준다.
 * 하나라도 없으면 null → 호출부에서 스킵.
 *
 * NOTE: 학생 계정은 명시적으로 TEST_STUDENT_EMAIL/PASSWORD 가 설정된 경우에만 인정한다.
 * (setup 의 기본값 student@test.example 로는 실제 Supabase 인증이 보장되지 않으므로,
 *  storageState 쿠키 주체와 검증 대상 userId 가 어긋나는 것을 막기 위함.)
 */
export function readRealLoopEnv(): RealLoopEnv | null {
  const base = readRlsEnv()
  if (!base) return null
  if (!process.env.ANTHROPIC_API_KEY) return null
  const studentEmail = process.env.TEST_STUDENT_EMAIL
  const studentPassword = process.env.TEST_STUDENT_PASSWORD
  if (!studentEmail || !studentPassword) return null
  return { ...base, studentEmail, studentPassword }
}

/**
 * 의도적으로 오류를 포함한 중국어 초고.
 * (예: '见面了我的朋友' — 见面 는 목적어를 직접 취하지 않음, '吃饭在食堂' — 어순 오류 등)
 * 실 Claude 가 보통 1개 이상의 오류 카드를 만들도록 유도하지만, 단언은 응답의
 * error_count 에 동적으로 묶어 0개여도 파이프라인 일관성으로 검증한다.
 */
export const CHINESE_DRAFT_WITH_ERRORS =
  '我昨天去了学校，见面了我的朋友。我们一起吃饭在食堂，然后去图书馆学习汉语。我觉得汉语很有意思，但是有时候很难。'

// lib/gamification.ts 의 상수와 동기화(서버 전용 모듈을 테스트 런타임에 import 하지 않기 위해 값으로 둠).
//   XP_FOR_DRAFT = 10                (오류 1개 이상인 초고 제출)
//   XP_FOR_ZERO_ERROR_REVISION = 50  (오류 0개 보너스)
export const XP_FOR_DRAFT = 10
export const XP_FOR_ZERO_ERROR_REVISION = 50

export interface CoreLoopFixture {
  /** storageState 와 동일한 실 학생 계정 id(제출 주체). */
  studentId: string
  classId: string
  assignmentId: string
  professorUserId: string
  baselineXp: number
  baselineLevel: number
}

/** gamification_stats 의 현재 xp/level 을 읽는다(행이 없으면 기본값). */
export async function readGamification(
  admin: SupabaseClient<Database>,
  studentId: string
): Promise<{ xp: number; level: number }> {
  const { data, error } = await admin
    .from('gamification_stats')
    .select('xp, level')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw new Error(`gamification_stats 조회 실패: ${error.message}`)
  const row = data as { xp: number; level: number } | null
  return { xp: row?.xp ?? 0, level: row?.level ?? 1 }
}

/**
 * 핵심 루프 제출에 필요한 최소 픽스처를 service-role 로 생성한다:
 *   임시 교수 1명 → 강의 1개 → (실 학생) 수강 등록 → 루브릭 없는 과제 1개.
 * 루브릭을 일부러 붙이지 않아 제출당 Claude 호출을 1회로 최소화한다.
 */
export async function setupCoreLoopFixture(env: RealLoopEnv): Promise<CoreLoopFixture> {
  const admin = adminClient(env)
  const runTag = tag()

  // 1) storageState 와 동일한 학생 계정의 userId 확보.
  const studentSb = await signInClient(env, env.studentEmail, env.studentPassword)
  const { data: userData, error: userErr } = await studentSb.auth.getUser()
  if (userErr || !userData.user) {
    throw new Error(`test student getUser 실패: ${userErr?.message ?? 'no user'}`)
  }
  const studentId = userData.user.id

  // 2) 과제를 소유할 임시 교수 1명.
  const profEmail = `${runTag}-prof@real-loop.test.example`
  const profPassword = `Pa55word!-${runTag.slice(-8)}`
  const { data: profData, error: profErr } = await admin.auth.admin.createUser({
    email: profEmail,
    password: profPassword,
    email_confirm: true,
  })
  if (profErr || !profData.user) throw new Error(`professor createUser 실패: ${profErr?.message}`)
  const professorUserId = profData.user.id
  // profiles 행은 handle_new_user 트리거가 자동 생성한다고 가정하고 role 만 보정.
  await admin.from('profiles').update({ role: 'professor' } as never).eq('id', professorUserId)

  // 3) 교수 소유 강의 1개.
  const cls = await admin
    .from('classes')
    .insert({
      professor_id: professorUserId,
      name: `${runTag}-real-loop`,
      semester: '2026-1',
      invite_code: runTag.slice(0, 8).toUpperCase() + 'RL',
      is_active: true,
    } as never)
    .select('id')
    .single()
  if (cls.error || !cls.data) throw new Error(`class insert 실패: ${cls.error?.message}`)
  const classId = (cls.data as { id: string }).id

  // 4) 실 학생 수강 등록.
  {
    const { error } = await admin
      .from('enrollments')
      .insert({ class_id: classId, student_id: studentId } as never)
    if (error) throw new Error(`enrollment insert 실패: ${error.message}`)
  }

  // 5) 루브릭 없는 과제 1개.
  const asg = await admin
    .from('assignments')
    .insert({
      class_id: classId,
      professor_id: professorUserId,
      title: `${runTag} 핵심루프 스모크`,
      prompt_text: '자유 주제로 5문장 이상 작성하세요.',
    } as never)
    .select('id')
    .single()
  if (asg.error || !asg.data) throw new Error(`assignment insert 실패: ${asg.error?.message}`)
  const assignmentId = (asg.data as { id: string }).id

  // 6) XP 기준선.
  const { xp, level } = await readGamification(admin, studentId)

  return {
    studentId,
    classId,
    assignmentId,
    professorUserId,
    baselineXp: xp,
    baselineLevel: level,
  }
}

/**
 * 픽스처 정리:
 *   - 강의 삭제 → enrollments/assignments/sessions(→error_cards) 까지 cascade 제거.
 *   - 임시 교수 계정 제거.
 *   - 실 학생 계정의 xp/level 을 기준선으로 복원(테스트 계정 누적 드리프트 방지).
 */
export async function cleanupCoreLoopFixture(env: RealLoopEnv, fx: CoreLoopFixture): Promise<void> {
  const admin = adminClient(env)
  await admin.from('classes').delete().eq('id', fx.classId)
  await admin.auth.admin.deleteUser(fx.professorUserId)
  await admin
    .from('gamification_stats')
    .update({ xp: fx.baselineXp, level: fx.baselineLevel } as never)
    .eq('student_id', fx.studentId)
}
