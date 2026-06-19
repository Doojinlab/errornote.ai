import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { pullGacha, GACHA_COST } from '@/lib/gacha'

export const runtime = 'nodejs'

function authErr(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
  return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
}

/**
 * POST: 가챠 1회 뽑기.
 * 활동 화폐(activity_coins)로만 차감하며, 무결성(잔액 확인·차감·인벤토리 추가)은
 * SECURITY DEFINER RPC(pull_gacha)에서 atomic 처리된다. 잔액 부족 시 400(code: insufficient).
 */
export async function POST() {
  let a
  try {
    a = await requireAuth('student')
  } catch (err) {
    return authErr(err)
  }

  try {
    const result = await pullGacha(a.userId, GACHA_COST)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    // RPC 가 잔액 부족이면 'insufficient activity_coins' 로 raise → 사용자 친화적 400.
    if (msg.includes('insufficient')) {
      return NextResponse.json({ error: '도장이 부족합니다', code: 'insufficient' }, { status: 400 })
    }
    console.error('[api/gacha POST]', err)
    return NextResponse.json({ error: '가챠 뽑기에 실패했습니다' }, { status: 500 })
  }
}
