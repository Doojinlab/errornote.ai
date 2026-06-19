// #49 — 법적 문서(개인정보처리방침/이용약관) 렌더링. 서버 컴포넌트.
import type { LegalDoc } from '@/lib/legal-content'

const UPDATED_LABEL: Record<string, string> = {
  ko: '최종 수정일',
  en: 'Last updated',
  ja: '最終更新日',
}

function renderBody(body: string[]) {
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flushList = (key: string) => {
    if (list.length === 0) return
    blocks.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {list.map((item, i) => (
          <li key={i}>{item.replace(/^-\s+/, '')}</li>
        ))}
      </ul>
    )
    list = []
  }
  body.forEach((line, idx) => {
    if (line.startsWith('- ')) {
      list.push(line)
    } else {
      flushList(`${idx}`)
      blocks.push(
        <p key={`p-${idx}`} className="my-2 text-sm leading-relaxed text-slate-600">
          {line}
        </p>
      )
    }
  })
  flushList('end')
  return blocks
}

export default function LegalDocView({ doc, locale }: { doc: LegalDoc; locale: string }) {
  let updated = doc.updated
  try {
    updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(doc.updated))
  } catch {
    // locale 포맷 실패 시 ISO 그대로
  }
  const updatedLabel = UPDATED_LABEL[locale] ?? UPDATED_LABEL.ko

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-slate-900">{doc.title}</h1>
      <p className="mt-1 text-xs text-slate-400">
        {updatedLabel}: {updated}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">{doc.intro}</p>
      <div className="mt-6 space-y-6">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-sm font-semibold text-slate-900">{s.heading}</h2>
            {renderBody(s.body)}
          </section>
        ))}
      </div>
    </article>
  )
}
