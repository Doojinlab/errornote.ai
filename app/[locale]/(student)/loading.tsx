// 학생 페이지 공통 로딩 스켈레톤. force-dynamic 세그먼트라 모든 이동이 서버 렌더를
// 기다리는데, loading.tsx 가 Suspense 경계를 만들어 데이터 대기 중 즉시 골격을 보여준다.
// (빈 화면 → 스켈레톤: 체감 속도 개선의 핵심)
export default function StudentLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-7 w-40 rounded-lg bg-slate-200" />
      <div className="h-28 w-full rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-slate-200" />
        <div className="h-20 rounded-2xl bg-slate-200" />
      </div>
      <div className="space-y-3">
        <div className="h-16 w-full rounded-2xl bg-slate-200" />
        <div className="h-16 w-full rounded-2xl bg-slate-200" />
        <div className="h-16 w-full rounded-2xl bg-slate-200" />
      </div>
    </div>
  )
}
