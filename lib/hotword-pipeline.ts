// 今日热词 — 완전 자동 파이프라인 5단계 (docs/dashboard-features.md §2.4)
//
//  1. 수집        관심분야별 web search(微博/小红书/抖音/知乎). 넓게 수집.
//  2. 실재검증①   서로 다른 출처 2곳↑ + 최근 2~3개월. 근거 약하면 폐기.
//  3. 해설생성    통과 표현만 카드 필드 생성. 반드시 수집 출처 근거(백지 생성 금지).
//  4. 안전·격식②  비속어/성적/정치민감 차단 + 격식도 태그.
//  5. 큐레이션·배포 중복 제거 → 분야별 풀 → active 배포.
//
// 원칙(fail-closed): 확신 없으면 내보내지 않는다. 각 게이트의 침묵이 사람 검수를 대신한다.
// ⚠️ 기존 weekly_cardnews 와 무관. hotwords 테이블만 다룬다.

import Anthropic from '@anthropic-ai/sdk'
import { dispatchJSON } from '@/lib/ai/dispatch'
import { modelForTask } from '@/lib/ai/router'
import { extractFirstJsonObject } from '@/lib/parser'
import { createAdminClient } from '@/lib/supabase'
import { HOTWORD_CATEGORY_LABEL } from '@/lib/hotwords'
import type {
  HotwordCandidate,
  HotwordCategory,
  HotwordPipelineResult,
  HotwordSource,
} from '@/types/hotwords'

const ALL_CATEGORIES: HotwordCategory[] = [
  'game',
  'entertainment',
  'society',
  'economy',
  'daily',
  'meme',
]

// 신선도 창(일). 배포 카드의 기본 노출 만료.
const EXPOSURE_DAYS = 21

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

function messageText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

// ── 1. 수집 (web search) ─────────────────────────────────────
export async function collectCandidates(
  category: HotwordCategory,
): Promise<HotwordCandidate[]> {
  const label = HOTWORD_CATEGORY_LABEL[category]
  const system =
    '당신은 중국 인터넷 문화 리서처입니다. 웹 검색으로 "요즘(최근 2~3개월) 실제로 쓰이는" ' +
    '중국 신조어·유행어를 찾습니다. 오래된 표현·사전 표제어·추측은 제외합니다.'
  const user =
    `주제: ${label}. 微博 热搜 / 小红书 / 抖音 / 知乎 등에서 요즘 뜨는 중국어 신조어·유행어를 ` +
    `웹 검색으로 찾아줘. 각 표현마다 서로 다른 출처 2곳 이상을 확보해줘.\n` +
    `검색을 마친 뒤, 아래 JSON 객체 하나만 출력(설명·마크다운 금지):\n` +
    `{"candidates":[{"term":"표현","sources":[{"name":"출처명","url":"링크","date":"YYYY-MM"}]}]}`

  let msg: Anthropic.Message
  try {
    msg = await client().messages.create({
      model: modelForTask('hotword-collect'),
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    })
  } catch (err) {
    console.error('[hotword-pipeline] 수집 실패:', err)
    return []
  }

  const jsonStr = extractFirstJsonObject(messageText(msg))
  if (!jsonStr) return []
  try {
    const parsed = JSON.parse(jsonStr) as {
      candidates?: Array<{ term?: unknown; sources?: unknown }>
    }
    const out: HotwordCandidate[] = []
    for (const c of parsed.candidates ?? []) {
      const term = typeof c.term === 'string' ? c.term.trim() : ''
      if (!term) continue
      const sources: HotwordSource[] = Array.isArray(c.sources)
        ? c.sources
            .map((s) => {
              const o = (s ?? {}) as Record<string, unknown>
              const name = typeof o.name === 'string' ? o.name.trim() : ''
              if (!name) return null
              return {
                name,
                url: typeof o.url === 'string' ? o.url : undefined,
                date: typeof o.date === 'string' ? o.date : undefined,
              } as HotwordSource
            })
            .filter((s): s is HotwordSource => s !== null)
        : []
      out.push({ term, category, sources })
    }
    return out
  } catch {
    return []
  }
}

// ── 2. 실재검증 게이트① ──────────────────────────────────────
// 서로 다른 출처(name 기준) 2곳 이상이어야 통과. 근거 약하면 폐기.
export function passesExistenceGate(c: HotwordCandidate): boolean {
  const distinct = new Set(c.sources.map((s) => s.name.toLowerCase()))
  return distinct.size >= 2
}

// ── 3. 해설 생성 ─────────────────────────────────────────────
interface ExplainResult {
  pinyin: string
  literal: string
  meaning: string
  example: string
  origin: string
  registerTag: string
  grounded: boolean // 수집 출처에 근거해 확신할 수 있는가(백지 생성 금지)
}

