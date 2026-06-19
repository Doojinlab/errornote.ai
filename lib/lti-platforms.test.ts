import { describe, it, expect } from 'vitest'
import { isHttpUrl, validatePlatformInput } from './lti-platforms'

describe('isHttpUrl', () => {
  it('http/https 절대 URL 만 true', () => {
    expect(isHttpUrl('https://canvas.edu')).toBe(true)
    expect(isHttpUrl('http://localhost:3000')).toBe(true)
    expect(isHttpUrl('ftp://x')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
  })
})

const VALID = {
  name: '우리대학 Canvas',
  issuer: 'https://canvas.instructure.com',
  clientId: '10000000000001',
  authLoginUrl: 'https://canvas.instructure.com/api/lti/authorize_redirect',
  authTokenUrl: 'https://canvas.instructure.com/login/oauth2/token',
  jwksUri: 'https://canvas.instructure.com/api/lti/security/jwks',
}

describe('validatePlatformInput', () => {
  it('정상 입력 → ok + 정규화된 값', () => {
    const r = validatePlatformInput({ ...VALID, deploymentId: 'dep-1' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('우리대학 Canvas')
      expect(r.value.deploymentId).toBe('dep-1')
      expect(r.value.classId).toBeNull()
    }
  })

  it('snake_case 키도 허용한다', () => {
    const r = validatePlatformInput({
      name: 'X',
      issuer: VALID.issuer,
      client_id: 'c1',
      auth_login_url: VALID.authLoginUrl,
      auth_token_url: VALID.authTokenUrl,
      jwks_uri: VALID.jwksUri,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.clientId).toBe('c1')
  })

  it('name 누락 → 에러', () => {
    const r = validatePlatformInput({ ...VALID, name: '  ' })
    expect(r).toEqual({ ok: false, error: expect.stringContaining('name') })
  })

  it('issuer 가 URL 이 아니면 → 에러', () => {
    const r = validatePlatformInput({ ...VALID, issuer: 'canvas' })
    expect(r.ok).toBe(false)
  })

  it('엔드포인트 URL 이 잘못되면 → 에러', () => {
    expect(validatePlatformInput({ ...VALID, jwksUri: 'nope' }).ok).toBe(false)
    expect(validatePlatformInput({ ...VALID, authTokenUrl: '' }).ok).toBe(false)
  })

  it('client_id 누락 → 에러', () => {
    const r = validatePlatformInput({ ...VALID, clientId: '' })
    expect(r.ok).toBe(false)
  })

  it('class_id 가 UUID 아니면 → 에러, 빈 값이면 null', () => {
    expect(validatePlatformInput({ ...VALID, classId: 'not-uuid' }).ok).toBe(false)
    const r = validatePlatformInput({ ...VALID, classId: '' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.classId).toBeNull()
  })

  it('deployment_id 는 선택 — 없으면 null', () => {
    const r = validatePlatformInput(VALID)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.deploymentId).toBeNull()
  })
})
