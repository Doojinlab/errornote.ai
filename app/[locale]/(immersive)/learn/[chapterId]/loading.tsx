// 몰입형 작문·분석 화면 로딩 스켈레톤. 좌(문서 작성) / 우(오류 카드 + AI 과외) 분할을
// 미리 그려, 서버가 활성 수업/에디터 셸을 준비하는 동안 빈 화면 대신 골격을 보여준다.
export default function LearnLoading() {
  return (
    <div className="flex min-h-dvh animate-pulse gap-4 p-4" aria-hidden>
      {/* 좌: 문서 작성 */}
      <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="h-6 w-28 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
      {/* 우: 오류 카드 + AI 과외 채팅 */}
      <div className="hidden w-[340px] flex-col gap-4 md:flex">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-5 w-20 rounded bg-slate-200" />
          <div className="h-24 w-full rounded-xl bg-slate-200" />
          <div className="h-24 w-full rounded-xl bg-slate-200" />
        </div>
        <div className="flex-1 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="h-32 w-full rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  )
}
