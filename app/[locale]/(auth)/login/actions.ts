'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { ROLE_COOKIE } from '@/lib/role-cookie'

export async function logout() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  // 라우팅 역할 캐시 제거 — 공용 기기에서 다음 사용자에게 잔존하지 않도록.
  ;(await cookies()).delete(ROLE_COOKIE)
  redirect('/login')
}
