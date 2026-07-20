import { describe, it, expect } from 'vitest'
import { HANZI_CHARS, hanziDataUrl } from './handwriting'

describe('HANZI_CHARS', () => {
  it('비어 있지 않다', () => {
    expect(HANZI_CHARS.length).toBeGreaterThan(0)
  })

  it('모든 char 는 단일 글자이고 pinyin·meaning 이 채워져 있다', () => {
    for (const e of HANZI_CHARS) {
      expect([...e.char]).toHaveLength(1)
      expect(e.pinyin.trim().length).toBeGreaterThan(0)
      expect(e.meaning.trim().length).toBeGreaterThan(0)
    }
  })

  it('중복 글자가 없다', () => {
    const set = new Set(HANZI_CHARS.map((e) => e.char))
    expect(set.size).toBe(HANZI_CHARS.length)
  })
})

describe('hanziDataUrl()', () => {
  it('로컬 번들 경로를 URL 인코딩해 만든다', () => {
    expect(hanziDataUrl('你')).toBe(`/hanzi-data/${encodeURIComponent('你')}.json`)
    expect(hanziDataUrl('一')).toContain('/hanzi-data/')
  })
})
