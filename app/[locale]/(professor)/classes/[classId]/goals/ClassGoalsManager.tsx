'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ClassGoal } from '@/lib/class-goals'

interface SpeciesOption {
  id: string
  code: string
  name: string
}

interface Props {
  classId: string
  initialGoals: ClassGoal[]
  species: SpeciesOption[]
}

function todayYmd(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function ClassGoalsManager({ classId, initialGoals, species }: Props) {
  const t = useTranslations('pages.professor.classGoals')
  const [goals, setGoals] = useState<ClassGoal[]>(initialGoals)
  const [showForm, setShowForm] = useState(false)
  const [speciesCode, setSpeciesCode] = useState(species[0]?.code ?? '')
  const [title, setTitle] = useState('')
  const [targetCount, setTargetCount] = useState(30)
  const [periodStart, setPeriodStart] = useState(todayYmd())
  const [periodEnd, setPeriodEnd] = useState(todayYmd(14))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const speciesById = useMemo(() => new Map(species.map((s) => [s.id, s.name])), [species])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !speciesCode) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/class-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, speciesCode, title, targetCount, periodStart, periodEnd }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('createFailed'))
        return
      }
      setGoals((prev) => [...prev, data.goal as ClassGoal])
      setShowForm(false)
      setTitle('')
    } catch {
      setError(t('createFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/class-goals/${id}`, { method: 'DELETE' })
    if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {t('newGoal')}
      </button>

      {showForm && (
        <form onSubmit={create} className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('species')}</label>
            <select
              value={speciesCode}
              onChange={(e) => setSpeciesCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {species.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('titleLabel')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('target')}</label>
              <input
                type="number"
                min={1}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('periodStart')}</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t('periodEnd')}</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? t('creating') : t('create')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentCount / g.targetCount) * 100))
            return (
              <li key={g.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {g.title || speciesById.get(g.speciesId) || t('untitled')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {speciesById.get(g.speciesId)} · {g.periodStart} ~ {g.periodEnd}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(g.id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    {t('delete')}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className={g.achieved ? 'font-semibold text-emerald-600' : 'text-slate-500'}>
                      {g.achieved ? `🎉 ${t('achieved')}` : t('inProgress')}
                    </span>
                    <span className="tabular-nums text-slate-600">
                      {g.currentCount} / {g.targetCount}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${g.achieved ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
