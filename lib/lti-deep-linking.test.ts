import { describe, it, expect } from 'vitest'
import { LTI, LTI_VERSION } from './lti'
import {
  MSG_DEEP_LINKING_RESPONSE,
  DL,
  parseDeepLinkingSettings,
  buildResourceLinkContentItem,
  buildDeepLinkingResponseClaims,
  buildAutoPostForm,
  buildSelectionPage,
} from './lti-deep-linking'

describe('parseDeepLinkingSettings', () => {
  it('return_url 이 있으면 설정을 파싱한다', () => {
    const s = parseDeepLinkingSettings({
      deep_link_return_url: 'https://lms/return',
      data: 'd1',
      accept_types: ['ltiResourceLink', 'link'],
      accept_multiple: true,
      accept_presentation_document_targets: ['iframe', 'window'],
    })
    expect(s).toEqual({
      returnUrl: 'https://lms/return',
      data: 'd1',
      acceptTypes: ['ltiResourceLink', 'link'],
      acceptMultiple: true,
      acceptPresentationDocumentTargets: ['iframe', 'window'],
    })
  })

  it('return_url 이 없으면 null', () => {
    expect(parseDeepLinkingSettings({ data: 'x' })).toBeNull()
    expect(parseDeepLinkingSettings(null)).toBeNull()
    expect(parseDeepLinkingSettings('str')).toBeNull()
  })

  it('accept_multiple 문자열 "true" 도 boolean 으로 정규화', () => {
    const s = parseDeepLinkingSettings({
      deep_link_return_url: 'https://lms/return',
      accept_multiple: 'true',
    })
    expect(s?.acceptMultiple).toBe(true)
  })
})

describe('buildResourceLinkContentItem', () => {
  it('custom 값을 모두 문자열화한다', () => {
    const item = buildResourceLinkContentItem({
      url: 'https://app/api/lti/launch',
      title: '제3장',
      custom: { chapter: 3, mode: 'learn' },
    })
    expect(item).toEqual({
      type: 'ltiResourceLink',
      title: '제3장',
      url: 'https://app/api/lti/launch',
      custom: { chapter: '3', mode: 'learn' },
    })
  })
})

describe('buildDeepLinkingResponseClaims', () => {
  const base = {
    clientId: 'client-123',
    issuer: 'https://lms.example.edu',
    deploymentId: 'dep-1',
    contentItems: [
      buildResourceLinkContentItem({ url: 'https://app/launch', title: '제1장', custom: { chapter: 1 } }),
    ],
    nonce: 'n1',
    nowSec: 1_000_000,
  }

  it('iss=client_id, aud=issuer 로 방향이 반대다', () => {
    const c = buildDeepLinkingResponseClaims(base)
    expect(c.iss).toBe('client-123')
    expect(c.aud).toBe('https://lms.example.edu')
    expect(c.azp).toBe('client-123')
  })

  it('LTI message_type/version/deployment/content_items 클레임을 담는다', () => {
    const c = buildDeepLinkingResponseClaims(base)
    expect(c[LTI.MESSAGE_TYPE]).toBe(MSG_DEEP_LINKING_RESPONSE)
    expect(c[LTI.VERSION]).toBe(LTI_VERSION)
    expect(c[LTI.DEPLOYMENT_ID]).toBe('dep-1')
    expect(c[DL.CONTENT_ITEMS]).toHaveLength(1)
  })

  it('exp = iat + ttl(기본 300)', () => {
    const c = buildDeepLinkingResponseClaims(base)
    expect(c.iat).toBe(1_000_000)
    expect(c.exp).toBe(1_000_300)
  })

  it('data 가 있으면 echo, 없으면 클레임 생략', () => {
    expect(buildDeepLinkingResponseClaims({ ...base, data: 'echo-me' })[DL.DATA]).toBe('echo-me')
    expect(DL.DATA in buildDeepLinkingResponseClaims({ ...base, data: null })).toBe(false)
  })
})

describe('buildAutoPostForm', () => {
  it('JWT 와 return_url 을 담은 자동제출 폼을 만든다', () => {
    const html = buildAutoPostForm('https://lms/return', 'JWT.VALUE.HERE')
    expect(html).toContain('document.forms[0].submit()')
    expect(html).toContain('action="https://lms/return"')
    expect(html).toContain('name="JWT"')
    expect(html).toContain('value="JWT.VALUE.HERE"')
  })

  it('HTML 특수문자를 이스케이프한다(XSS 방지)', () => {
    const html = buildAutoPostForm('https://lms/return?a="b"', '<script>x</script>')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&quot;b&quot;')
  })
})

describe('buildSelectionPage', () => {
  it('챕터 라디오 + 토큰 hidden + action 을 렌더한다', () => {
    const html = buildSelectionPage({
      token: 'TOK.123',
      actionUrl: 'https://app/api/lti/deep-link/respond',
      chapters: [
        { value: 0, label: '제0장' },
        { value: 1, label: '제1장' },
      ],
      appName: 'errornote',
      heading: '챕터 선택',
      instruction: '안내',
      submitLabel: '추가',
    })
    expect(html).toContain('name="token"')
    expect(html).toContain('value="TOK.123"')
    expect(html).toContain('action="https://app/api/lti/deep-link/respond"')
    expect(html).toContain('value="0"')
    expect(html).toContain('value="1"')
    expect(html).toContain('제0장')
    // 첫 항목 기본 선택
    expect(html).toMatch(/value="0"\s+checked/)
  })
})
