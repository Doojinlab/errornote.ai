import { describe, it, expect } from 'vitest'
import {
  LTI,
  LTI_VERSION,
  MSG_RESOURCE_LINK,
  MSG_DEEP_LINKING,
  createLoginState,
  buildAuthRequestUrl,
  extractLaunchContext,
  validateLaunchClaims,
  toolPublicJwks,
  type LtiPlatform,
  type LtiClaims,
} from './lti'

const platform: LtiPlatform = {
  issuer: 'https://canvas.test',
  client_id: 'client-123',
  deployment_id: 'dep-1',
  auth_login_url: 'https://canvas.test/api/lti/authorize_redirect',
  auth_token_url: 'https://canvas.test/login/oauth2/token',
  jwks_uri: 'https://canvas.test/api/lti/security/jwks',
}

function baseClaims(over: Partial<LtiClaims> = {}): LtiClaims {
  return {
    iss: platform.issuer,
    aud: platform.client_id,
    sub: 'user-abc',
    nonce: 'NONCE',
    [LTI.MESSAGE_TYPE]: MSG_RESOURCE_LINK,
    [LTI.VERSION]: LTI_VERSION,
    [LTI.DEPLOYMENT_ID]: platform.deployment_id,
    [LTI.TARGET_LINK_URI]: 'https://errornote.ai/api/lti/launch',
    [LTI.RESOURCE_LINK]: { id: 'rl-1' },
    [LTI.ROLES]: [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ],
    [LTI.CONTEXT]: { id: 'ctx-1', label: 'CHN101', title: '중국어 작문' },
    ...over,
  }
}

describe('createLoginState', () => {
  it('state/nonce 는 매번 다른 비어있지 않은 난수다', () => {
    const a = createLoginState()
    const b = createLoginState()
    expect(a.state.length).toBeGreaterThan(16)
    expect(a.nonce.length).toBeGreaterThan(16)
    expect(a.state).not.toBe(b.state)
    expect(a.nonce).not.toBe(b.nonce)
  })
})

describe('buildAuthRequestUrl', () => {
  it('LTI 1.3 OIDC 필수 파라미터를 모두 포함한다', () => {
    const url = new URL(
      buildAuthRequestUrl(platform, {
        loginHint: 'lh-1',
        messageHint: 'mh-1',
        redirectUri: 'https://errornote.ai/api/lti/launch',
        state: 'STATE',
        nonce: 'NONCE',
      })
    )
    expect(url.origin + url.pathname).toBe(
      'https://canvas.test/api/lti/authorize_redirect'
    )
    const q = url.searchParams
    expect(q.get('scope')).toBe('openid')
    expect(q.get('response_type')).toBe('id_token')
    expect(q.get('response_mode')).toBe('form_post')
    expect(q.get('prompt')).toBe('none')
    expect(q.get('client_id')).toBe('client-123')
    expect(q.get('redirect_uri')).toBe('https://errornote.ai/api/lti/launch')
    expect(q.get('login_hint')).toBe('lh-1')
    expect(q.get('state')).toBe('STATE')
    expect(q.get('nonce')).toBe('NONCE')
    expect(q.get('lti_message_hint')).toBe('mh-1')
    expect(q.get('lti_deployment_id')).toBe('dep-1')
  })

  it('messageHint/ deployment_id 가 없으면 해당 파라미터를 생략한다', () => {
    const url = new URL(
      buildAuthRequestUrl(
        { ...platform, deployment_id: null },
        {
          loginHint: 'lh',
          redirectUri: 'https://errornote.ai/api/lti/launch',
          state: 's',
          nonce: 'n',
        }
      )
    )
    expect(url.searchParams.has('lti_message_hint')).toBe(false)
    expect(url.searchParams.has('lti_deployment_id')).toBe(false)
  })
})

