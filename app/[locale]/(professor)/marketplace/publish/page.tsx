import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth';
import { getTranslations } from 'next-intl/server'
import { listMyCorpus } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import PublishRow from './PublishRow'

export const dynamic = 'force-dynamic'

export default async function MarketplacePublishPage() {
  const t = await getTranslations('pages.professor.marketplacePublish')
  const user = await getCurrentUser()
  if (!user) return null

  const items = await listMyCorpus(user.id)
  const publicCount = items.filter(i => i.is_public).length

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-muted">
        <Link href="/marketplace" className="hover:underline">
          {t('breadcrumbMarketplace')}
        </Link>{' '}
        › {t('breadcrumbPublish')}
      </p>

      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-muted">{t('subtitle')}</p>
        </div>
        <p className="text-xs text-muted">
          {t('publicCount', { publicCount, total: items.length })}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-hairline bg-white p-8 text-center text-sm text-muted">
          {t('emptyState')}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id}>
              <Card className="p-4">
                <PublishRow item={item} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
