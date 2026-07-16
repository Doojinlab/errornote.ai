import { describe, it, expect } from 'vitest'
import { extractSpokenChinese } from './tts'

describe('extractSpokenChinese()', () => {
  it('한글을 제거하고 중국어만 남긴다', () => {
    expect(extractSpokenChinese('정서가치(情绪价值)')).toBe('(情绪价值)')
    expect(extractSpokenChinese('情绪价值 정서가치')).toBe('情绪价值')
  })

  it('라틴 문자 제거', () => {
    expect(extractSpokenChinese('city不city')).toBe('不')
  })

  it('중국어 대화 표기·문장부호는 보존', () => {
    expect(extractSpokenChinese('男：你好。女：再见！')).toBe('男：你好。女：再见！')
  })

  it('중국어가 없으면 빈 문자열', () => {
    expect(extractSpokenChinese('안녕하세요')).toBe('')
    expect(extractSpokenChinese('hello world')).toBe('')
  })
})
