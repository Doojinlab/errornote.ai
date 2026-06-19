import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => {
  class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return { AuthError, requireAuth: vi.fn() }
})

vi.mock('@/lib/gacha', () => ({
  pullGacha: vi.fn(),
  GACHA_COST: 30
}))

import { POST } from '@/app/api/gacha/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { pullGacha } from '@/lib/gacha'

describe('POST /api/gacha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('정상 뽑기 → 결과 JSON 반환, 인증 studentId 로 호출', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'student-1', role: 'student', email: null })
    vi.mocked(pullGacha).mockResolvedValue({
      itemCode: 'theme_dragon',
      itemId: 'item-1',
      rarity: 'rare',
      isDuplicate: false,
      activityCoins: 70
    })

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.itemCode).toBe('theme_dragon')
    expect(body.activityCoins).toBe(70)
    expect(pullGacha).toHaveBeenCalledWith('student-1', 30)
  })

  it('잔액 부족(RPC insufficient) → 400 + code:insufficient', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'student-1', role: 'student', email: null })
    vi.mocked(pullGacha).mockRejectedValue(
      new Error('pull_gacha RPC 실패: insufficient activity_coins: have 10, need 30')
    )

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST()
    errSpy.mockRestore()

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('insufficient')
  })

  it('기타 RPC 오류 → 500', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'student-1', role: 'student', email: null })
    vi.mocked(pullGacha).mockRejectedValue(new Error('pull_gacha RPC 실패: no reward_items available'))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST()
    errSpy.mockRestore()

    expect(res.status).toBe(500)
  })

  it('인증 실패(403) → status 그대로 노출', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
    const res = await POST()
    expect(res.status).toBe(403)
    expect(pullGacha).not.toHaveBeenCalled()
  })
})
