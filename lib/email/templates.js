import { env } from '@/lib/env';
import { formatMoney, formatPercent, timeAgo } from '@/lib/utils/format';

const COLORS = {
  ink: '#0f1729',
  muted: '#5b6478',
  border: '#e5e8ef',
  bg: '#f6f7fb',
  brand: '#3d5afe',
  critical: '#d92d20',
  warning: '#dc6803',
  success: '#079455',
  info: '#175cd3',
};

const SEVERITY_COLOR = {
  CRITICAL: COLORS.critical,
  WARNING: COLORS.warning,
  SUCCESS: COLORS.success,
  INFO: COLORS.info,
};

const SEVERITY_DOT = { CRITICAL: '🔴', WARNING: '🟠', INFO: '🔵', SUCCESS: '🟢' };

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appLink(path = '/dashboard') {
  return `${env.appUrl}${path}`;
}

function layout({ title, preheader, storeName, body, ctaLabel, ctaUrl }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || '')}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 28px 8px 28px;">
            <div style="font-size:17px;font-weight:700;letter-spacing:-0.3px;">
              <span style="color:${COLORS.brand};">◈</span> StorePulse
            </div>
            <div style="font-size:12px;color:${COLORS.muted};margin-top:2px;">${escapeHtml(storeName)}</div>
          </td></tr>
          <tr><td style="padding:8px 28px 4px 28px;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;letter-spacing:-0.4px;">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:12px 28px 4px 28px;">${body}</td></tr>
          ${
            ctaUrl
              ? `<tr><td style="padding:20px 28px 28px 28px;">
                  <a href="${ctaUrl}" style="display:inline-block;background:${COLORS.brand};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">${escapeHtml(
                  ctaLabel
                )}</a>
                </td></tr>`
              : ''
          }
          <tr><td style="padding:18px 28px;border-top:1px solid ${COLORS.border};color:${COLORS.muted};font-size:12px;line-height:1.6;">
            StorePulse — Know what needs attention. Every day.<br />
            <a href="${appLink('/settings')}" style="color:${COLORS.muted};">Notification settings</a> ·
            <a href="${appLink('/notifications')}" style="color:${COLORS.muted};">Notification history</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function statTile(label, value, sub) {
  return `<td style="padding:10px 12px;border:1px solid ${COLORS.border};border-radius:12px;width:33%;vertical-align:top;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.muted};">${escapeHtml(label)}</div>
    <div style="font-size:19px;font-weight:700;margin-top:4px;">${escapeHtml(value)}</div>
    ${sub ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:2px;">${escapeHtml(sub)}</div>` : ''}
  </td>`;
}

function alertRow(alert, currency) {
  const color = SEVERITY_COLOR[alert.severity] || COLORS.muted;
  return `<div style="border:1px solid ${COLORS.border};border-left:3px solid ${color};border-radius:10px;padding:12px 14px;margin-bottom:10px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.6px;color:${color};">${SEVERITY_DOT[alert.severity] || ''} ${escapeHtml(
    alert.severity
  )}</div>
    <div style="font-size:15px;font-weight:600;margin-top:3px;">${escapeHtml(alert.title)}</div>
    <div style="font-size:13px;color:${COLORS.ink};margin-top:3px;">${escapeHtml(alert.message)}</div>
    ${
      alert.whyItMatters
        ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:6px;">${escapeHtml(alert.whyItMatters)}</div>`
        : ''
    }
    ${
      alert.recommendedAction
        ? `<div style="font-size:12px;color:${COLORS.ink};margin-top:6px;"><strong>Do this:</strong> ${escapeHtml(
            alert.recommendedAction
          )}</div>`
        : ''
    }
    <div style="font-size:11px;color:${COLORS.muted};margin-top:6px;">Detected ${escapeHtml(
      timeAgo(alert.firstDetectedAt)
    )}${currency ? '' : ''}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Template 1 — Critical alert
