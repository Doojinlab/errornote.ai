import { describe, it, expect } from 'vitest'
import { extractSpokenChinese, parseDialogueTurns, hashString } from './tts'

describe('extractSpokenChinese()', () => {
  it('한글을 제거하고 중국어만 남긴다', () => {
    expect(extractSpokenChinese('정서가치(情绪价值)')).toBe('(情绪价值)')
    expect(extractSpokenChinese('情绪价值 정서가치')).toBe('情绪价值')
  })

  it('라틴 문자는 보존한다(영·중 혼용 신조어 발화용)', () => {
    expect(extractSpokenChinese('city不city')).toBe('city不city')
    expect(extractSpokenChinese('太city了')).toBe('太city了')
  })

  it('중국어 대화 표기·문장부호는 보존', () => {
    expect(extractSpokenChinese('男：你好。女：再见！')).toBe('男：你好。女：再见！')
  })

  it('한글만 있으면 빈 문자열(라틴은 남는다)', () => {
    expect(extractSpokenChinese('안녕하세요')).toBe('')
    expect(extractSpokenChinese('hello world')).toBe('hello world')
  })
})

describe('parseDialogueTurns()', () => {
  it('男/女 표기로 화자별 발화를 나누고 표기는 제거(라벨 포함)', () => {
    expect(parseDialogueTurns('男：你好。女：再见！')).toEqual([
      { speaker: 'male', label: '男', text: '你好。' },
      { speaker: 'female', label: '女', text: '再见！' },
    ])
  })

  it('같은 성별 다중 화자는 男1/男2 라벨로 구분', () => {
    expect(parseDialogueTurns('男1：喂？男2：你好！')).toEqual([
      { speaker: 'male', label: '男1', text: '喂？' },
      { speaker: 'male', label: '男2', text: '你好！' },
    ])
  })

  it('전각/반각 콜론·줄바꿈이 섞여도 처리', () => {
    expect(parseDialogueTurns('女: 你好\n男：请坐')).toEqual([
      { speaker: 'female', label: '女', text: '你好' },
      { speaker: 'male', label: '男', text: '请坐' },
    ])
  })

  it('첫 화자 표기 앞 텍스트는 narrator', () => {
    expect(parseDialogueTurns('对话开始。男：喂？')).toEqual([
      { speaker: 'narrator', label: 'narrator', text: '对话开始。' },
      { speaker: 'male', label: '男', text: '喂？' },
    ])
  })

  it('화자 표기가 없으면 narrator 한 덩어리(독백·단어)', () => {
    expect(parseDialogueTurns('city不city')).toEqual([
      { speaker: 'narrator', label: 'narrator', text: 'city不city' },
    ])
  })
})

describe('hashString()', () => {
  it('결정적이며 입력이 다르면 값이 다르다', () => {
    expect(hashString('男：你好')).toBe(hashString('男：你好'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})
