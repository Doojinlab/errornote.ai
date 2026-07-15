// 교수 페이지 공통 로딩 스켈레톤. 대시보드·수업 상세 등은 여러 Supabase 쿼리가
// 순차로 이어지는 서버 렌더라, 대기 중 빈 화면 대신 표/카드 골격을 즉시 보여준다.
export default function ProfessorLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse space-y-6 p-6" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="h-12 w-full rounded bg-slate-200" />
        <div className="h-12 w-full rounded bg-slate-200" />
        <div className="h-12 w-full rounded bg-slate-200" />
        <div className="h-12 w-full rounded bg-slate-200" />
      </div>
    </div>
  )
}
