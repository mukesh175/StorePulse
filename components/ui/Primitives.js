import Link from 'next/link';
import { formatPercent } from '@/lib/utils/format';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        {subtitle && <p className="sp-card-sub mt-1 mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', pad = true, hover = false }) {
  return (
    <div className={`sp-card${pad ? ' sp-card-pad' : ''}${hover ? ' sp-card-hover' : ''} ${className}`}>{children}</div>
  );
}

export function SeverityPill({ severity }) {
  const key = String(severity || 'INFO').toLowerCase();
  const dot = { critical: '🔴', warning: '🟠', info: '🔵', success: '🟢' }[key] ?? '';
  return (
    <span className={`sp-pill ${key}`}>
      <span aria-hidden="true">{dot}</span>
      {severity}
    </span>
  );
}

export function StatusPill({ status }) {
  const tone =
    { OPEN: 'critical', ACKNOWLEDGED: 'warning', RESOLVED: 'success', DISMISSED: 'neutral' }[status] ?? 'neutral';
  return <span className={`sp-pill ${tone}`}>{status}</span>;
}

/** Positive is not always "up" — refunds rising is bad. */
export function Delta({ value, invert = false }) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.05) return <span className="sp-delta flat">no change</span>;
  const good = invert ? n < 0 : n > 0;
  return (
    <span className={`sp-delta ${good ? 'up' : 'down'}`}>
      {n > 0 ? '▲' : '▼'} {formatPercent(Math.abs(n), { signed: false })}
    </span>
  );
}

export function MetricCard({ label, value, delta, invert = false, footnote, href }) {
  const body = (
    <div className="sp-card sp-card-pad sp-card-hover h-100">
      <div className="sp-metric-label">{label}</div>
      <div className="sp-metric-value sp-num">{value}</div>
      <div className="sp-metric-foot">
        {delta !== undefined && delta !== null ? <Delta value={delta} invert={invert} /> : null}
        {footnote && <span>{footnote}</span>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ color: 'inherit', display: 'block', height: '100%' }}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ emoji = '🎉', title, text, action }) {
  return (
    <div className="sp-card sp-empty">
      <div className="sp-empty-emoji" aria-hidden="true">
        {emoji}
      </div>
      <div className="sp-empty-title">{title}</div>
      {text && <p className="sp-empty-text">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ title = "We couldn't retrieve your Shopify data.", detail, lastSyncAt }) {
  return (
    <div className="sp-banner warning">
      <span aria-hidden="true">⚠</span>
      <div>
        <strong>{title}</strong>
        <div className="mt-1">{detail || "We'll automatically retry."}</div>
        {lastSyncAt && <div className="mt-1 sp-card-sub">Last successful sync: {lastSyncAt}</div>}
      </div>
    </div>
  );
}

export function Section({ title, sub, actions, children }) {
  return (
    <section className="mb-4">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
        <div>
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          {sub && <div className="sp-card-sub mt-1">{sub}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
