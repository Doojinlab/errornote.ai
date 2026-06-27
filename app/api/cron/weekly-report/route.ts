// POST /api/cron/weekly-report — Vercel Cron 매주 월 09:00 KST(=00:00 UTC).
// [창] feat/phase4-weekly-report
//
// 흐름:
//  1. CRON_SECRET 검증 (Authorization: Bearer 또는 query ?secret=)
//  2. weekStart 결정 (지난 주 월요일)
//  3. is_active 클래스 순회 → 학생별 집계 → Claude → student_weekly_reports upsert
//  4. 학생 in_app_notifications + Kakao 발송 (skipNotify 면 둘 다 스킵)
//  5. 클래스 단위 professor_reports 도 함께 갱신 (lib/professor-reports 재사용)
//  6. JSON 통계 응답
//
// 한 클래스의 학생은 제한된 동시성(WEEKLY_REPORT_CONCURRENCY, 기본 5)으로 병렬 처리한다.
// Claude 호출은 학생당 1회(Haiku)로 제한. 직렬이면 80명 규모에서 maxDuration(300s)에
// 근접하므로 워커 풀로 벽시계를 줄인다(vercel.json 의 maxDuration 참고).

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'
import {
  aggregateStudentsForWeek,
  generateStudentSuggestions,
  previousWeekStart,
  upsertStudentWeeklyReport,
  type StudentAggregate
} from '@/lib/weekly-reports'
import {
  createInAppNotification,
  buildWeeklyReportNotificationCopy
} from '@/lib/in-app-notifications'
import { buildWeeklyReportTemplate, notifyWeeklyReportKakao } from '@/lib/weekly-report-notify'
import { generateWeeklyReportAdmin } from '@/lib/professor-reports-admin'
import type {
  CronWeeklyReportRequest,
  CronWeeklyReportResponse
} from '@/types/weekly-reports'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

interface ClassRow {
  id: string
  name: string
  professor_id: string
  is_active: boolean
}

interface ProfileMini {
  id: string
  name: string | null
}

interface EnrollmentJoin {
  student_id: string
  profiles: ProfileMini | ProfileMini[] | null
}

/** 상수시간 문자열 비교 — 길이가 다르면 안전하게 false. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function verifySecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  // Vercel Cron 은 Authorization 헤더로 secret 을 보냄.
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && safeEqual(auth.slice(7), expected)) return true
  // 수동 테스트용 query string 폴백.
  const url = new URL(req.url)
  const q = url.searchParams.get('secret')
  if (q !== null && safeEqual(q, expected)) return true
  return false
}

async function readBody(req: Request): Promise<CronWeeklyReportRequest> {
  if (req.method === 'GET') return {}
  try {
    const txt = await req.text()
    if (!txt) return {}
    return JSON.parse(txt) as CronWeeklyReportRequest
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  return runCron(req)
}
export async function POST(req: Request) {
  return runCron(req)
}

async function runCron(req: Request): Promise<Response> {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await readBody(req)
  const weekStart = body.weekStart ?? previousWeekStart()
  const onlyClassId = body.classId ?? null
  const limit = typeof body.limit === 'number' ? body.limit : null
  const skipNotify = body.skipNotify === true

  const admin = createAdminClient()

  const errors: CronWeeklyReportResponse['errors'] = []
  const counters = {
    classes_processed: 0,
    students_processed: 0,
    professor_reports_created: 0,
    in_app: 0,
    kakao: 0,
    kakao_failed: 0
  }

  // 활성 클래스 목록 (또는 단일 클래스).
  let classQuery = admin
    .from('classes')
    .select('id, name, professor_id, is_active')
    .eq('is_active', true)
  if (onlyClassId) classQuery = classQuery.eq('id', onlyClassId)
  const { data: classRaw, error: classErr } = await classQuery
  if (classErr) {
    return NextResponse.json({ error: `classes: ${classErr.message}` }, { status: 500 })
  }
  const classes = (classRaw ?? []) as ClassRow[]

  for (const cls of classes) {
    try {
      await processClass(admin, cls, weekStart, limit, skipNotify, errors, counters)
      counters.classes_processed += 1
    } catch (err) {
      errors.push({
        scope: `class:${cls.id}`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const response: CronWeeklyReportResponse = {
    ok: true,
    weekStart,
    classes_processed: counters.classes_processed,
    students_processed: counters.students_processed,
    professor_reports_created: counters.professor_reports_created,
    notifications_sent: {
      in_app: counters.in_app,
      kakao: counters.kakao,
      kakao_failed: counters.kakao_failed
    },
    errors
  }
  return NextResponse.json(response)
}

interface Counters {
  classes_processed: number
  students_processed: number
  professor_reports_created: number
  in_app: number
  kakao: number
  kakao_failed: number
}

// 학생당 Claude(Haiku) 호출은 독립적이므로 제한된 동시성으로 처리한다.
// 직렬(80명×~1.5s)이면 maxDuration(300s)에 근접하므로 워커 풀로 벽시계를 줄인다.
// 동시성은 Claude rate limit 을 고려해 보수적으로 잡고, env 로 조정 가능.
const DEFAULT_STUDENT_CONCURRENCY = 5

function studentConcurrency(): number {
  const raw = Number(process.env.WEEKLY_REPORT_CONCURRENCY)
  if (Number.isInteger(raw) && raw >= 1 && raw <= 20) return raw
  return DEFAULT_STUDENT_CONCURRENCY
}

/** 고정 크기 워커 풀 — 동시에 최대 `limit` 개만 실행. 단일 스레드라 idx 증가는 안전. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0
  const size = Math.min(Math.max(1, limit), items.length)
  const runners = Array.from({ length: size }, async () => {
    while (idx < items.length) {
      const item = items[idx++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/** 학생 1명 처리 — 제안 생성·저장·알림. 에러는 격리해 errors 에 누적(throw 안 함). */