// ---------------------------------------------------------------------------
export function criticalAlertEmail({ store, alert }) {
  const body = `
    ${alertRow(alert, store.currency)}
    <p style="font-size:13px;color:${COLORS.muted};line-height:1.6;margin:14px 0 0 0;">
      StorePulse groups repeat signals into a single alert, so you will not receive another email for this issue
      unless it is resolved and happens again.
    </p>`;

  return {
    subject: '🚨 StorePulse — Action required',
    html: layout({
      title: alert.title,
      preheader: alert.message,
      storeName: store.shopName || store.shopDomain,
      body,
      ctaLabel: 'Open StorePulse',
      ctaUrl: appLink(`/alerts/${alert.id}`),
    }),
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Daily digest
// ---------------------------------------------------------------------------
export function dailyDigestEmail({ store, brief }) {
  const { metrics, counts, health } = brief;
  const currency = store.currency;

  const section = (heading, alerts) =>
    alerts.length
      ? `<h2 style="font-size:14px;margin:22px 0 10px 0;letter-spacing:-0.2px;">${heading}</h2>${alerts
          .slice(0, 5)
          .map((a) => alertRow(a, currency))
          .join('')}`
      : '';

  const body = `
    <p style="font-size:14px;color:${COLORS.muted};line-height:1.6;margin:4px 0 16px 0;">
      Here is what needs your attention today. Store health is <strong style="color:${COLORS.ink};">${health.score}/100</strong> (${escapeHtml(
    health.label
  )}).
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:6px;">
      <tr>
        ${statTile('Yesterday revenue', formatMoney(metrics.yesterday.revenue, currency), formatPercent(metrics.changes.revenue) + ' vs prior day')}
        ${statTile('Orders', String(metrics.yesterday.orders), formatPercent(metrics.changes.orders) + ' vs prior day')}
        ${statTile('Avg order value', formatMoney(metrics.yesterday.averageOrderValue, currency), formatPercent(metrics.changes.averageOrderValue))}
      </tr>
      <tr>
        ${statTile('Critical issues', String(counts.critical))}
        ${statTile('Warnings', String(counts.warning))}
        ${statTile('Delayed orders', String(counts.delayedOrders))}
      </tr>
    </table>

    ${section(`🔴 Critical (${counts.critical})`, brief.critical)}
    ${section(`🟠 Warnings (${counts.warning})`, brief.warnings)}
    ${section(`🟢 Good news (${counts.positive})`, brief.positives)}

    ${
      counts.critical + counts.warning === 0
        ? `<div style="border:1px solid ${COLORS.border};border-radius:12px;padding:18px;text-align:center;margin-top:14px;">
             <div style="font-size:20px;">🎉</div>
             <div style="font-size:15px;font-weight:600;margin-top:6px;">Everything looks good</div>
             <div style="font-size:13px;color:${COLORS.muted};margin-top:4px;">No critical issues in your store right now. We'll keep watching.</div>
           </div>`
        : ''
    }

    ${
      brief.topProduct
        ? `<p style="font-size:13px;color:${COLORS.muted};margin-top:18px;">Best seller in the last 24 hours: <strong style="color:${COLORS.ink};">${escapeHtml(
            brief.topProduct.title
          )}</strong> (${brief.topProduct.units} units).</p>`
        : ''
    }`;

  return {
    subject: '☀️ StorePulse — Your daily store brief',
    html: layout({
      title: 'Good morning 👋',
      preheader: `${counts.critical} critical · ${counts.warning} warnings · ${formatMoney(
        metrics.yesterday.revenue,
        currency
      )} yesterday`,
      storeName: store.shopName || store.shopDomain,
      body,
      ctaLabel: 'Open your dashboard',
      ctaUrl: appLink('/dashboard'),
    }),
  };
}

// ---------------------------------------------------------------------------
// Template 3 — Weekly summary
// ---------------------------------------------------------------------------
export function weeklySummaryEmail({ store, summary }) {
  const currency = store.currency;
  const body = `
    <p style="font-size:14px;color:${COLORS.muted};line-height:1.6;margin:4px 0 16px 0;">
      Your last 7 days compared with the 7 days before.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6">
      <tr>
        ${statTile('Revenue', formatMoney(summary.revenue, currency), formatPercent(summary.revenueChange))}
        ${statTile('Orders', String(summary.orders), formatPercent(summary.ordersChange))}
        ${statTile('Avg order value', formatMoney(summary.averageOrderValue, currency), '')}
      </tr>
      <tr>
        ${statTile('Refunds', formatMoney(summary.refundAmount, currency), `${summary.refunds} orders`)}
        ${statTile('Units sold', String(summary.unitsSold), '')}
        ${statTile('Alerts raised', String(summary.alertsRaised), `${summary.alertsResolved} resolved`)}
      </tr>
    </table>
    ${
      summary.bestSeller
        ? `<p style="font-size:13px;color:${COLORS.muted};margin-top:18px;">Best seller: <strong style="color:${COLORS.ink};">${escapeHtml(
            summary.bestSeller.title
          )}</strong> — ${summary.bestSeller.units} units.</p>`
        : ''
    }`;

  return {
    subject: '📊 StorePulse — Weekly store report',
    html: layout({
      title: 'Your week in review',
      preheader: `${formatMoney(summary.revenue, currency)} revenue · ${summary.orders} orders`,
      storeName: store.shopName || store.shopDomain,
      body,
      ctaLabel: 'View reports',
      ctaUrl: appLink('/reports'),
    }),
  };
}
