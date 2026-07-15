import { Link } from '@/i18n/routing'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'

// 교수 수업 목록 — 내비의 "수업 관리"(/classes) 진입점.
// (이전엔 인덱스 페이지가 없어 /classes 가 404 였다.)

interface ClassRow {
  id: string
  name: string
  semester: string
  is_active: boolean
  invite_code: string
  current_grammar_focus: string | null
  enrollments: { count: number }[]
}

async function loadClasses(userId: string): Promise<ClassRow[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select(
      'id, name, semester, invite_code, is_active, current_grammar_focus, enrollments(count)',
    )
    .eq('professor_id', userId)
    .order('semester', { ascending: false })
  return (data as ClassRow[] | null) ?? []
}

export default async function ClassesPage() {
  const user = await getCurrentUser()
  if (!user) return null
  const classes = await loadClasses(user.id)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-ink">수업 관리</h1>
        <Link href="/dashboard" className="text-xs text-blue hover:underline">
          대시보드
        </Link>
      </header>

      {classes.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-hairline bg-white p-8 text-center text-sm text-muted">
          아직 개설한 수업이 없어요. 대시보드에서 수업을 만들어보세요.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`} className="block">
              <Card className="card-pop h-full p-4 transition-colors hover:border-blue">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-bold text-ink">{c.name}</h2>
                  {!c.is_active && (
                    <span className="rounded-full bg-ivory px-2 py-0.5 text-[11px] text-muted">
                      종료
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">{c.semester}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-bodytx">
                  <span>수강생 {c.enrollments[0]?.count ?? 0}명</span>
                  <span className="font-mono text-muted">코드 {c.invite_code}</span>
                </div>
                {c.current_grammar_focus && (
                  <p className="mt-2 text-[11px] text-blue-dark">
                    이번 주: {c.current_grammar_focus}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
