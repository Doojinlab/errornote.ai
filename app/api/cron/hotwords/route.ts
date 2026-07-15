// 今日热词 자동 파이프라인 cron (docs/dashboard-features.md §2.4)
//   1. 동면 재등판(냉각 경과 카드 복귀)
//   2. 신규 수집·해설·안전필터·배포 파이프라인 실행
// 인증: CRON_SECRET (Vercel Cron 은 Authorization: Bearer, 수동 테스트는 ?secret=).

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runHotwordPipeline } from '@/lib/hotword-pipeline'
import { reactivateDormant } from '@/lib/hotwords'

export const runtime = 'nodejs'
export const maxDuration = 300

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function verifySecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && safeEqual(auth.slice(7), expected)) return true
  const q = new URL(req.url).searchParams.get('secret')
  if (q !== null && safeEqual(q, expected)) return true
  return false
}

async function run(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }
  try {
    const reactivated = await reactivateDormant()
    const pipeline = await runHotwordPipeline()
    return NextResponse.json({ ok: true, reactivated, pipeline })
  } catch (err) {
    console.error('[cron/hotwords]', err)
    return NextResponse.json({ error: '파이프라인 실행 실패' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return run(req)
}
export async function POST(req: Request) {
  return run(req)
}
