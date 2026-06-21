import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { getOrCreateTodayQuest, ymd, QUEST_DONE_COINS } from '@/lib/daily-quests'
import { processGraduations } from '@/lib/graduation'
import { awardActivityCoins } from '@/lib/gamification'
import { contributeClassGoal } from '@/lib/class-goals'
import type { DailyQuestMission } from '@/types/daily-quests'

export const runtime = 'nodejs'

async function auth() {
  return requireAuth('student')
}

function authErr(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
  return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
}

/** GET: 오늘자 퀘스트(없으면 생성) + 졸업 판정(비치명적). */
export async function GET() {
  let a
  try {
    a = await auth()
  } catch (err) {
    return authErr(err)
  }

  try {
    const quest = await getOrCreateTodayQuest(a.userId)
    // 닫힘 루프: 데일리 진입 시 졸업도 함께 판정. 실패해도 퀘스트는 반환.
    let graduated: Array<{ code: string; subtype: string }> = []
    try {
      graduated = await processGraduations(a.userId)
    } catch (gErr) {
      console.error('[api/quests processGraduations]', gErr)
    }

    // 닫힘 루프: 졸업한 오류 유형은 수강 중인 반의 협동 목표에 +1 기여(긍정적 상호의존).
    // 활성 목표가 없으면 RPC 가 조용히 no-op. 비치명적 — 실패해도 퀘스트 반환은 막지 않는다.
    if (graduated.length > 0) {
      try {
        const supabase = createServerClient()
        const { data: enr } = await supabase
          .from('enrollments')
          .select('class_id')
          .eq('student_id', a.userId)
        const classIds = ((enr as { class_id: string }[] | null) ?? []).map((e) => e.class_id)
        await Promise.all(
          classIds.flatMap((classId) =>
            graduated.map((g) =>
              contributeClassGoal(classId, g.code).catch((cErr) => {
                console.error('[api/quests contributeClassGoal]', classId, g.code, cErr)
              })
            )
          )
        )
      } catch (cErr) {
        console.error('[api/quests classGoals]', cErr)
      }
    }

    return NextResponse.json({ quest, graduated })
  } catch (err) {
    console.error('[api/quests GET]', err)
    return NextResponse.json({ error: '퀘스트 조회 실패' }, { status: 500 })
  }
}

/** POST: 미션 완료 표시 + 활동 화폐 지급(최초 완료 시 1회). body: { missionId } */
export async function POST(req: Request) {
  let a
  try {
    a = await auth()
  } catch (err) {
    return authErr(err)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }
  const missionId = (body as { missionId?: unknown })?.missionId
  if (typeof missionId !== 'string' || !missionId) {
    return NextResponse.json({ error: 'missionId 가 필요합니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  const today = ymd(new Date())
  const { data, error } = await supabase
    .from('daily_quests')
    .select('id, missions')
    .eq('student_id', a.userId)
    .eq('quest_date', today)
    .maybeSingle()
  if (error) {
    console.error('[api/quests POST select]', error)
    return NextResponse.json({ error: '퀘스트 조회 실패' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '오늘 퀘스트가 없습니다' }, { status: 404 })
  }

  // jsonb 컬럼(missions)은 DB 타입상 Json 이라 앱 타입으로 좁힌다(런타임 형태는 동일).
  const row = data as unknown as { id: string; missions: DailyQuestMission[] }
  const missions = (row.missions ?? []) as DailyQuestMission[]
  const idx = missions.findIndex((m) => m.id === missionId)
  if (idx < 0) {
    return NextResponse.json({ error: '미션을 찾을 수 없습니다' }, { status: 404 })
  }

  let awardedCoins = 0
  if (!missions[idx].done) {
    missions[idx] = { ...missions[idx], done: true }
    // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회(프로젝트 공통).
    const { error: updErr } = await supabase
      .from('daily_quests')
      .update({ missions } as never)
      .eq('id', row.id)
    if (updErr) {
      console.error('[api/quests POST update]', updErr)
      return NextResponse.json({ error: '미션 갱신 실패' }, { status: 500 })
    }
    try {
      await awardActivityCoins(a.userId, QUEST_DONE_COINS)
      awardedCoins = QUEST_DONE_COINS
    } catch (coinErr) {
      // 화폐 적립 실패는 미션 완료를 막지 않는다(비치명적).
      console.error('[api/quests POST awardCoins]', coinErr)
    }
  }

  return NextResponse.json({ missions, awardedCoins })
}
