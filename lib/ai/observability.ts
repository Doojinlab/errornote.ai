import type Anthropic from '@anthropic-ai/sdk'
import { trackMetric } from '@/lib/monitoring'

export interface CacheUsageRecord {
  label: string
  model: string
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  input_tokens: number
  output_tokens: number
  /** read / (read + create + uncached). 0 = cold, 1 = 전부 캐시 hit. */
  cache_hit_ratio: number
  cache_total_input: number
  /** 추정 비용(USD). 모델 단가 테이블 기반. */
  cost_usd: number
}

// #50 — Claude API 비용 추정용 단가(USD / 1M tokens). 근사값이며 정확한 청구는
// Anthropic 콘솔 기준. 모델명 prefix 매칭(버전 suffix 무시).
interface ModelPrice {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}
const PRICES: Array<{ match: string; price: ModelPrice }> = [
  // Opus 4.x
  { match: 'opus', price: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 } },
  // Haiku 4.5
  { match: 'haiku', price: { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 } },
  // Sonnet (혹시 모를 사용 대비)
  { match: 'sonnet', price: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } },
]
const FALLBACK_PRICE: ModelPrice = { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }

function priceFor(model: string): ModelPrice {
  const m = model.toLowerCase()
  return PRICES.find((p) => m.includes(p.match))?.price ?? FALLBACK_PRICE
}

export function estimateCostUsd(rec: Omit<CacheUsageRecord, 'cost_usd'>): number {
  const p = priceFor(rec.model)
  const cost =
    (rec.input_tokens * p.input +
      rec.output_tokens * p.output +
      rec.cache_creation_input_tokens * p.cacheWrite +
      rec.cache_read_input_tokens * p.cacheRead) /
    1_000_000
  // 소수 6자리(마이크로달러) 반올림
  return Math.round(cost * 1_000_000) / 1_000_000
}

type UsageMessage = Pick<Anthropic.Message, 'usage' | 'model'>

export function summarizeCacheUsage(message: UsageMessage, label: string): CacheUsageRecord {
  const u = message.usage
  const create = u.cache_creation_input_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  const uncached = u.input_tokens ?? 0
  const total = create + read + uncached
  const base = {
    label,
    model: message.model,
    cache_creation_input_tokens: create,
    cache_read_input_tokens: read,
    input_tokens: uncached,
    output_tokens: u.output_tokens ?? 0,
    cache_hit_ratio: total === 0 ? 0 : read / total,
    cache_total_input: total
  }
  return { ...base, cost_usd: estimateCostUsd(base) }
}

export function logCacheUsage(record: CacheUsageRecord): void {
  if (process.env.ANTHROPIC_LOG_USAGE !== '1') return
  console.log(JSON.stringify({ tag: 'claude_usage', ...record }))
}

export function recordCacheUsage(message: UsageMessage, label: string): CacheUsageRecord {
  const rec = summarizeCacheUsage(message, label)
  logCacheUsage(rec)
  // #50 — 비용/토큰 메트릭은 항상 기록(수집기가 task·model 별 집계). 알림은 수집기에서.
  trackMetric('claude.cost_usd', rec.cost_usd, { task: rec.label, model: rec.model })
  trackMetric('claude.output_tokens', rec.output_tokens, { task: rec.label, model: rec.model })
  return rec
}
