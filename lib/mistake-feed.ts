// 직역 명문장 피드 (Funny Mistakes Feed) — gamification-spec M9 / Phase G4.
// 한↔중 웃긴 직역/오역을 "오늘의 명문장"으로. **기본 비공개**, 명시 동의(is_public) 시에만
// 익명으로 노출(직접 타인 조회 불가 → 공개 피드는 RPC 익명 집계).

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { anonNickname } from './anon'

function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

export interface MistakeEntry {
  id: string
  originalKo: string
  literalZh: string
  correctedZh: string
  isPublic: boolean
  likes: number
  createdAt: string
}

const ENTRY_COLUMNS = 'id, original_ko, literal_zh, corrected_zh, is_public, likes, created_at'

function toEntry(row: {
  id: string
  original_ko: string
  literal_zh: string
  corrected_zh: string
  is_public: boolean
  likes: number
  created_at: string
}): MistakeEntry {
  return {
    id: row.id,
    originalKo: row.original_ko,
    literalZh: row.literal_zh,
    correctedZh: row.corrected_zh,
    isPublic: row.is_public,
    likes: row.likes,
    createdAt: row.created_at
  }
}

export interface NewMistake {
  originalKo: string
  literalZh: string
  correctedZh?: string
  /** 명시 동의. 기본 false(비공개). */
  isPublic?: boolean
}

/** 직역 항목 등록. 기본 비공개. 등록된 id 반환. */
export async function submitMistake(studentId: string, entry: NewMistake): Promise<string> {
  const { data, error } = await db()
    .from('mistake_feed')
    .insert({
      student_id: studentId,
      original_ko: entry.originalKo,
      literal_zh: entry.literalZh,
      corrected_zh: entry.correctedZh ?? '',
      is_public: entry.isPublic ?? false
    })
    .select('id')
    .single()
  if (error) {
    throw new Error(`mistake_feed 등록 실패: ${error.message}`)
  }
  return (data as unknown as { id: string }).id
}

/** 본인이 등록한 직역 항목 목록(최신순). */
export async function getMyMistakes(studentId: string): Promise<MistakeEntry[]> {
  const { data, error } = await db()
    .from('mistake_feed')
    .select(ENTRY_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`mistake_feed 조회 실패: ${error.message}`)
  }
  return (data as unknown as Parameters<typeof toEntry>[0][] | null ?? []).map(toEntry)
}

/** 공개 여부(opt-in) 토글. 본인 항목만(RLS 로 보장). */
export async function setMistakePublic(studentId: string, id: string, isPublic: boolean): Promise<void> {
  const { error } = await db()
    .from('mistake_feed')
    .update({ is_public: isPublic })
    .eq('id', id)
    .eq('student_id', studentId)
  if (error) {
    throw new Error(`mistake_feed 공개설정 실패: ${error.message}`)
  }
}

export interface PublicMistake {
  id: string
  originalKo: string
  literalZh: string
  correctedZh: string
  likes: number
  nickname: string
  isMe: boolean
  createdAt: string
}

/** 공개(opt-in) 직역 피드 — 익명 노출(anon_seed → 닉네임). */
export async function getPublicFeed(limit = 30): Promise<PublicMistake[]> {
  const { data, error } = await db().rpc('get_public_mistake_feed', { p_limit: limit })
  if (error) {
    throw new Error(`get_public_mistake_feed RPC 실패: ${error.message}`)
  }
  const rows = (data as unknown as Array<{
    id: string
    original_ko: string
    literal_zh: string
    corrected_zh: string
    likes: number
    anon_seed: string
    is_me: boolean
    created_at: string
  }> | null) ?? []
  return rows.map((r) => ({
    id: r.id,
    originalKo: r.original_ko,
    literalZh: r.literal_zh,
    correctedZh: r.corrected_zh,
    likes: r.likes,
    nickname: anonNickname(r.anon_seed),
    isMe: r.is_me,
    createdAt: r.created_at
  }))
}
