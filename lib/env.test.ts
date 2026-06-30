import { afterEach, describe, expect, it } from 'vitest'
import {
  REQUIRED_SERVER_ENV,
  checkServerEnv,
  assertServerEnv,
} from './env'

// process.env 를 직접 조작하므로 각 테스트 후 원상복구한다.
const ORIGINAL = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key]
  }
  Object.assign(process.env, ORIGINAL)
})

function setAllRequired() {
  for (const name of REQUIRED_SERVER_ENV) process.env[name] = 'x'
}
function clearAllRequired() {
  for (const name of REQUIRED_SERVER_ENV) delete process.env[name]
}

describe('checkServerEnv', () => {
  it('모두 설정되면 ok=true, missing=[] (기본 인자 process.env 경로)', () => {
    setAllRequired()
    const result = checkServerEnv()
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('아무것도 없으면 모든 이름을 missing 으로 보고', () => {
    clearAllRequired()
    const result = checkServerEnv()
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([...REQUIRED_SERVER_ENV])
  })

  it('빈 문자열/공백뿐인 값도 누락으로 취급', () => {
    setAllRequired()
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    process.env.ANTHROPIC_API_KEY = '   '
    const result = checkServerEnv()
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(result.missing).toContain('ANTHROPIC_API_KEY')
    expect(result.missing).not.toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('명시적 env 객체를 받으면 process.env 를 읽지 않는다', () => {
    clearAllRequired() // process.env 는 비어 있어도
    const result = checkServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'u',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
      SUPABASE_SERVICE_ROLE_KEY: 's',
      ANTHROPIC_API_KEY: 'k',
    })
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('결과에 env 값은 절대 노출하지 않는다 (이름만)', () => {
    clearAllRequired()
    process.env.ANTHROPIC_API_KEY = 'super-secret-value'
    const result = checkServerEnv()
    // 값이 있으니 누락이 아니고, 직렬화해도 시크릿 값이 새지 않는다.
    expect(result.missing).not.toContain('ANTHROPIC_API_KEY')
    expect(JSON.stringify(result)).not.toContain('super-secret-value')
  })
})

describe('assertServerEnv', () => {
  it('모두 설정되면 throw 하지 않음', () => {
    setAllRequired()
    expect(() => assertServerEnv()).not.toThrow()
  })

  it('누락 시 이름을 담아 throw (값은 포함하지 않음)', () => {
    clearAllRequired()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'set'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'set'
    process.env.ANTHROPIC_API_KEY = 'set'
    expect(() => assertServerEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('명시적 env 객체 경로도 동작', () => {
    expect(() =>
      assertServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'u',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
        SUPABASE_SERVICE_ROLE_KEY: 's',
        ANTHROPIC_API_KEY: 'k',
      })
    ).not.toThrow()
  })
})
