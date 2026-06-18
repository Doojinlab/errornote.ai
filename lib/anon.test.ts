import { describe, it, expect } from 'vitest'
import { anonNickname } from './anon'

describe('anonNickname()', () => {
  it('같은 시드 → 항상 같은 닉네임(결정적)', () => {
    expect(anonNickname('abc12345')).toBe(anonNickname('abc12345'))
  })

  it('형식: "<형용사> <동물><10~99>"', () => {
    const n = anonNickname('deadbeef')
    expect(n).toMatch(/^[가-힣]+ [가-힣]+\d{2}$/)
  })

  it('다른 시드는 (대체로) 다른 닉네임', () => {
    const names = new Set(
      ['00000000', '11111111', 'a1b2c3d4', 'ffffffff', '12345678', 'cafebabe'].map(anonNickname)
    )
    // 충돌 가능성은 있으나 6개가 모두 동일하진 않아야 한다.
    expect(names.size).toBeGreaterThan(1)
  })
})
