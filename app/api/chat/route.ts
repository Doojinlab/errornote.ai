import Anthropic from '@anthropic-ai/sdk'
import { streamText } from '@/lib/claude'
import { buildTutorSystemPrompt } from '@/lib/prompts/tutor'
import { getLearnerProfileSection } from '@/lib/tutor-context'
import { captureException } from '@/lib/monitoring'
import { requireAuth, AuthError, type AuthContext } from '@/lib/auth'
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

  // 학습자 오류 프로필 자동 주입(#48 멀티턴 컨텍스트 강화).
  // 집계 실패가 대화를 막지 않도록 방어: 실패 시 모니터링에 보고하고 프로필 없이 진행.
  let learnerProfileSection: string | null = null
  try {
    learnerProfileSection = await getLearnerProfileSection(auth.userId)
  } catch (err) {
    captureException(err, { route: '/api/chat', step: 'learner-profile' })
  }

  const system = buildTutorSystemPrompt({
    errorContext: body.errorContext,
    chapterNumber: body.chapterNumber,
    learnerProfileSection
  })

  try {
    const stream = streamText({
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      maxTokens: 2048,
      cacheSystem: true
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
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
