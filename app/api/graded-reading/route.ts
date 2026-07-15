import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { clampHskLevel, generateGradedReading } from '@/lib/graded-reading'

export const runtime = 'nodejs'
export const maxDuration = 60

// 맞춤 그레이디드 리딩 (M12) — 학습자 약점 문법을 심은 짧은 지문 생성.
// 약점 문법은 본인 오류 카드의 자주 나온 error_subtype 에서 추출한다.
async function topWeakGrammar(studentId: string): Promise<string[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('error_cards')
    .select('error_subtype, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(60)

  const tally = new Map<string, number>()
  for (const row of data ?? []) {
    const st = (row.error_subtype ?? '').trim()
    if (!st) continue
    tally.set(st, (tally.get(st) ?? 0) + 1)
  }
  const top = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([st]) => st)
  // 오류 이력이 없으면 기본 약점(기초 어순)으로 지문 생성.
  return top.length > 0 ? top : ['어순(语序)']
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let hskLevel = 3
  try {
    const body = (await req.json()) as { hskLevel?: unknown }
    if (typeof body?.hskLevel === 'number') hskLevel = clampHskLevel(body.hskLevel)
  } catch {
    /* 본문 없으면 기본 레벨 */
  }

  try {
    const weakGrammar = await topWeakGrammar(auth.userId)
    const reading = await generateGradedReading(weakGrammar, hskLevel)
    return NextResponse.json({ reading, weakGrammar, hskLevel })
  } catch (err) {
    console.error('[api/graded-reading]', err)
    return NextResponse.json({ error: '지문 생성 실패' }, { status: 500 })
  }
}
