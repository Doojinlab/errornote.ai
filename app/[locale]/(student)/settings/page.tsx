import { getTranslations } from 'next-intl/server'
import SoundSettings from '@/components/gamification/SoundSettings'
import { Card } from '@/components/student-ui'
import JoinClassForm from '@/components/student/JoinClassForm'

export default async function StudentSettingsPage() {
  const t = await getTranslations('pages.student.settings')

  return (
    <main className="mx-auto w-full max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t('title')}</h1>
        <p className="mt-0.5 text-xs text-muted">{t('subtitle')}</p>
      </div>
      <SoundSettings />

      {/* 수업 참여(선택) — 자기주도 학습이 기본이며, 교수자 수업은 옵션이다. */}
      <Card className="p-4 text-left">
        <h2 className="text-base font-extrabold text-ink">수업 참여</h2>
        <p className="mt-1 text-sm leading-relaxed text-bodytx">
          교수자에게 받은 초대코드가 있다면 입력해 반에 참여하세요. 없어도 혼자
          자유롭게 학습할 수 있어요.
        </p>
        <div className="mt-3">
          <JoinClassForm />
        </div>
      </Card>
    </main>
  )
}