describe('extractLaunchContext', () => {
  it('Learner 런치를 올바르게 추출한다', () => {
    const ctx = extractLaunchContext(baseClaims())
    expect(ctx.messageType).toBe(MSG_RESOURCE_LINK)
    expect(ctx.version).toBe(LTI_VERSION)
    expect(ctx.deploymentId).toBe('dep-1')
    expect(ctx.sub).toBe('user-abc')
    expect(ctx.resourceLinkId).toBe('rl-1')
    expect(ctx.isLearner).toBe(true)
    expect(ctx.isInstructor).toBe(false)
    expect(ctx.context?.label).toBe('CHN101')
  })

  it('Instructor 역할을 인식한다', () => {
    const ctx = extractLaunchContext(
      baseClaims({
        [LTI.ROLES]: [
          'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
        ],
      })
    )
    expect(ctx.isInstructor).toBe(true)
    expect(ctx.isLearner).toBe(false)
  })

  it('roles 가 배열이 아니면 빈 배열로 처리한다', () => {
    const ctx = extractLaunchContext(baseClaims({ [LTI.ROLES]: undefined }))
    expect(ctx.roles).toEqual([])
    expect(ctx.isInstructor).toBe(false)
    expect(ctx.isLearner).toBe(false)
  })
})

describe('validateLaunchClaims', () => {
  const expected = {
    issuer: platform.issuer,
    nonce: 'NONCE',
    deploymentId: platform.deployment_id,
  }

  it('정상 클레임은 null(위반 없음)', () => {
    expect(validateLaunchClaims(baseClaims(), expected)).toBeNull()
  })

  it('Deep Linking 메시지도 허용한다', () => {
    expect(
      validateLaunchClaims(
        baseClaims({ [LTI.MESSAGE_TYPE]: MSG_DEEP_LINKING }),
        expected
      )
    ).toBeNull()
  })

  it('iss 불일치를 차단한다', () => {
    expect(
      validateLaunchClaims(baseClaims({ iss: 'https://evil.test' }), expected)
    ).toMatch(/iss/)
  })

  it('nonce 불일치(재생)를 차단한다', () => {
    expect(
      validateLaunchClaims(baseClaims({ nonce: 'WRONG' }), expected)
    ).toMatch(/nonce/)
  })

  it('알 수 없는 message_type 을 차단한다', () => {
    expect(
      validateLaunchClaims(
        baseClaims({ [LTI.MESSAGE_TYPE]: 'SomethingElse' }),
        expected
      )
    ).toMatch(/message_type/)
  })

  it('LTI 버전 불일치를 차단한다', () => {
    expect(
      validateLaunchClaims(baseClaims({ [LTI.VERSION]: '1.2.0' }), expected)
    ).toMatch(/version/)
  })

  it('deployment_id 누락/불일치를 차단한다', () => {
    expect(
      validateLaunchClaims(
        baseClaims({ [LTI.DEPLOYMENT_ID]: undefined }),
        expected
      )
    ).toMatch(/deployment_id/)
    expect(
      validateLaunchClaims(
        baseClaims({ [LTI.DEPLOYMENT_ID]: 'other' }),
        expected
      )
    ).toMatch(/deployment_id/)
  })
})

describe('toolPublicJwks', () => {
  it('LTI_TOOL_PUBLIC_JWK 미설정 시 빈 키셋', () => {
    const saved = process.env.LTI_TOOL_PUBLIC_JWK
    delete process.env.LTI_TOOL_PUBLIC_JWK
    expect(toolPublicJwks()).toEqual({ keys: [] })
    if (saved !== undefined) process.env.LTI_TOOL_PUBLIC_JWK = saved
  })

  it('유효한 JWK JSON 을 키셋으로 노출한다', () => {
    const saved = process.env.LTI_TOOL_PUBLIC_JWK
    process.env.LTI_TOOL_PUBLIC_JWK = JSON.stringify({ kty: 'RSA', kid: 'k1' })
    expect(toolPublicJwks().keys).toHaveLength(1)
    expect(toolPublicJwks().keys[0]).toMatchObject({ kid: 'k1' })
    if (saved === undefined) delete process.env.LTI_TOOL_PUBLIC_JWK
    else process.env.LTI_TOOL_PUBLIC_JWK = saved
  })

  it('깨진 JSON 은 빈 키셋으로 안전 폴백', () => {
    const saved = process.env.LTI_TOOL_PUBLIC_JWK
    process.env.LTI_TOOL_PUBLIC_JWK = '{not json'
    expect(toolPublicJwks()).toEqual({ keys: [] })
    if (saved === undefined) delete process.env.LTI_TOOL_PUBLIC_JWK
    else process.env.LTI_TOOL_PUBLIC_JWK = saved
  })
})
