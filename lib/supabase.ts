import {
  createServerClient as createSSRServerClient,
  type CookieOptions,
} from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// 서버 전용 모듈 — next/headers 를 정적 import 한다(Next 가 cookies() 사용을 감지해
// 라우트를 동적 렌더링으로 자동 전환). 브라우저용 createBrowserClient 는
// lib/supabase-browser.ts 로 분리했다(클라이언트 컴포넌트가 이 모듈을 import 하면 안 됨).

type CookieToSet = { name: string; value: string; options: CookieOptions }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server Component / Route Handler / Server Action — anon key, RLS applied,
// session read from the incoming request cookies.
export function createServerClient() {
  // Next 15+ 에서 cookies() 는 비동기(Promise)다. createServerClient 를 동기로
  // 유지하기 위해 @supabase/ssr 의 async 쿠키 메서드 안에서 await 한다 — 호출처 변경 불필요.
  return createSSRServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      async getAll() {
        return (await cookies()).getAll()
      },
      async setAll(cookiesToSet: CookieToSet[]) {
        try {
          const cookieStore = await cookies()
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // called from a Server Component — Next.js forbids mutating cookies there.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}

// Server-only — bypasses RLS. Never import from Client Components.
// Use for cron jobs, webhook handlers, trusted admin flows.
export function createAdminClient() {
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
