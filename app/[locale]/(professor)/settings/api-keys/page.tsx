'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { LMSApiKeyRecord } from '@/types/lms'

interface NewKeyResult {
  key: string
  record: LMSApiKeyRecord
}

export default function ApiKeysPage() {
  const t = useTranslations('pages.professor.apiKeys')

  const [keys, setKeys] = useState<LMSApiKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formScopes, setFormScopes] = useState<string[]>(['classes', 'students', 'assignments', 'grades'])
  const [creating, setCreating] = useState(false)

  const [generatedKey, setGeneratedKey] = useState<NewKeyResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/lms/keys')
    if (!res.ok) {
      setError(t('fetchError'))
      setLoading(false)
      return
    }
    const data = await res.json()
    setKeys(data.keys ?? [])
    setLoading(false)
  }, [t])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 데이터 로드(비동기 fetch)
  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setCreating(true)
    const res = await fetch('/api/lms/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName.trim(), scopes: formScopes }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? t('createError'))
      return
    }
    setGeneratedKey(data as NewKeyResult)
    setShowForm(false)
    setFormName('')
    setKeys(prev => [data.record, ...prev])
  }

  async function handleRevoke(id: string) {
    if (!confirm(t('revokeConfirm'))) return
    const res = await fetch(`/api/lms/keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys(prev => prev.map(k => (k.id === id ? { ...k, is_active: false } : k)))
    }
  }

  function toggleScope(scope: string) {
    setFormScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope],
    )
  }

  async function copyKey() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SCOPES = ['classes', 'students', 'assignments', 'grades']

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setGeneratedKey(null) }}
          className="rounded-xl2 bg-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-dark"
        >
          {t('createButton')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl2 border border-terra bg-terra-soft px-4 py-3 text-sm text-terra-dark">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            {t('errorClose')}
          </button>
        </div>
      )}

      {generatedKey && (
        <div className="mb-6 rounded-xl2 border border-jade bg-jade-soft p-4">
          <p className="mb-2 text-sm font-semibold text-jade-dark">
            {t('generatedTitle')}
          </p>
          <div className="flex items-center gap-2">
            <code className="block flex-1 break-all rounded border border-jade bg-white px-3 py-2 font-mono text-xs text-ink">
              {generatedKey.key}
            </code>
            <button
              onClick={copyKey}
              className="whitespace-nowrap rounded bg-jade px-3 py-2 text-xs text-white transition-colors hover:bg-jade-dark"
            >
              {copied ? t('copiedButton') : t('copyButton')}
            </button>
          </div>
          <button
            className="mt-2 text-xs text-jade-dark underline"
            onClick={() => setGeneratedKey(null)}
          >
            {t('generatedClose')}
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl2 border border-hairline bg-ivory p-5"
        >
          <h2 className="mb-3 text-sm font-semibold text-bodytx">{t('formTitle')}</h2>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-bodytx">
              {t('formNameLabel')}
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t('formNamePlaceholder')}
              className="w-full rounded-xl2 border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-bodytx">
              {t('formScopesLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map(scope => (
                <label key={scope} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={formScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="rounded"
                  />
                  <span className="font-mono text-bodytx">{scope}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl2 bg-blue px-4 py-2 text-sm text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              {creating ? t('formSubmitting') : t('formSubmit')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl2 border border-hairline bg-white px-4 py-2 text-sm text-bodytx transition-colors hover:bg-ivory"
            >
              {t('formCancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">{t('loadingKeys')}</p>
      ) : keys.length === 0 ? (
        <div className="rounded-xl2 border-2 border-dashed border-hairline py-12 text-center">
          <p className="text-sm text-muted">{t('emptyState')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-blue hover:underline"
          >
            {t('createFirstKey')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-ivory text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left">{t('thName')}</th>
                <th className="px-4 py-3 text-left">{t('thPrefix')}</th>
                <th className="px-4 py-3 text-left">{t('thScopes')}</th>
                <th className="px-4 py-3 text-left">{t('thLastUsed')}</th>
                <th className="px-4 py-3 text-left">{t('thStatus')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {keys.map(k => (
                <tr key={k.id} className={k.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-ink">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{k.key_prefix}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map(s => (
                        <span
                          key={s}
                          className="rounded bg-blue-soft px-1.5 py-0.5 font-mono text-xs text-blue-dark"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.is_active
                          ? 'bg-jade-soft text-jade-dark'
                          : 'bg-hairline text-muted'
                      }`}
                    >
                      {k.is_active ? t('statusActive') : t('statusInactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-terra hover:text-terra-dark hover:underline"
                      >
                        {t('revokeButton')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        {t('footerLmsGuide')}{' '}
        <code className="rounded bg-hairline px-1 font-mono">
          Authorization: Bearer {'<api-key>'}
        </code>{' '}
        {t('footerInclude')}{' '}
        <code className="rounded bg-hairline px-1 font-mono">/api/lms/*</code>{' '}
        {t('footerInRequests')}{' '}
        {t('footerDocsLabel')}{' '}
        <a
          href="/api/docs"
          className="text-blue hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          /api/docs
        </a>
      </p>
    </div>
  )
}
