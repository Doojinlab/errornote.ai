import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// 브라우저(클라이언트 컴포넌트) 전용 Supabase 클라이언트.
// next/headers 에 의존하는 lib/supabase.ts(서버 전용)와 분리한다 — 클라이언트
// 컴포넌트가 서버 모듈을 전이적으로 import 하면 Next 16 빌드가 실패하기 때문.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client Component / browser — uses NEXT_PUBLIC keys, subject to RLS.
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
