import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlertSettings } from '@/lib/alerts/scan';
import { PageHeader, EmptyState } from '@/components/ui/Primitives';
import { formatMoney, hoursSince, timeAgo } from '@/lib/utils/format';
import { orderAdminUrl } from '@/lib/shopify/urls';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const UNFULFILLED = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED'];

const FILTERS = [
  { key: 'all', label: 'All orders' },
  { key: 'delayed', label: 'Delayed' },
  { key: 'unfulfilled', label: 'Unfulfilled' },
  { key: 'refunded', label: 'Refunded' },
];

export default async function OrdersPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const filter = FILTERS.some((f) => f.key === params?.filter) ? params.filter : 'all';
  const page = Math.max(1, Number.parseInt(params?.page ?? '1', 10) || 1);

  const settings = await getAlertSettings(store);
  const warnCutoff = new Date(Date.now() - settings.delayedOrderWarnHours * 3600 * 1000);

  const where = { shopId: store.id };
  if (filter === 'delayed') {
    Object.assign(where, {
      fulfillmentStatus: { in: UNFULFILLED },
      processedAt: { lte: warnCutoff },
      isCancelled: false,
    });
  } else if (filter === 'unfulfilled') {
    Object.assign(where, { fulfillmentStatus: { in: UNFULFILLED }, isCancelled: false });
  } else if (filter === 'refunded') {
    Object.assign(where, { refundedAmount: { gt: 0 } });
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="sp-fade-in">
      <PageHeader title="Orders" subtitle={`${total} order${total === 1 ? '' : 's'} in the synced window`} />

      <div className="sp-tabs mb-3">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/orders?filter=${f.key}`} className={`sp-tab${filter === f.key ? ' active' : ''}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="No orders here"
          text={
            filter === 'delayed'
              ? 'Every order is being fulfilled on time. Nice work.'
              : 'Orders will appear here as soon as they are synced from Shopify.'
          }
        />
      ) : (
        <div className="sp-card">
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Age</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const age = Math.floor(hoursSince(order.processedAt));
                  const delayed =
                    !order.isCancelled &&
                    UNFULFILLED.includes(order.fulfillmentStatus) &&
                    age >= settings.delayedOrderWarnHours;
                  const critical = delayed && age >= settings.delayedOrderCritHours;

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.orderNumber}</strong>
                        <div className="sp-card-sub">{timeAgo(order.processedAt)}</div>
                      </td>
                      <td>
                        {order.customerName || '—'}
                        <div className="sp-card-sub">{order.customerEmail || ''}</div>
                      </td>
                      <td className="sp-num">
                        {formatMoney(order.totalPrice, order.currency)}
                        {Number(order.refundedAmount) > 0 && (
                          <div className="sp-card-sub" style={{ color: 'var(--sp-critical)' }}>
                            −{formatMoney(order.refundedAmount, order.currency)} refunded
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="sp-pill neutral">{order.financialStatus || 'UNKNOWN'}</span>
                        {order.isCOD && <div className="sp-card-sub mt-1">Cash on delivery</div>}
                      </td>
                      <td>
                        <span
                          className={`sp-pill ${
                            order.fulfillmentStatus === 'FULFILLED' ? 'success' : critical ? 'critical' : delayed ? 'warning' : 'neutral'
                          }`}
                        >
                          {order.fulfillmentStatus || 'UNFULFILLED'}
                        </span>
                      </td>
                      <td className="sp-num">{age}h</td>
                      <td>
                        <a
                          className="sp-btn sp-btn-sm"
                          href={orderAdminUrl(store.shopDomain, order.shopifyOrderId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View order
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="d-flex align-items-center justify-content-between mt-3">
          <span className="sp-card-sub">
            Page {page} of {pages}
          </span>
          <div className="d-flex gap-2">
            {page > 1 && (
              <Link className="sp-btn sp-btn-sm" href={`/orders?filter=${filter}&page=${page - 1}`}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="sp-btn sp-btn-sm" href={`/orders?filter=${filter}&page=${page + 1}`}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
