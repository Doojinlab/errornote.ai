// 익명 시드(anon_seed = student_id 의 md5 앞 8자, 서버 RPC 가 제공) → 안정적 표시용 닉네임.
// PII 없음. 같은 시드는 항상 같은 닉네임을 준다(리그·피드에서 동일인 식별 일관성).
// gamification-spec §2 M8(익명 리그)/M9(직역 피드) — 실명 노출 금지.

const ADJECTIVES = [
  '용감한', '성실한', '빛나는', '날쌘', '따뜻한', '차분한', '명랑한', '단단한',
  '슬기로운', '씩씩한', '느긋한', '재빠른'
]
const ANIMALS = [
  '판다', '용', '호랑이', '학', '잉어', '토끼', '여우', '거북',
  '사슴', '제비', '고양이', '두루미'
]

/** 시드 문자열을 32bit 해시로(결정적). */
function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0
  }
  return h
}

/** anon_seed → "용감한 판다42" 형태의 안정적 익명 닉네임. */
export function anonNickname(seed: string): string {
  const h = hashSeed(seed)
  const adj = ADJECTIVES[h % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]
  const num = (h % 90) + 10 // 10~99
  return `${adj} ${animal}${num}`
}
