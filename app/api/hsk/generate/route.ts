import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { generateHskQuestion, logHskQuestion } from '@/lib/hsk-generate'
import { isHskArea, isHskLevel, isHskMode } from '@/lib/hsk'
import type { HskGenerateResponse } from '@/types/hsk'

export const runtime = 'nodejs'
export const maxDuration = 60

// 실전 HSK 문제 생성 + 로그 (docs/dashboard-features.md §1)
// 기출 유형 학습 기반 AI 생성 문제 1개를 만들어 hsk_generated_questions 에 스냅샷 저장.
export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const obj = (body ?? {}) as Record<string, unknown>
  const level = Number(obj.level)
  const { area, mode } = obj
  if (!isHskLevel(level) || !isHskArea(area) || !isHskMode(mode)) {
    return NextResponse.json({ error: 'level(3~6)/area/mode 가 유효하지 않습니다' }, { status: 400 })
  }
  if (area === 'speaking') {
    return NextResponse.json({ error: '말하기 영역은 아직 지원하지 않습니다' }, { status: 400 })
  }
  if (area === 'listening') {
    return NextResponse.json({ error: '듣기는 /api/hsk/listening/generate 를 사용하세요' }, { status: 400 })
  }

  try {
    const question = await generateHskQuestion(level, area, mode)
    const logId = await logHskQuestion(auth.userId, question)
    const res: HskGenerateResponse = { question, logId: logId ?? undefined }
    return NextResponse.json(res)
  } catch (err) {
    console.error('[api/hsk/generate]', err)
    return NextResponse.json({ error: 'HSK 문제 생성 실패' }, { status: 500 })
  }
}
