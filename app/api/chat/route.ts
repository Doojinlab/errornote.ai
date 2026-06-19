import Anthropic from '@anthropic-ai/sdk'
import { buildTutorSystemPrompt } from '@/lib/prompts/tutor'
import { getTutorContext } from '@/lib/tutor-context'
import { captureException } from '@/lib/monitoring'
import { requireAuth, AuthError, type AuthContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { streamTutorConversation } from '@/lib/tutor-stream'
import { TUTOR_TOOLS, runTutorTool, type TutorToolContext } from '@/lib/tutor-tools'
import type { ChatRequest, ChatMessage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGE_LENGTH = 4000
const MAX_MESSAGES = 40

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const out: ChatMessage[] = []
  for (const m of raw) {
    const obj = (m ?? {}) as Record<string, unknown>
    const role = obj.role
    const content = obj.content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
    const trimmed = content.trim()
    if (!trimmed) continue
    out.push({ role, content: trimmed.slice(0, MAX_MESSAGE_LENGTH) })
  }
  return out.slice(-MAX_MESSAGES)
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export async function POST(req: Request) {
  let auth: AuthContext
  try {
    auth = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.message, err.status)
    }
    return errorResponse('인증 확인 중 오류가 발생했습니다', 500)
  }

  let body: Partial<ChatRequest>
  try {
    body = (await req.json()) as Partial<ChatRequest>
  } catch {
    return errorResponse('잘못된 JSON 요청입니다', 400)
  }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) {
    return errorResponse('messages 가 비어있거나 유효하지 않습니다', 400)
  }
  if (messages[0].role !== 'user') {
    return errorResponse('첫 메시지는 user 여야 합니다', 400)
  }

  // 학습자 오류 프로필 + 적응형 난이도 자동 주입(#48 멀티턴 컨텍스트 + 적응형 난이도).
  // 집계 실패가 대화를 막지 않도록 방어: 실패 시 모니터링에 보고하고 컨텍스트 없이 진행.
  let learnerProfileSection: string | null = null
  let adaptiveDifficultySection: string | null = null
  try {
    const ctx = await getTutorContext(auth.userId)
    learnerProfileSection = ctx.learnerProfileSection
    adaptiveDifficultySection = ctx.adaptiveDifficultySection
  } catch (err) {
    captureException(err, { route: '/api/chat', step: 'tutor-context' })
  }

  const system = buildTutorSystemPrompt({
    errorContext: body.errorContext,
    chapterNumber: body.chapterNumber,
    learnerProfileSection,
    adaptiveDifficultySection
  })

  try {
    // tool_use 스트리밍 루프: 텍스트 델타 + 도구 산출물(퀴즈/단어장)을 NDJSON 이벤트로 흘린다.
    // 도구 실행은 RLS self 클라이언트 컨텍스트(본인 단어장 insert 등)로 수행한다.
    const toolCtx: TutorToolContext = {
      supabase: createServerClient() as unknown as TutorToolContext['supabase'],
      studentId: auth.userId
    }
    const stream = streamTutorConversation({
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: TUTOR_TOOLS,
      runTool: (name, input) => runTutorTool(name, input, toolCtx),
      maxTokens: 2048,
      cacheSystem: true
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
      }
    })
  } catch (err) {
    console.error('[api/chat] error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return errorResponse('Claude API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429)
    }
    if (err instanceof Anthropic.APIError) {
      return errorResponse(`Claude API 오류: ${err.message}`, err.status ?? 500)
    }
    const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
    return errorResponse(msg, 500)
  }
}
