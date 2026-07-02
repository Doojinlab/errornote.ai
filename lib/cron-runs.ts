// Phase 4 후속 — cron 실행 로그 (cron_runs) 헬퍼.
// [창] feat/phase4-cron-observability
//
// service-role 으로만 호출. 학생/교수자 코드 경로에서 직접 import 하지 말 것.
//
// 토큰·비용 관측성은 lib/ai/observability.recordCacheUsage 가 dispatch 마다
// task·model 별 메트릭으로 기록한다(여기서 중복 집계하지 않음).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

export async function startCronRun(
  admin: Admin,
  name: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('cron_runs')
    .insert({ name, status: 'running' })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[cron] startCronRun 실패:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function finishCronRun(
  admin: Admin,
  runId: string | null,
  params: {
    status: 'success' | 'partial' | 'failed'
    summary: Record<string, unknown>
    errors: Array<{ scope: string; message: string }>
  }
): Promise<void> {
  if (!runId) return
  const { error } = await admin
    .from('cron_runs')
    .update({
      status: params.status,
      finished_at: new Date().toISOString(),
      summary: params.summary as unknown as Json,
      errors: params.errors as unknown as Json
    })
    .eq('id', runId)
  if (error) console.error('[cron] finishCronRun 실패:', error.message)
}
