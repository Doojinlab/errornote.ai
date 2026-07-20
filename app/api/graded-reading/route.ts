import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { aggregateLearnerProfile } from '@/lib/tutor-context'
import { generateGradedReading, clampHskLevel, type GradedReading } from '@/lib/graded-reading'

export const runtime = 'nodejs'
export const maxDuration = 60

export interface GradedReadingResponse {
  reading: GradedReading
  /** 이번 지문이 노린 약점 문법(학습자 오류 프로필 상위) */
  weakGrammar: string[]
  hskLevel: number
}

// 맞춤 그레이디드 리딩 — gamification-spec M12.
// 학습자 오류 프로필(자주 틀리는 문법 + HSK 범위)로 맞춤 지문을 즉석 생성한다.
export async function POST(): Promise<Response> {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  // 1) 오류 프로필 집계 → 약점 문법 + HSK 레벨 도출
  const supabase = createServerClient()
  let weakGrammar: string[]
  let hskLevel: number
  try {
    const profile = await aggregateLearnerProfile(supabase, auth.userId)
    weakGrammar = profile.recurring.map((r) => r.subtype)
    hskLevel = profile.hskRange
      ? clampHskLevel(Math.round((profile.hskRange.min + profile.hskRange.max) / 2))
      : 3
  } catch (err) {
    console.error('[api/graded-reading] profile error:', err)
    return NextResponse.json({ error: '오류 프로필 집계 실패' }, { status: 500 })
  }

  // 2) 맞춤 지문 생성
  let reading: GradedReading
  try {
    reading = await generateGradedReading(weakGrammar, hskLevel)
  } catch (err) {
    console.error('[api/graded-reading] generate error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Claude API 인증 실패. 관리자에게 문의하세요.' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '지문 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const response: GradedReadingResponse = { reading, weakGrammar, hskLevel }
  return NextResponse.json(response)
}
