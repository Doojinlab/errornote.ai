import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { getClassGoals, type ClassGoal } from '@/lib/class-goals'
import { listErrorSpecies } from '@/lib/error-dex'
import ClassGoalsManager from './ClassGoalsManager'

interface SpeciesOption {
  id: string
  code: string
  name: string
}

export default async function ClassGoalsPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const t = await getTranslations('pages.professor.classGoals')

  let goals: ClassGoal[] = []
  let species: SpeciesOption[] = []
  try {
    const [g, sp] = await Promise.all([getClassGoals(classId), listErrorSpecies()])
    goals = g
    species = sp.map((s) => ({ id: s.id, code: s.code, name: `${s.name_ko} (${s.name_zh})` }))
  } catch {
    /* 조회 실패 시 빈 상태 */
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-1">
        <Link href={`/classes/${classId}`} className="text-xs text-indigo-500 hover:underline">
          ← {t('backToClass')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{t('subtitle')}</p>
      <ClassGoalsManager classId={classId} initialGoals={goals} species={species} />
    </div>
  )
}
