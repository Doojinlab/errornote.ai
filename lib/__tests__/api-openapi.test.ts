import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/docs/openapi.json/route'

describe('OpenAPI spec (/api/docs/openapi.json)', () => {
  it('returns a valid OpenAPI 3 document', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const spec = await res.json()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.paths).toBeTruthy()
    expect(spec.components?.schemas).toBeTruthy()
  })

  it('documents the LMS API endpoints', async () => {
    const spec = await (await GET()).json()
    expect(spec.paths['/api/lms/classes']).toBeTruthy()
    expect(spec.paths['/api/lms/keys']).toBeTruthy()
  })

  it('documents all LTI 1.3 endpoints (acceptance criterion #47)', async () => {
    const spec = await (await GET()).json()
    for (const p of [
      '/api/lti/login',
      '/api/lti/launch',
      '/api/lti/jwks',
      '/api/lti/deep-link/respond',
      '/api/lti/platforms',
      '/api/lti/platforms/{id}',
    ]) {
      expect(spec.paths[p], `missing path ${p}`).toBeTruthy()
    }
    // protocol-level endpoints carry no API-key/session security
    expect(spec.paths['/api/lti/launch'].post.security).toEqual([])
    expect(spec.paths['/api/lti/jwks'].get.security).toEqual([])
    // management endpoints are session-secured
    expect(spec.paths['/api/lti/platforms'].post.security).toEqual([{ cookieAuth: [] }])
    // referenced schemas + security scheme are defined
    expect(spec.components.schemas.LtiPlatform).toBeTruthy()
    expect(spec.components.schemas.Jwks).toBeTruthy()
    expect(spec.components.securitySchemes.cookieAuth).toBeTruthy()
    expect(spec.tags.some((t: { name: string }) => t.name === 'LTI 1.3')).toBe(true)
  })
})
