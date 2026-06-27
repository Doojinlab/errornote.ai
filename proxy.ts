import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import type { Database } from '@/types/database'
import { routing } from '@/i18n/routing'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const intlMiddleware = createIntlMiddleware(routing)

// 로컬 경로 기준(prefix 제거 후) 의 역할별 가드 경로
const STUDENT_PREFIXES = [
  '/learn',
  '/errors',
  '/vocabulary',
  '/bookmarks',
  '/quiz',
  '/translate',
  '/analyze-url',
  '/progress',
  '/goals',
  '/badges',
  '/portfolio',
  '/cardnews',
  '/assignments',
  '/peer-review',
  '/pronunciation',
  '/notifications',
  '/data-export',
]

const PROFESSOR_PREFIXES = ['/dashboard', '/classes', '/marketplace']

const AUTH_PAGES = ['/login', '/signup']

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function stripLocale(pathname: string): { locale: string; rest: string } {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return {
      locale: first,
      rest: segments.length > 1 ? '/' + segments.slice(1).join('/') : '/',
    }
  }
  return { locale: routing.defaultLocale, rest: pathname }
}

function localize(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path
  return `/${locale}${path === '/' ? '' : path}`
}

// Next.js 16: `middleware.ts`/`middleware` 는 deprecated → `proxy.ts`/`proxy` 로 이전.
// 동작은 동일(요청마다 실행되는 엣지 함수). config.matcher 도 그대로 적용된다.
// https://nextjs.org/docs/messages/middleware-to-proxy
export async function proxy(request: NextRequest) {
  // LMS API — API key 인증 전용. 세션/로케일 proxy 모두 건너뜀.
  if (request.nextUrl.pathname.startsWith('/api/lms/')) {
    return NextResponse.next()
  }

  // 1. next-intl 미들웨어 먼저 실행 — 로케일 탐지·정규화·쿠키 세팅
  const intlResponse = intlMiddleware(request)

  // intl 이 로케일 재작성을 위해 redirect 를 반환하면 그대로 따름
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse
  }

  // 2. 인증·역할 가드 — 로케일 prefix 를 제거한 경로로 매칭
  let response = intlResponse

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          // next-intl 응답의 헤더·쿠키를 유지
          intlResponse.headers.forEach((v, k) => {
            if (k.toLowerCase().startsWith('x-')) response.headers.set(k, v)
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { locale, rest } = stripLocale(request.nextUrl.pathname)
  const isStudentRoute = hasPrefix(rest, STUDENT_PREFIXES)
  const isProfessorRoute = hasPrefix(rest, PROFESSOR_PREFIXES)
  const isAuthPage = AUTH_PAGES.includes(rest)

  if (!user && (isStudentRoute || isProfessorRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = localize(locale, '/login')
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .returns<Array<{ role: 'professor' | 'student' }>>()
      .single()
    const url = request.nextUrl.clone()
    url.pathname = localize(locale, profile?.role === 'professor' ? '/dashboard' : '/learn')
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user && (isStudentRoute || isProfessorRoute)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .returns<Array<{ role: 'professor' | 'student' }>>()
      .single()
    const role = profile?.role

    if (isStudentRoute && role !== 'student') {
      const url = request.nextUrl.clone()
      url.pathname = localize(locale, '/dashboard')
      return NextResponse.redirect(url)
    }
    if (isProfessorRoute && role !== 'professor') {
      const url = request.nextUrl.clone()
      url.pathname = localize(locale, '/learn')
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Next 내부·API·확장자 있는 정적 파일(.png/.mp4/.ttf/.json/.html 등) 전부 제외.
    // 나머지(확장자 없는 페이지 경로)에만 로케일/인증 미들웨어 적용.
    // 이전 패턴은 manifest.json·sw.js·루트 icon-*.png·sounds/ 만 제외해
    // /video/·/icons/·/fonts/·/offline.html 등 하위 정적 자산이 미들웨어에
    // 가로채여 404 났다(예: 히어로 영상 미표시). 점(.) 포함 경로를 일괄 제외해 해결.
    '/((?!_next/static|_next/image|api/|.*\\..*).*)',
  ],
}
