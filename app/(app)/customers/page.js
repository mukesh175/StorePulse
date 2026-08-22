import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { getSegments } from '@/lib/segments';
import { logCustomerDataViewed } from '@/lib/audit';
import { adminUrl } from '@/lib/shopify/urls';
import { PageHeader, Card, EmptyState, MetricCard } from '@/components/ui/Primitives';
import { formatMoney, formatNumber, timeAgo } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

// Matches the guard in the customer alert rules: below this, segment counts
// are noise rather than signal.
const MIN_USEFUL_CUSTOMERS = 20;

export default async function CustomersPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const { totalCustomers, totalValue, segments } = await getSegments(store, { days: 365 });

  const selectedId = segments.some((s) => s.id === params?.segment) ? params.segment : segments[0]?.id;
  const selected = segments.find((s) => s.id === selectedId);

  if (totalCustomers > 0) {
    await logCustomerDataViewed(store.id, 'CUSTOMER', totalCustomers, 'Customer segments page');
  }

  if (totalCustomers === 0) {
    return (
      <div className="sp-fade-in">
        <PageHeader title="Customers" subtitle="Segments built from your synced orders." />
        <EmptyState
          emoji="👥"
          title="No customer data yet"
          text="Segments appear once StorePulse has synced orders that include customer details."
        />
      </div>
    );
  }

  return (
    <div className="sp-fade-in">
      <PageHeader
        title="Customers"
        subtitle="Segments computed from the last 12 months of orders. StorePulse never contacts your customers — it tells you who needs attention."
      />

      {totalCustomers < MIN_USEFUL_CUSTOMERS && (
        <div className="sp-banner info mb-3">
          <span aria-hidden="true">📊</span>
          <div>
            <strong>
              Segments need more customers to be meaningful — you have {formatNumber(totalCustomers)}.
            </strong>
            <div className="mt-1">
              Grouping works from around {MIN_USEFUL_CUSTOMERS} customers onward, which is also when StorePulse
              starts raising customer alerts. Until then this page will look sparse, and that is expected rather
              than a problem with your store.
            </div>
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <MetricCard label="Customers" value={formatNumber(totalCustomers)} footnote="last 12 months" />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard label="Lifetime value" value={formatMoney(totalValue, store.currency)} footnote="net of refunds" />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard
            label="Average value"
            value={formatMoney(totalCustomers ? totalValue / totalCustomers : 0, store.currency)}
            footnote="per customer"
          />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard
            label="At risk"
            value={formatNumber(segments.find((s) => s.id === 'AT_RISK')?.count ?? 0)}
            footnote="quiet 60+ days"
          />
        </div>
      </div>

      <div className="row g-3 mb-3">
        {segments.map((segment) => (
          <div className="col-12 col-md-6 col-xl-4" key={segment.id}>
            <a href={`/customers?segment=${segment.id}`} style={{ color: 'inherit', display: 'block', height: '100%' }}>
              <div
                className="sp-card sp-card-pad sp-card-hover h-100"
                style={segment.id === selectedId ? { borderColor: 'var(--sp-brand)' } : undefined}
              >
                <div className="d-flex align-items-center gap-2">
                  <span aria-hidden="true">{segment.emoji}</span>
                  <strong style={{ fontSize: 14.5 }}>{segment.label}</strong>
                  <span className={`sp-pill ${segment.tone} ms-auto`}>{formatNumber(segment.count)}</span>
                </div>
                <div className="sp-card-sub mt-2">{segment.description}</div>
                <div className="sp-metric-foot mt-2">
                  {formatMoney(segment.value, store.currency)} lifetime value
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>

      {selected && (
        <Card pad={false}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
            <div>
              <div className="sp-card-title">
                {selected.emoji} {selected.label}
              </div>
              <div className="sp-card-sub mt-1">
                {formatNumber(selected.count)} customers ·{' '}
                {formatMoney(selected.averageValue, store.currency)} average lifetime value
              </div>
            </div>
            <a
              className="sp-btn sp-btn-sm"
              href={adminUrl(store.shopDomain, '/customers')}
              target="_blank"
              rel="noreferrer"
            >
              Open customers in Shopify
            </a>
          </div>

          {selected.members.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-title">No customers in this segment</div>
              <p className="sp-empty-text">That is usually good news.</p>
            </div>
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Orders</th>
                    <th>Lifetime value</th>
                    <th>Avg order</th>
                    <th>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.members.map((customer) => (
                    <tr key={customer.email}>
                      <td>
                        <strong>{customer.name || '—'}</strong>
                        <div className="sp-card-sub">{customer.email}</div>
                      </td>
                      <td className="sp-num">{customer.orders}</td>
                      <td className="sp-num">{formatMoney(customer.lifetimeValue, store.currency)}</td>
                      <td className="sp-num">{formatMoney(customer.averageOrderValue, store.currency)}</td>
                      <td className="sp-card-sub">{timeAgo(customer.lastOrderAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected.count > selected.members.length && (
            <div className="sp-help p-3">
              Showing the {selected.members.length} highest-value customers of {formatNumber(selected.count)}.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
