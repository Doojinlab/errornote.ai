import { describe, it, expect } from 'vitest'
import { pinyinToneParts, toneTextClass } from './pinyin-tone'

describe('pinyinToneParts()', () => {
  it('음절별로 성조를 판정하고 공백을 보존', () => {
    const parts = pinyinToneParts('yán zhí')
    expect(parts.map((p) => p.text)).toEqual(['yán', ' ', 'zhí'])
    expect(parts[0].tone).toBe(2) // yán
    expect(parts[1].tone).toBe(0) // 공백
    expect(parts[2].tone).toBe(2) // zhí
  })

  it('숫자 표기 병음도 처리', () => {
    const parts = pinyinToneParts('ni3 hao3')
    expect(parts[0].tone).toBe(3)
    expect(parts[2].tone).toBe(3)
  })

  it('경성/미지는 tone 0', () => {
    expect(pinyinToneParts('ma')[0].tone).toBe(0)
  })

  it('빈 문자열은 빈 배열', () => {
    expect(pinyinToneParts('')).toEqual([])
    expect(pinyinToneParts('   ')).toEqual([])
  })
})

describe('toneTextClass()', () => {
  it('성조별 팔레트 토큰 클래스를 반환', () => {
    expect(toneTextClass(1)).toBe('text-terra')
    expect(toneTextClass(2)).toBe('text-gold')
    expect(toneTextClass(3)).toBe('text-jade')
    expect(toneTextClass(4)).toBe('text-blue')
    expect(toneTextClass(0)).toBe('text-muted')
  })
})
