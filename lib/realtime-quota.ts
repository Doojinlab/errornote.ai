// Supabase Realtime 쿼터 평가 (#50 운영 모니터링).
// app/api/live/realtime-quota/route.ts 가 데이터를 모아 이 순수 함수로 임계 판정한다.
// 라우트에 있던 인라인 임계 로직을 분리해 단위 테스트 가능하게 했다.

/** 동시연결 추정 사용률 경보 임계(%). */
export const UTILIZATION_WARN_PCT = 80
/** 동시 라이브 클래스 수 경보 임계. */
export const CONCURRENT_CLASSES_WARN = 5

export interface RealtimeQuotaInput {
  /** 활성 live_sessions 수 */
  activeSessions: number
  /** 활성 세션 소속 클래스의 등록 학생 수 합(잠재 동시연결 상한) */
  potential: number
  /** 플랜 동시연결 한도 추정치 */
  planLimit: number
}

export interface RealtimeQuotaEval {
  /** 사용률(%) — 소수 1자리 */
  utilizationPct: number
  warnings: string[]
  /** 경보(warning) 발송 대상 여부 */
  shouldAlert: boolean
}

/** 쿼터 사용률과 경보를 계산한다(순수). */
export function evaluateRealtimeQuota(input: RealtimeQuotaInput): RealtimeQuotaEval {
  const { activeSessions, potential, planLimit } = input
  const utilizationPct =
    planLimit > 0 ? Math.round((potential / planLimit) * 1000) / 10 : 0

  const warnings: string[] = []
  if (utilizationPct >= UTILIZATION_WARN_PCT) {
    warnings.push('utilization>=80% — 동시 broadcast 부하 주의')
  }
  if (activeSessions >= CONCURRENT_CLASSES_WARN) {
    warnings.push('5개 이상 클래스가 동시에 라이브 중 — 채널 분산 검토')
  }
  if (planLimit > 0 && potential >= planLimit) {
    warnings.push('잠재 동시연결이 플랜 한도 추정치를 초과 — Supabase 플랜 업그레이드 필요')
  }

  return { utilizationPct, warnings, shouldAlert: warnings.length > 0 }
}
