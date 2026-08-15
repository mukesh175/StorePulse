import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { historyWindowDays } from '@/lib/billing';
import { getMetricSeries } from '@/lib/metrics';
import { buildWeeklySummary, getTopProducts, getAlertTrend } from '@/lib/reports';
import { RevenueChart, OrdersChart, RefundsChart, AlertTrendChart } from '@/components/charts/Charts';
import { PageHeader, MetricCard, Card, EmptyState } from '@/components/ui/Primitives';
import { formatMoney, formatNumber } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  // Reporting history is a plan entitlement — the Free plan sees 7 days.
  const historyDays = historyWindowDays(store);
  const chartDays = Math.min(30, historyDays);
  const productDays = Math.min(30, historyDays);
  const trendDays = Math.min(14, historyDays);

  const [series30, summary, topProducts, alertTrend] = await Promise.all([
    getMetricSeries(store, chartDays),
    buildWeeklySummary(store),
    getTopProducts(store, { days: productDays, limit: 10 }),
    getAlertTrend(store, trendDays),
  ]);

  const hasData = series30.some((d) => d.orders > 0);

  return (
    <div className="sp-fade-in">
      <PageHeader
        title="Reports"
        subtitle={`Last 7 days compared with the 7 days before, plus ${chartDays}-day trends`}
        actions={
          historyDays < 90 ? (
            <Link href="/plan" className="sp-btn sp-btn-sm">
              {historyDays} days of history · Upgrade for more
            </Link>
          ) : null
        }
      />

      {!hasData ? (
        <EmptyState
          emoji="📈"
          title="Not enough data yet"
          text="Reports appear once StorePulse has synced orders and generated daily metrics. Run a sync to get started."
        />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <MetricCard
                label="Revenue (7d)"
                value={formatMoney(summary.revenue, store.currency)}
                delta={summary.revenueChange}
              />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard label="Orders (7d)" value={formatNumber(summary.orders)} delta={summary.ordersChange} />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard
                label="Avg order value"
                value={formatMoney(summary.averageOrderValue, store.currency)}
                footnote="last 7 days"
              />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard
                label="Refunds (7d)"
                value={formatMoney(summary.refundAmount, store.currency)}
                delta={summary.refundChange}
                invert
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-7">
              <Card>
                <div className="sp-card-title">Revenue</div>
                <div className="sp-card-sub mb-2">Last {chartDays} days</div>
                <RevenueChart data={series30} currency={store.currency} height={240} />
              </Card>
            </div>
            <div className="col-12 col-xl-5">
              <Card>
                <div className="sp-card-title">Orders</div>
                <div className="sp-card-sub mb-2">Last {chartDays} days</div>
                <OrdersChart data={series30} height={240} />
              </Card>
            </div>
            <div className="col-12 col-xl-6">
              <Card>
                <div className="sp-card-title">Refunds</div>
                <div className="sp-card-sub mb-2">Last {chartDays} days</div>
                <RefundsChart data={series30} currency={store.currency} height={220} />
              </Card>
            </div>
            <div className="col-12 col-xl-6">
              <Card>
                <div className="sp-card-title">Alert trend</div>
                <div className="sp-card-sub mb-2">Critical and warning alerts raised, last 14 days</div>
                <AlertTrendChart data={alertTrend} height={220} />
              </Card>
            </div>
          </div>

          <Card className="mt-3">
            <div className="sp-card-title mb-1">Top products</div>
            <div className="sp-card-sub mb-3">By units sold in the last {productDays} days</div>
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Est. revenue</th>
                    <th>Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product) => (
                    <tr key={product.shopifyProductId}>
                      <td>{product.title}</td>
                      <td className="sp-num">{formatNumber(product.units)}</td>
                      <td className="sp-num">{formatMoney(product.revenue, store.currency)}</td>
                      <td className="sp-num">
                        {product.inventory === null ? (
                          '—'
                        ) : (
                          <span className={`sp-pill ${product.inventory <= 0 ? 'critical' : 'neutral'}`}>
                            {formatNumber(product.inventory)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
