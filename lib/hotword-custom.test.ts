import { describe, it, expect } from 'vitest'
import { parseCustomHotword, buildCustomHotwordUserPrompt } from './hotword-custom'

const VALID = JSON.stringify({
  term: '颜值',
  pinyin: 'yán zhí',
  literal: '얼굴 가치',
  meaning: '외모 수준',
  example: '他的颜值很高。',
  origin: '인터넷 유행어',
  register_tag: '인터넷 유행어',
})

describe('parseCustomHotword()', () => {
  it('정상 JSON 파싱 + register_tag 매핑', () => {
    const c = parseCustomHotword(VALID)
    expect(c.term).toBe('颜值')
    expect(c.pinyin).toBe('yán zhí')
    expect(c.meaning).toBe('외모 수준')
    expect(c.registerTag).toBe('인터넷 유행어')
  })

  it('코드펜스 감싼 응답도 파싱', () => {
    expect(parseCustomHotword('```json\n' + VALID + '\n```').term).toBe('颜值')
  })

  it('표현(term) 없으면 에러', () => {
    expect(() => parseCustomHotword(JSON.stringify({ meaning: 'x' }))).toThrow(/표현/)
  })

  it('뜻(meaning) 없으면 에러', () => {
    expect(() => parseCustomHotword(JSON.stringify({ term: '颜值' }))).toThrow(/뜻/)
  })
})

describe('buildCustomHotwordUserPrompt()', () => {
  it('주제를 포함', () => {
    expect(buildCustomHotwordUserPrompt('축구')).toContain('축구')
  })
})
