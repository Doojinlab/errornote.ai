'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { ExportFormat, AnonymizationLevel } from '@/types/export'

interface ClassOption {
  id: string
  name: string
  semester: string
}

export default function ProfessorExportPage() {
  const t = useTranslations('pages.professor.reportsExport')
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [classId, setClassId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [anonymizationLevel, setAnonymizationLevel] =
    useState<AnonymizationLevel>('partial')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from('classes')
      .select('id, name, semester')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as ClassOption[]
        setClasses(rows)
        if (rows.length > 0) setClassId(rows[0].id)
      })
  }, [])

  async function handleExport(e: FormEvent) {
    e.preventDefault()
    if (!classId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/export/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          format,
          anonymizationLevel,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? t('exportFailed'))
        return
      }

      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+?)"/)
      const filename = match ? match[1] : `export.${format}`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-ink mb-2">{t('title')}</h1>
      <p className="text-sm text-muted mb-8">{t('subtitle')}</p>

      <form onSubmit={handleExport} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-bodytx mb-1">
            {t('classLabel')}
          </label>
          {classes.length === 0 ? (
            <p className="text-sm text-muted">{t('loadingClasses')}</p>
          ) : (
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              required
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.semester}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodytx mb-1">
              {t('startDateLabel')} <span className="text-muted">{t('optional')}</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodytx mb-1">
              {t('endDateLabel')} <span className="text-muted">{t('optional')}</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-bodytx mb-2">
            {t('formatLabel')}
          </label>
          <div className="flex gap-4">
            {(['csv', 'json'] as ExportFormat[]).map(f => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-blue"
                />
                <span className="text-sm font-mono uppercase text-bodytx">{f}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {format === 'csv' ? t('formatCsvHint') : t('formatJsonHint')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-bodytx mb-1">
            {t('anonLabel')}
          </label>
          <select
            value={anonymizationLevel}
            onChange={e => setAnonymizationLevel(e.target.value as AnonymizationLevel)}
            className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
          >
            <option value="none">{t('anonNone')}</option>
            <option value="partial">{t('anonPartial')}</option>
            <option value="full">{t('anonFull')}</option>
          </select>
          <p className="mt-1 text-xs text-muted">{t('anonHint')}</p>
        </div>

        {error && (
          <p className="text-sm text-terra-dark bg-terra-soft rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !classId}
          className="w-full rounded-xl2 bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('generating') : t('downloadFormat', { format: format.toUpperCase() })}
        </button>
      </form>
    </div>
  )
}