async function processStudent(
  admin: Admin,
  cls: ClassRow,
  weekStart: string,
  skipNotify: boolean,
  agg: StudentAggregate,
  studentNames: Map<string, string>,
  errors: CronWeeklyReportResponse['errors'],
  counters: Counters
): Promise<void> {
  try {
    const studentName = studentNames.get(agg.student_id) ?? '학생'
    const suggestions = await generateStudentSuggestions({
      studentName,
      className: cls.name,
      weekStart,
      metrics: agg.metrics
    })
    await upsertStudentWeeklyReport(admin, {
      studentId: agg.student_id,
      classId: cls.id,
      weekStart,
      metrics: agg.metrics,
      suggestions
    })
    counters.students_processed += 1

    if (!skipNotify) {
      // 인앱 알림 — 무벌점 톤(활동 없으면 복귀 환영).
      try {
        const copy = buildWeeklyReportNotificationCopy({
          totalSessions: agg.metrics.total_sessions,
          headline: suggestions.headline
        })
        await createInAppNotification(admin, {
          userId: agg.student_id,
          type: 'weekly_report',
          title: copy.title,
          body: copy.body,
          linkUrl: `/weekly-suggestions/${weekStart}/${cls.id}`,
          payload: { class_id: cls.id, week_start: weekStart }
        })
        counters.in_app += 1
      } catch (notifErr) {
        errors.push({
          scope: `notify_inapp:${agg.student_id}`,
          message: notifErr instanceof Error ? notifErr.message : String(notifErr)
        })
      }

      // 카카오 (옵션 — 연동 안되어 있으면 silent skip)
      try {
        const result = await notifyWeeklyReportKakao(
          admin,
          agg.student_id,
          buildWeeklyReportTemplate({
            studentName,
            headline: suggestions.headline
          })
        )
        if (result.sent) counters.kakao += 1
        else if (result.error && !result.error.includes('카카오 연동 안됨')) {
          counters.kakao_failed += 1
          errors.push({
            scope: `notify_kakao:${agg.student_id}`,
            message: result.error
          })
        }
      } catch (kErr) {
        counters.kakao_failed += 1
        errors.push({
          scope: `notify_kakao:${agg.student_id}`,
          message: kErr instanceof Error ? kErr.message : String(kErr)
        })
      }
    }
  } catch (err) {
    errors.push({
      scope: `student:${agg.student_id}`,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

async function processClass(
  admin: Admin,
  cls: ClassRow,
  weekStart: string,
  limit: number | null,
  skipNotify: boolean,
  errors: CronWeeklyReportResponse['errors'],
  counters: Counters
): Promise<void> {
  const { data: enrollRaw, error: enrollErr } = await admin
    .from('enrollments')
    .select('student_id, profiles:student_id(id, name)')
    .eq('class_id', cls.id)
  if (enrollErr) throw new Error(`enrollments: ${enrollErr.message}`)
  const enrollments = (enrollRaw ?? []) as EnrollmentJoin[]
  const studentIds = enrollments.map((e) => e.student_id)
  const studentNames = new Map<string, string>()
  for (const e of enrollments) {
    const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
    studentNames.set(e.student_id, p?.name ?? '학생')
  }

  const targetIds = limit ? studentIds.slice(0, limit) : studentIds

  // 한 번에 학생별 집계.
  const aggregates = await aggregateStudentsForWeek(admin, cls.id, targetIds, weekStart)

  // 학생 처리 — 제한된 동시성(기본 5). 직렬 대비 벽시계 대폭 단축.
  await runWithConcurrency(aggregates, studentConcurrency(), (agg) =>
    processStudent(admin, cls, weekStart, skipNotify, agg, studentNames, errors, counters)
  )

  // 교수자 클래스 단위 리포트 — service-role 인지 변형(generateWeeklyReportAdmin) 사용.
  try {
    await generateWeeklyReportAdmin(admin, cls.professor_id, cls.id, weekStart)
    counters.professor_reports_created += 1
  } catch (err) {
    errors.push({
      scope: `prof_report:${cls.id}`,
      message: err instanceof Error ? err.message : String(err)
    })
  }

  // 교수자 본인 인앱 알림 (클래스 단위 리포트 생성됨)
  if (!skipNotify) {
    try {
      await createInAppNotification(admin, {
        userId: cls.professor_id,
        type: 'weekly_class_report',
        title: `${cls.name} 주간 리포트가 생성되었습니다`,
        body: `${weekStart} 주의 학습자 활동·오류 분석을 확인하세요.`,
        linkUrl: `/reports`,
        payload: { class_id: cls.id, week_start: weekStart }
      })
      counters.in_app += 1
    } catch (err) {
      errors.push({
        scope: `notify_prof:${cls.professor_id}`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }
}

