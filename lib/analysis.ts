import type { AnalysisResponse, AnalyzeRequest } from '@/types'
import { completeJSON, FAST_MODEL_ID } from './claude'
import { buildSystemBlocks, buildAnalyzeUserPrompt } from './prompts/base'
import { parseAnalysisResponse } from './parser'

export async function analyzeDraft(req: AnalyzeRequest): Promise<AnalysisResponse> {
  const system = buildSystemBlocks({
    corpus: req.corpus,
    iclExamples: req.iclExamples,
    chapterNumber: req.chapterNumber,
    chapterFocus: req.chapterFocus
  })

  return completeJSON<AnalysisResponse>(
    {
      system,
      messages: [{ role: 'user', content: buildAnalyzeUserPrompt(req.draftText) }],
      // 지연 최소화: 저지연 모델(Haiku 4.5) + 확장 사고 off.
      // max_tokens 는 상한일 뿐 실제 생성 토큰만큼만 지연되고, annotated_text 가
      // 초안 전체(최대 8000자)를 되돌려 출력이 길 수 있으므로 16000 을 유지해
      // 긴 글에서 JSON 이 잘려 파싱 재시도로 오히려 느려지는 일을 막는다.
      model: FAST_MODEL_ID,
      thinking: false,
      maxTokens: 16000,
      cacheSystem: true
    },
    parseAnalysisResponse
  )
}
