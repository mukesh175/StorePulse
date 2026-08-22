import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { buildDailyBrief } from '@/lib/brief';
import { getResolvedValue } from '@/lib/impact';
import HealthScore from '@/components/dashboard/HealthScore';
import AlertCard from '@/components/alerts/AlertCard';
import { RevenueChart, OrdersChart } from '@/components/charts/Charts';
import { MetricCard, EmptyState, Section, ErrorNotice } from '@/components/ui/Primitives';
import { formatMoney, formatNumber, timeAgo } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

function greeting(timezone) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const [brief, resolved] = await Promise.all([buildDailyBrief(store), getResolvedValue(store, { days: 30 })]);
  const { metrics, counts, health, series } = brief;
  const currency = store.currency;

  return (
    <div className="sp-fade-in">
      <div className="mb-4">
        <h1 style={{ fontSize: 26 }}>
          {greeting(store.timezone)}, {store.shopName || 'Store owner'} 👋
        </h1>
        <p className="sp-card-sub mt-1 mb-0">
          {counts.critical + counts.warning === 0
            ? "Nothing needs your attention right now — here's how yesterday went."
            : 'Here is what needs your attention today.'}
        </p>
      </div>

      {store.lastSyncError && (
        <div className="mb-3">
          <ErrorNotice
            detail="We'll automatically retry on the next scheduled sync."
            lastSyncAt={store.lastSyncAt ? timeAgo(store.lastSyncAt) : null}
          />
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <HealthScore
            score={health.score}
            label={health.label}
            counts={health.counts}
            delayedOrders={health.delayedOrders}
          />
        </div>

        <div className="col-12 col-lg-8">
          <div className="row g-3">
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Revenue"
                value={formatMoney(metrics.yesterday.revenue, currency)}
                delta={metrics.changes.revenue}
                footnote="yesterday"
              />
            </div>
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Orders"
                value={formatNumber(metrics.yesterday.orders)}
                delta={metrics.changes.orders}
                footnote="yesterday"
                href="/orders"
              />
            </div>
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Avg order value"
                value={formatMoney(metrics.yesterday.averageOrderValue, currency)}
                delta={metrics.changes.averageOrderValue}
                footnote="yesterday"
              />
            </div>
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Refunds"
                value={formatMoney(metrics.yesterday.refundAmount, currency)}
                delta={metrics.changes.refundAmount}
                invert
                footnote="yesterday"
              />
            </div>
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Inventory issues"
                value={formatNumber(counts.inventoryIssues)}
                footnote="open alerts"
                href="/inventory"
              />
            </div>
            <div className="col-6 col-xl-4">
              <MetricCard
                label="Delayed orders"
                value={formatNumber(counts.delayedOrders)}
                footnote="awaiting fulfillment"
                href="/orders?filter=delayed"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12 col-xl-7">
          <div className="sp-card sp-card-pad h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div className="sp-card-title">Revenue</div>
                <div className="sp-card-sub">Last 7 days</div>
              </div>
              <Link href="/reports" className="sp-btn sp-btn-sm">
                Reports
              </Link>
            </div>
            <RevenueChart data={series} currency={currency} />
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="sp-card sp-card-pad h-100">
            <div className="sp-card-title">Orders</div>
            <div className="sp-card-sub mb-2">Last 7 days</div>
            <OrdersChart data={series} />
          </div>
        </div>
      </div>

      {resolved.count > 0 && (
        <div className="sp-banner success mt-3">
          <span aria-hidden="true">🛡</span>
          <div>
            <strong>
              You resolved {resolved.count} issue{resolved.count === 1 ? '' : 's'} covering{' '}
              {formatMoney(resolved.value, currency)} of revenue at risk in the last {resolved.days} days.
            </strong>
            <div className="mt-1">
              <Link href="/reports">See how this is estimated</Link> — it comes from your own order history at the
              moment each issue was detected.
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Section
          title={`Today's brief`}
          sub={`${counts.critical} critical · ${counts.warning} warnings · ${counts.positive} positive signals`}
          actions={
            <Link href="/alerts" className="sp-btn sp-btn-sm">
              Alert center
            </Link>
          }
        >
          {brief.critical.length === 0 && brief.warnings.length === 0 ? (
            <EmptyState
              title="Everything looks good!"
              text="There are no critical store alerts right now. We'll keep watching your store and tell you the moment something changes."
            />
          ) : (
            <>
              {brief.critical.slice(0, 4).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {brief.warnings.slice(0, 3).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </>
          )}
        </Section>

        {(brief.positives.length > 0 || brief.topProduct) && (
          <Section title="Good news" sub="Positive signals from the last 24 hours">
            {brief.topProduct && (
              <div className="sp-banner success mb-2">
                <span aria-hidden="true">🟢</span>
                <div>
                  <strong>Best seller today: {brief.topProduct.title}</strong>
                  <div className="mt-1">{brief.topProduct.units} units sold in the last 24 hours.</div>
                </div>
              </div>
            )}
            {brief.positives.slice(0, 3).map((alert) => (
              <AlertCard key={alert.id} alert={alert} compact />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
