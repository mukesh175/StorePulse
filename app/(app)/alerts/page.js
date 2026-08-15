import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { listAlerts, getAlertFacets } from '@/lib/alerts/queries';
import AlertCard from '@/components/alerts/AlertCard';
import AlertFilters from '@/components/alerts/AlertFilters';
import UpgradePrompt from '@/components/billing/UpgradePrompt';
import { alertHistoryDays, hasFeature, FEATURES } from '@/lib/billing';
import { PageHeader, EmptyState } from '@/components/ui/Primitives';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const page = Number.parseInt(params?.page ?? '1', 10) || 1;

  const historyDays = alertHistoryDays(store);

  const [{ items, total, pages }, facets] = await Promise.all([
    listAlerts(store.id, {
      severity: params?.severity,
      category: params?.category,
      status: params?.status ?? 'ACTIVE',
      page,
      pageSize: 20,
      historyDays,
    }),
    getAlertFacets(store.id, { historyDays }),
  ]);

  // Only worth prompting when the merchant actually has critical alerts that
  // waited for the digest instead of being emailed.
  const missedInstant =
    !hasFeature(store, FEATURES.INSTANT_EMAIL) &&
    items.some((a) => a.severity === 'CRITICAL' && a.status === 'OPEN');

  const query = new URLSearchParams(
    Object.entries(params ?? {}).filter(([key]) => key !== 'page')
  ).toString();

  return (
    <div className="sp-fade-in">
      <PageHeader
        title="Alert center"
        subtitle={`${facets.active} active alert${facets.active === 1 ? '' : 's'} · ${facets.resolved} resolved`}
      />

      {missedInstant && <UpgradePrompt variant="list" />}

      <Suspense fallback={<div className="sp-skeleton" style={{ height: 76 }} />}>
        <AlertFilters facets={facets} />
      </Suspense>

      {items.length === 0 ? (
        <EmptyState
          title="Everything looks good!"
          text="There are no alerts matching these filters right now. We'll keep watching your store."
          action={
            <Link href="/alerts" className="sp-btn sp-btn-sm">
              Clear filters
            </Link>
          }
        />
      ) : (
        <>
          {items.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}

          {pages > 1 && (
            <div className="d-flex align-items-center justify-content-between mt-3">
              <span className="sp-card-sub">
                Page {page} of {pages} · {total} alerts
              </span>
              <div className="d-flex gap-2">
                {page > 1 && (
                  <Link className="sp-btn sp-btn-sm" href={`/alerts?${query}&page=${page - 1}`}>
                    Previous
                  </Link>
                )}
                {page < pages && (
                  <Link className="sp-btn sp-btn-sm" href={`/alerts?${query}&page=${page + 1}`}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
