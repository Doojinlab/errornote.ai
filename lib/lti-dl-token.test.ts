import { describe, it, expect } from 'vitest'
import { mintDeepLinkToken, verifyDeepLinkToken } from './lti-dl-token'

const SECRET = 'test-secret-key'
const BASE = {
  iss: 'https://lms.example.edu',
  cid: 'client-123',
  dep: 'dep-1',
  ru: 'https://lms.example.edu/deep_link_return',
  data: 'opaque-data',
}

describe('mint/verifyDeepLinkToken', () => {
  it('민팅한 토큰을 같은 비밀키로 검증하면 페이로드를 복원한다', () => {
    const now = 1_000_000
    const token = mintDeepLinkToken(BASE, SECRET, now, 900)
    const payload = verifyDeepLinkToken(token, SECRET, now + 10)
    expect(payload).toMatchObject({ ...BASE, exp: now + 900 })
  })

  it('비밀키가 다르면 검증 실패(null)', () => {
    const now = 1_000_000
    const token = mintDeepLinkToken(BASE, SECRET, now)
    expect(verifyDeepLinkToken(token, 'other-secret', now)).toBeNull()
  })

  it('서명 위조(페이로드 변조) 시 검증 실패', () => {
    const now = 1_000_000
    const token = mintDeepLinkToken(BASE, SECRET, now)
    const [, sig] = token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...BASE, exp: now + 900, cid: 'attacker' }),
      'utf8'
    ).toString('base64url')
    expect(verifyDeepLinkToken(`${forgedPayload}.${sig}`, SECRET, now)).toBeNull()
  })

  it('만료된 토큰은 검증 실패', () => {
    const now = 1_000_000
    const token = mintDeepLinkToken(BASE, SECRET, now, 60)
    expect(verifyDeepLinkToken(token, SECRET, now + 61)).toBeNull()
  })

  it('형식이 잘못된 토큰은 검증 실패', () => {
    expect(verifyDeepLinkToken('garbage', SECRET, 0)).toBeNull()
    expect(verifyDeepLinkToken('', SECRET, 0)).toBeNull()
    expect(verifyDeepLinkToken('a.b.c', SECRET, 0)).toBeNull()
  })

  it('data 가 null 이어도 왕복한다', () => {
    const now = 1_000_000
    const token = mintDeepLinkToken({ ...BASE, data: null }, SECRET, now)
    const payload = verifyDeepLinkToken(token, SECRET, now)
    expect(payload?.data).toBeNull()
  })
})