export async function explainCandidate(
  c: HotwordCandidate,
): Promise<ExplainResult | null> {
  const sourcesText = c.sources
    .map((s) => `- ${s.name}${s.url ? ` (${s.url})` : ''}${s.date ? ` [${s.date}]` : ''}`)
    .join('\n')
  const system =
    '당신은 중국어 신조어 해설가입니다. 반드시 제시된 표현과 출처 근거에만 기반해 해설합니다. ' +
    '근거가 부족해 확신할 수 없으면 grounded=false 로 정직하게 표시합니다(백지 생성 금지).'
  const user =
    `표현: ${c.term}\n분야: ${HOTWORD_CATEGORY_LABEL[c.category]}\n출처:\n${sourcesText || '(없음)'}\n\n` +
    `아래 JSON 하나만 출력:\n` +
    `{"pinyin":"","literal":"직역","meaning":"실제 의미·뉘앙스(한국어)","example":"중국어 예문",` +
    `"origin":"유래(한국어)","registerTag":"격식도(예: 인터넷 유행어/구어/중립)","grounded":true}`

  try {
    return await dispatchJSON<ExplainResult>(
      'hotword-generate',
      { system, messages: [{ role: 'user', content: user }], maxTokens: 1200, thinking: false },
      (raw) => {
        const j = extractFirstJsonObject(raw)
        if (!j) throw new Error('해설 JSON 없음')
        const o = JSON.parse(j) as Record<string, unknown>
        return {
          pinyin: String(o.pinyin ?? ''),
          literal: String(o.literal ?? ''),
          meaning: String(o.meaning ?? ''),
          example: String(o.example ?? ''),
          origin: String(o.origin ?? ''),
          registerTag: String(o.registerTag ?? ''),
          grounded: o.grounded === true,
        }
      },
    )
  } catch (err) {
    console.error('[hotword-pipeline] 해설 생성 실패:', c.term, err)
    return null
  }
}

// ── 4. 안전·격식 필터 게이트② ────────────────────────────────
interface SafetyResult {
  allowed: boolean
  registerTag: string
  reason: string
}

export async function safetyFilter(
  term: string,
  meaning: string,
): Promise<SafetyResult> {
  const system =
    '당신은 교육용 콘텐츠 안전 심사자입니다. 학부생 대상 학습 카드로 부적절한 표현을 차단합니다. ' +
    '비속어·성적·혐오·중국 정치민감(은어 포함) 표현이면 allowed=false. 애매하면 보수적으로 차단합니다.'
  const user =
    `표현: ${term}\n의미: ${meaning}\n\n` +
    `아래 JSON 하나만 출력: {"allowed":true,"registerTag":"격식도 태그","reason":"판정 사유(한국어)"}`
  try {
    return await dispatchJSON<SafetyResult>(
      'hotword-generate',
      { system, messages: [{ role: 'user', content: user }], maxTokens: 400, thinking: false },
      (raw) => {
        const j = extractFirstJsonObject(raw)
        if (!j) throw new Error('안전필터 JSON 없음')
        const o = JSON.parse(j) as Record<string, unknown>
        return {
          allowed: o.allowed === true,
          registerTag: String(o.registerTag ?? ''),
          reason: String(o.reason ?? ''),
        }
      },
    )
  } catch (err) {
    // fail-closed: 심사 실패 시 차단.
    console.error('[hotword-pipeline] 안전필터 실패(차단):', term, err)
    return { allowed: false, registerTag: '', reason: '심사 실패' }
  }
}

// ── 5. 큐레이션·배포 ────────────────────────────────────────
// 중복(term 기준) 제거 후 active 로 upsert. 이미 있는 term 은 건너뛴다(동면 카드도 보존).
async function publishCard(
  admin: ReturnType<typeof createAdminClient>,
  c: HotwordCandidate,
  ex: ExplainResult,
  registerTag: string,
): Promise<'published' | 'duplicate'> {
  const { data: existing } = await admin
    .from('hotwords')
    .select('id')
    .eq('term', c.term)
    .maybeSingle()
  if (existing) return 'duplicate'

  const exposureUntil = new Date()
  exposureUntil.setDate(exposureUntil.getDate() + EXPOSURE_DAYS)

  const { error } = await admin.from('hotwords').insert({
    term: c.term,
    category: c.category,
    pinyin: ex.pinyin || null,
    literal: ex.literal || null,
    meaning: ex.meaning || null,
    example: ex.example || null,
    origin: ex.origin || null,
    register_tag: registerTag || ex.registerTag || null,
    sources: c.sources as unknown as import('@/types/database').Json,
    status: 'active',
    exposure_until: exposureUntil.toISOString().slice(0, 10),
  })
  if (error) {
    console.error('[hotword-pipeline] 배포 실패:', c.term, error)
    return 'duplicate'
  }
  return 'published'
}

/** 전체 파이프라인 실행. categories 미지정 시 전 분야. */
export async function runHotwordPipeline(
  categories: HotwordCategory[] = ALL_CATEGORIES,
): Promise<HotwordPipelineResult> {
  const admin = createAdminClient()
  const result: HotwordPipelineResult = {
    collected: 0,
    passedExistence: 0,
    explained: 0,
    passedSafety: 0,
    published: 0,
    skippedDuplicate: 0,
  }

  for (const category of categories) {
    const candidates = await collectCandidates(category)
    result.collected += candidates.length

    for (const c of candidates) {
      // 2. 실재검증
      if (!passesExistenceGate(c)) continue
      result.passedExistence += 1

      // 3. 해설 — 근거 없으면 폐기(백지 생성 금지)
      const ex = await explainCandidate(c)
      if (!ex || !ex.grounded || !ex.meaning) continue
      result.explained += 1

      // 4. 안전·격식
      const safety = await safetyFilter(c.term, ex.meaning)
      if (!safety.allowed) continue
      result.passedSafety += 1

      // 5. 배포
      const outcome = await publishCard(admin, c, ex, safety.registerTag)
      if (outcome === 'published') result.published += 1
      else result.skippedDuplicate += 1
    }
  }

  return result
}
