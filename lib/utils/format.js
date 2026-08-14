const CURRENCY_LOCALE = {
  INR: 'en-IN',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

export function formatMoney(amount, currency = 'USD', { compact = false } = {}) {
  const value = Number(amount || 0);
  const locale = CURRENCY_LOCALE[currency] || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: compact || Math.abs(value) >= 1000 ? 0 : 2,
      notation: compact && Math.abs(value) >= 100000 ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function formatPercent(value, { signed = true } = {}) {
  const n = Number(value || 0);
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function percentChange(current, previous) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / Math.abs(b)) * 100;
}

export function timeAgo(date) {
  if (!date) return '—';
  const then = new Date(date).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return '—';

  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(date).toLocaleDateString();
}

export function hoursSince(date) {
  if (!date) return 0;
  return (Date.now() - new Date(date).getTime()) / 3600000;
}

export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', options);
}

export function titleCase(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
