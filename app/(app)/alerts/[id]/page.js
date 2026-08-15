import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlert } from '@/lib/alerts/queries';
import { logCustomerDataViewed } from '@/lib/audit';
import AlertActions from '@/components/alerts/AlertActions';
import { SeverityPill, StatusPill, Card } from '@/components/ui/Primitives';
import { formatMoney, timeAgo, titleCase } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const HIDDEN_METADATA_KEYS = new Set(['productId', 'orderId']);

function formatMetadataValue(key, value, currency) {
  if (value === null || value === undefined) return '—';
  if (/price|revenue|amount|impact/i.test(key)) return formatMoney(value, currency);
  if (/percent/i.test(key)) return `${Number(value).toFixed(1)}%`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default async function AlertDetailPage({ params }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const { id } = await params;
  const alert = await getAlert(store.id, id);
  if (!alert) notFound();

  const metadata = alert.metadata || {};

  // Delayed-order alerts carry the customer's name and email in metadata.
  if (metadata.customerName || metadata.customerEmail) {
    await logCustomerDataViewed(store.id, 'ALERT', 1, `Alert detail (${alert.type})`);
  }

  // "Last sale" context makes the sold-out story concrete.
  let lastSale = null;
  if (metadata.productId) {
    const line = await prisma.orderLineItem.findFirst({
      where: { shopifyProductId: String(metadata.productId), order: { shopId: store.id } },
      orderBy: { order: { processedAt: 'desc' } },
      include: { order: { select: { processedAt: true, orderNumber: true } } },
    });
    lastSale = line?.order ?? null;
  }

  const notifications = await prisma.notificationLog.findMany({
    where: { shopId: store.id, alertId: alert.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="sp-fade-in" style={{ maxWidth: 860 }}>
      <Link href="/alerts" className="sp-btn sp-btn-sm sp-btn-ghost mb-3">
        ← Back to alerts
      </Link>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <SeverityPill severity={alert.severity} />
        <StatusPill status={alert.status} />
        <span className="sp-pill neutral">{titleCase(alert.category)}</span>
        {alert.snoozedUntil && alert.snoozedUntil > new Date() && (
          <span className="sp-pill neutral">Snoozed until {alert.snoozedUntil.toLocaleString()}</span>
        )}
      </div>

      <h1 style={{ fontSize: 24 }}>{alert.title}</h1>
      <p className="mt-2" style={{ fontSize: 15, color: 'var(--sp-ink-2)' }}>
        {alert.message}
      </p>

      <div className="d-flex flex-wrap gap-2 my-3">
        {alert.resourceUrl && (
          <a className="sp-btn sp-btn-primary" href={alert.resourceUrl} target="_blank" rel="noreferrer">
            View in Shopify
          </a>
        )}
        <AlertActions
          alertId={alert.id}
          size="md"
          actions={
            ['OPEN', 'ACKNOWLEDGED'].includes(alert.status)
              ? ['resolve', 'dismiss', 'snooze']
              : ['reopen']
          }
        />
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <Card>
            <div className="sp-card-title mb-2">Details</div>
            <div className="sp-kv">
              <span className="sp-kv-label">First detected</span>
              <span className="sp-kv-value">{timeAgo(alert.firstDetectedAt)}</span>
            </div>
            <div className="sp-kv">
              <span className="sp-kv-label">Last detected</span>
              <span className="sp-kv-value">{timeAgo(alert.lastDetectedAt)}</span>
            </div>
            <div className="sp-kv">
              <span className="sp-kv-label">Times detected</span>
              <span className="sp-kv-value sp-num">{alert.occurrences}</span>
            </div>
            {lastSale && (
              <div className="sp-kv">
                <span className="sp-kv-label">Last sale</span>
                <span className="sp-kv-value">
                  {timeAgo(lastSale.processedAt)} ({lastSale.orderNumber})
                </span>
              </div>
            )}
            {alert.resolvedAt && (
              <div className="sp-kv">
                <span className="sp-kv-label">Resolved</span>
                <span className="sp-kv-value">{timeAgo(alert.resolvedAt)}</span>
              </div>
            )}

            {Object.keys(metadata).length > 0 && (
              <>
                <hr className="sp-divider" />
                <div className="sp-card-title mb-2">Context</div>
                {Object.entries(metadata)
                  .filter(([key]) => !HIDDEN_METADATA_KEYS.has(key))
                  .map(([key, value]) => (
                    <div className="sp-kv" key={key}>
                      <span className="sp-kv-label">{titleCase(key.replace(/([A-Z])/g, ' $1'))}</span>
                      <span className="sp-kv-value sp-num">{formatMetadataValue(key, value, store.currency)}</span>
                    </div>
                  ))}
              </>
            )}
          </Card>
        </div>

        <div className="col-12 col-lg-5">
          {alert.whyItMatters && (
            <Card className="mb-3">
              <div className="sp-card-title mb-2">Why this matters</div>
              <p className="mb-0" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--sp-ink-2)' }}>
                {alert.whyItMatters}
              </p>
            </Card>
          )}

          {alert.recommendedAction && (
            <Card className="mb-3">
              <div className="sp-card-title mb-2">Recommended action</div>
              <p className="mb-0" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--sp-ink-2)' }}>
                {alert.recommendedAction}
              </p>
            </Card>
          )}

          <Card>
            <div className="sp-card-title mb-2">Notifications</div>
            {notifications.length === 0 ? (
              <p className="sp-card-sub mb-0">
                No email was sent for this alert. Instant emails are sent for critical alerts when enabled in{' '}
                <Link href="/settings">settings</Link>.
              </p>
            ) : (
              notifications.map((log) => (
                <div className="sp-kv" key={log.id}>
                  <span className="sp-kv-label">{log.channel}</span>
                  <span className="sp-kv-value">
                    {log.status} · {timeAgo(log.sentAt ?? log.createdAt)}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
