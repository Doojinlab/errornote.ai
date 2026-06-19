'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface PlatformRecord {
  id: string
  name: string
  issuer: string
  client_id: string
  deployment_id: string | null
  auth_login_url: string
  auth_token_url: string
  jwks_uri: string
  class_id: string | null
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  issuer: '',
  clientId: '',
  deploymentId: '',
  authLoginUrl: '',
  authTokenUrl: '',
  jwksUri: '',
}

export default function LtiPlatformsPage() {
  const t = useTranslations('pages.professor.ltiPlatforms')
  const [platforms, setPlatforms] = useState<PlatformRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchPlatforms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lti/platforms')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPlatforms(data.platforms ?? [])
    } catch {
      setError(t('fetchError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchPlatforms()
  }, [fetchPlatforms])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/lti/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('createError'))
        return
      }
      setPlatforms((prev) => [data.platform, ...prev])
      setForm({ ...EMPTY_FORM })
      setShowForm(false)
    } catch {
      setError(t('createError'))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/lti/platforms/${id}`, { method: 'DELETE' })
    if (res.ok) setPlatforms((prev) => prev.filter((p) => p.id !== id))
  }

  const field = (key: keyof typeof EMPTY_FORM, label: string, required = true, placeholder = '') => (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )

  const toolUrls: Array<{ label: string; url: string }> = [
    { label: t('toolLoginUrl'), url: `${origin}/api/lti/login` },
    { label: t('toolLaunchUrl'), url: `${origin}/api/lti/launch` },
    { label: t('toolJwksUrl'), url: `${origin}/api/lti/jwks` },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {t('registerButton')}
        </button>
      </div>

      {/* LMS 에 errornote 를 도구로 등록할 때 입력하는 URL 안내 */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">{t('toolConfigTitle')}</p>
        <p className="mb-3 text-xs text-slate-500">{t('toolConfigHint')}</p>
        <dl className="space-y-1.5">
          {toolUrls.map((u) => (
            <div key={u.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <dt className="w-40 shrink-0 text-xs font-medium text-slate-500">{u.label}</dt>
              <dd className="min-w-0 flex-1">
                <code className="block break-all rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-700">
                  {u.url || '…'}
                </code>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            {t('errorClose')}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('formTitle')}</h2>
          {field('name', t('fieldName'), true, t('fieldNamePlaceholder'))}
          {field('issuer', t('fieldIssuer'), true, 'https://canvas.instructure.com')}
          {field('clientId', t('fieldClientId'), true, '')}
          {field('deploymentId', t('fieldDeploymentId'), false, t('optional'))}
          {field('authLoginUrl', t('fieldAuthLoginUrl'), true, 'https://.../api/lti/authorize_redirect')}
          {field('authTokenUrl', t('fieldAuthTokenUrl'), true, 'https://.../login/oauth2/token')}
          {field('jwksUri', t('fieldJwksUri'), true, 'https://.../api/lti/security/jwks')}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? t('formSubmitting') : t('formSubmit')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t('formCancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('loading')}</p>
      ) : platforms.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-400">{t('emptyState')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {platforms.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{p.issuer}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    <span>client_id: {p.client_id}</span>
                    {p.deployment_id && <span>deployment: {p.deployment_id}</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
