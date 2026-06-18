// 데일리 퀘스트 — gamification-spec §1.2(닫힘 루프), §3.
// 어제 오류 프로필 → AI 가 2분 미션 3개 생성 → 학습자가 완료.

export interface DailyQuestMission {
  /** 안정 식별자(m1~m3). done 토글·보상 지급 시 참조. */
  id: string
  title: string
  instruction: string
  /** 근거가 된 error_species code(있으면). 현재는 자유 텍스트 subtype 기반이라 보통 null. */
  source_code: string | null
  /** "어제 너의 ○○ 오류에서 나왔어" 표기용 라벨(error_subtype). */
  source_label: string | null
  done: boolean
}

export interface DailyQuestSourceItem {
  code: string | null
  label: string
  count: number
}

/** 미션 생성 근거가 된 어제 오류 스냅샷. */
export interface DailyQuestSource {
  top: DailyQuestSourceItem[]
  total_errors: number
}

export interface DailyQuest {
  id: string
  student_id: string
  quest_date: string
  source: DailyQuestSource
  missions: DailyQuestMission[]
  created_at: string
}
