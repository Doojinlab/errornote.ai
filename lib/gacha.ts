// 가챠 — 코스메틱 보상 상자 (gamification-spec M3 / Phase G3).
// 과잉 게임화 경계: 보상은 코스메틱만(사운드팩·테마·아바타·스티커). 학습 능력에 영향 없음.
// 활동 화폐(activity_coins)로만 뽑는다. 숙련 화폐(mastery_points)와 무관.
//
// 무결성: 뽑기/차감/인벤토리 추가는 SECURITY DEFINER RPC(pull_gacha)에서 atomic 처리.
// lib 은 RPC 호출 + 조회만 담당.

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// @supabase/ssr 0.5.x ↔ supabase-js 2.105 의 SupabaseClient 제네릭 arity 불일치로
// SSR 클라이언트의 .rpc() Args 추론이 깨진다(lib/supabase.ts 참조). 정상 타입으로 좁힌다.
function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

/** 가챠 1회 기본 비용(활동 화폐). 데일리 퀘스트 1일치(≈30) ≈ 1뽑기. */
export const GACHA_COST = 30

export type RewardCategory = 'sound_pack' | 'theme' | 'avatar' | 'sticker'
export type RewardRarity = 'common' | 'rare' | 'epic'

export interface RewardItem {
  id: string
  code: string
  category: RewardCategory
  nameKo: string
  nameZh: string
  rarity: RewardRarity
  icon: string
  sortOrder: number
}

const ITEM_COLUMNS = 'id, code, category, name_ko, name_zh, rarity, icon, sort_order'

function toRewardItem(row: {
  id: string
  code: string
  category: RewardCategory
  name_ko: string
  name_zh: string
  rarity: RewardRarity
  icon: string
  sort_order: number
}): RewardItem {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    nameKo: row.name_ko,
    nameZh: row.name_zh,
    rarity: row.rarity,
    icon: row.icon,
    sortOrder: row.sort_order
  }
}

/** 가챠 카탈로그 전체(정렬 순). */
export async function listRewardItems(): Promise<RewardItem[]> {
  const { data, error } = await db()
    .from('reward_items')
    .select(ITEM_COLUMNS)
    .order('sort_order', { ascending: true })
  if (error) {
    throw new Error(`reward_items 조회 실패: ${error.message}`)
  }
  return (data as unknown as Parameters<typeof toRewardItem>[0][] | null ?? []).map(toRewardItem)
}

/** 코스메틱 한 칸: 카탈로그 + 본인 보유 여부. */
export interface RewardCell extends RewardItem {
  owned: boolean
  acquiredAt: string | null
}

/**
 * 학습자 인벤토리: 카탈로그 전체에 본인 보유 여부를 입혀 반환한다.
 * 미보유 아이템은 owned=false(잠긴 칸).
 */
export async function getRewardInventory(studentId: string): Promise<RewardCell[]> {
  const supabase = db()
  const [itemsRes, ownedRes] = await Promise.all([
    supabase.from('reward_items').select(ITEM_COLUMNS).order('sort_order', { ascending: true }),
    supabase.from('reward_inventory').select('item_id, acquired_at').eq('student_id', studentId)
  ])
  if (itemsRes.error) {
    throw new Error(`reward_items 조회 실패: ${itemsRes.error.message}`)
  }
  if (ownedRes.error) {
    throw new Error(`reward_inventory 조회 실패: ${ownedRes.error.message}`)
  }

  const items = (itemsRes.data as unknown as Parameters<typeof toRewardItem>[0][] | null ?? [])
  const owned = (ownedRes.data as unknown as Array<{ item_id: string; acquired_at: string }> | null ?? [])
  const byItem = new Map(owned.map((o) => [o.item_id, o.acquired_at]))

  return items.map((row) => {
    const item = toRewardItem(row)
    const acquiredAt = byItem.get(item.id) ?? null
    return { ...item, owned: acquiredAt !== null, acquiredAt }
  })
}

export interface GachaPullResult {
  itemCode: string
  itemId: string
  rarity: RewardRarity
  /** 이미 보유한 아이템이 나왔으면 true(비용 일부 환급됨) */
  isDuplicate: boolean
  /** 뽑기 후 활동 화폐 잔액 */
  activityCoins: number
}

/**
 * 가챠 1회 뽑기. 잔액 부족 시 RPC 에서 예외(throw).
 * 중복 아이템이 나오면 비용의 50% 가 환급되어 activityCoins 에 반영된다.
 */
export async function pullGacha(studentId: string, cost: number = GACHA_COST): Promise<GachaPullResult> {
  const { data, error } = await db().rpc('pull_gacha', {
    p_student_id: studentId,
    p_cost: cost
  })
  if (error) {
    throw new Error(`pull_gacha RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{
    item_code: string
    item_id: string
    rarity: RewardRarity
    is_duplicate: boolean
    activity_coins: number
  }> | null)?.[0]
  if (!row) {
    throw new Error('pull_gacha 결과가 비어 있습니다')
  }
  return {
    itemCode: row.item_code,
    itemId: row.item_id,
    rarity: row.rarity,
    isDuplicate: row.is_duplicate,
    activityCoins: row.activity_coins
  }
}
