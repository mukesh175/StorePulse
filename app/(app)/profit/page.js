import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { findLeaks } from '@/lib/profit/leaks';
import { productAdminUrl } from '@/lib/shopify/urls';
import { PageHeader, Card, MetricCard, EmptyState, Section } from '@/components/ui/Primitives';
import { formatMoney, formatNumber } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

function BasisTag({ basis }) {
  return (
    <span className={`sp-pill ${basis === 'MEASURED' ? 'info' : 'neutral'}`} title={
      basis === 'MEASURED'
        ? 'Calculated entirely from your Shopify data'
        : 'Uses the cost assumptions you entered in settings'
    }>
      {basis === 'MEASURED' ? 'Measured' : 'Estimated'}
    </span>
  );
}

function FindingCard({ finding, currency, tone }) {
  return (
    <article className={`sp-card sp-card-pad sp-alert-card ${tone} mb-2`}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <BasisTag basis={finding.basis} />
        <span className="sp-card-sub ms-auto">
          {tone === 'success' ? 'Opportunity' : 'Impact'}: <strong>{formatMoney(finding.impact, currency)}</strong>/month
        </span>
      </div>
      <h3 className="mt-2 mb-1" style={{ fontSize: 15.5 }}>
        {finding.title}
      </h3>
      <p className="mb-2" style={{ fontSize: 14, color: 'var(--sp-ink-2)' }}>
        {finding.detail}
      </p>
      <div style={{ fontSize: 13.5 }}>
        <strong>Do this:</strong> {finding.action}
      </div>
    </article>
  );
}

export default async function ProfitPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const days = [30, 60, 90].includes(Number(params?.days)) ? Number(params.days) : 30;

  const result = await findLeaks(store, { days });
  const { analysis, leaks, opportunities, actions } = result;
  const currency = store.currency;
  const coverage = analysis.coverage;

  if (analysis.items.length === 0) {
    return (
      <div className="sp-fade-in">
        <PageHeader title="Profit leaks" subtitle="Where your store is losing money." />
        <EmptyState
          emoji="💸"
          title="Not enough orders to analyse yet"
          text="Profit analysis needs orders with products attached. Run a sync, then come back once you have some sales in the window."
        />
      </div>
    );
  }

  return (
    <div className="sp-fade-in">
      <PageHeader
        title="Profit leaks"
        subtitle={`Every order in the last ${days} days, analysed for where money is leaking out.`}
        actions={
          <div className="sp-tabs">
            {[30, 60, 90].map((option) => (
              <Link key={option} href={`/profit?days=${option}`} className={`sp-tab${days === option ? ' active' : ''}`}>
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      {!coverage.complete && (
        <div className="sp-banner warning mb-3">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>
              {coverage.withCost} of {coverage.totalVariants} variants have a cost recorded (
              {coverage.percent.toFixed(0)}%).
            </strong>
            <div className="mt-1">
              Margin can only be calculated for products with a unit cost. Add cost per item in Shopify
              (Products → Variant → Cost per item), then re-sync. Products without a cost are shown but excluded
              from profit figures rather than counted as pure profit.
            </div>
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <MetricCard
            label="Net revenue"
            value={formatMoney(analysis.totals.netRevenue, currency)}
            footnote={`after ${formatMoney(analysis.totals.refunds, currency)} refunds`}
          />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard
            label="Contribution"
            value={formatMoney(analysis.totals.contribution, currency)}
            footnote="after cost, refunds, discounts, shipping"
          />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard
            label="Leaking"
            value={formatMoney(result.totalLeakage, currency)}
            footnote="per month, if unchanged"
          />
        </div>
        <div className="col-6 col-lg-3">
          <MetricCard
            label="Opportunity"
            value={formatMoney(result.totalOpportunity, currency)}
            footnote="per month, if acted on"
          />
        </div>
      </div>

      {actions.length > 0 && (
        <Section title="Today's 3 actions" sub="Ranked by estimated monthly impact.">
          {actions.map((action, index) => (
            <div className="sp-card sp-card-pad mb-2 d-flex gap-3 align-items-start" key={action.id}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--sp-brand)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flex: '0 0 auto',
                }}
              >
                {index + 1}
              </div>
              <div className="flex-grow-1">
                <div style={{ fontSize: 15, fontWeight: 600 }}>{action.title}</div>
                <div className="sp-card-sub mt-1">{action.context}</div>
              </div>
              <div className="text-end">
                <div style={{ fontWeight: 700 }}>{formatMoney(action.impact, currency)}</div>
                <div className="sp-card-sub">per month</div>
                <div className="mt-1">
                  <BasisTag basis={action.basis} />
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title={`🔴 Money leaks (${leaks.length})`} sub="Ranked by what each one costs you per month.">
        {leaks.length === 0 ? (
          <EmptyState
            title="No leaks detected"
            text="Nothing in this window crossed the thresholds for an unprofitable product, an expensive discount, a loss-making shipping zone or unusual returns."
          />
        ) : (
          leaks.map((leak) => (
            <FindingCard key={leak.id} finding={leak} currency={currency} tone="critical" />
          ))
        )}
      </Section>

      <Section title={`🟢 Opportunities (${opportunities.length})`}>
        {opportunities.length === 0 ? (
          <p className="sp-card-sub">No clear opportunities in this window.</p>
        ) : (
          opportunities.map((opportunity) => (
            <FindingCard key={opportunity.id} finding={opportunity} currency={currency} tone="success" />
          ))
        )}
      </Section>

      <Section title="Product economics" sub="Worst contribution first. Products without a recorded cost show as unknown.">
        <Card pad={false}>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Net revenue</th>
                  <th>COGS</th>
                  <th>Refunds</th>
                  <th>Discounts</th>
                  <th>Order costs</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {analysis.items.slice(0, 30).map((item) => (
                  <tr key={item.shopifyProductId}>
                    <td>
                      <a
                        href={productAdminUrl(store.shopDomain, item.shopifyProductId)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'inherit' }}
                      >
                        <strong>{item.title}</strong>
                      </a>
                      {!item.costKnown && <div className="sp-card-sub">no cost recorded</div>}
                    </td>
                    <td className="sp-num">{formatNumber(item.units)}</td>
                    <td className="sp-num">{formatMoney(item.netRevenue, currency)}</td>
                    <td className="sp-num">{item.costKnown ? formatMoney(item.cogs, currency) : '—'}</td>
                    <td className="sp-num">{formatMoney(item.refunds, currency)}</td>
                    <td className="sp-num">{formatMoney(item.discounts, currency)}</td>
                    <td className="sp-num">{formatMoney(item.allocatedOrderCosts, currency)}</td>
                    <td className="sp-num">
                      {item.contribution === null ? (
                        <span className="sp-pill neutral">unknown</span>
                      ) : (
                        <span className={`sp-pill ${item.contribution < 0 ? 'critical' : 'success'}`}>
                          {formatMoney(item.contribution, currency)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <div className="sp-help">
        <strong>Measured</strong> figures come from your Shopify data. <strong>Estimated</strong> figures use the
        shipping, payment fee, COD and ad spend assumptions from{' '}
        <Link href="/settings">settings</Link> — change those and every estimate here updates.
      </div>
    </div>
  );
}
