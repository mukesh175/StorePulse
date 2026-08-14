import Link from 'next/link';
import { SeverityPill } from '@/components/ui/Primitives';
import AlertActions from '@/components/alerts/AlertActions';
import { timeAgo } from '@/lib/utils/format';

function InventoryDelta({ metadata }) {
  if (metadata?.previousInventory === undefined || metadata?.currentInventory === undefined) return null;
  return (
    <div className="sp-card-sub mt-2">
      Inventory changed:{' '}
      <strong className="sp-num" style={{ color: 'var(--sp-ink)' }}>
        {metadata.previousInventory} → {metadata.currentInventory}
      </strong>
    </div>
  );
}

export default function AlertCard({ alert, compact = false }) {
  const severity = String(alert.severity).toLowerCase();
  const metadata = alert.metadata || {};

  return (
    <article className={`sp-card sp-card-pad sp-card-hover sp-alert-card ${severity} mb-2 sp-fade-in`}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <SeverityPill severity={alert.severity} />
        {alert.status !== 'OPEN' && <span className="sp-pill neutral">{alert.status}</span>}
        {alert.occurrences > 1 && <span className="sp-pill neutral">seen {alert.occurrences}×</span>}
        <span className="sp-card-sub ms-auto">Detected {timeAgo(alert.firstDetectedAt)}</span>
      </div>

      <h3 className="mt-2" style={{ fontSize: 16 }}>
        <Link href={`/alerts/${alert.id}`} style={{ color: 'inherit' }}>
          {alert.title}
        </Link>
      </h3>
      <p className="mb-0 mt-1" style={{ fontSize: 14, color: 'var(--sp-ink-2)' }}>
        {alert.message}
      </p>

      <InventoryDelta metadata={metadata} />

      {!compact && alert.whyItMatters && (
        <p className="sp-card-sub mt-2 mb-0" style={{ lineHeight: 1.6 }}>
          {alert.whyItMatters}
        </p>
      )}

      {!compact && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Link href={`/alerts/${alert.id}`} className="sp-btn sp-btn-sm sp-btn-primary">
            View details
          </Link>
          {alert.resourceUrl && (
            <a
              className="sp-btn sp-btn-sm"
              href={alert.resourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {alert.resourceType === 'ORDER' ? 'View order' : 'View in Shopify'}
            </a>
          )}
          {['OPEN', 'ACKNOWLEDGED'].includes(alert.status) && (
            <AlertActions alertId={alert.id} actions={['resolve', 'dismiss']} />
          )}
        </div>
      )}
    </article>
  );
}
