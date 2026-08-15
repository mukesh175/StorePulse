import Link from 'next/link';

/**
 * Shown at the moment the plan limit actually costs the merchant something —
 * a critical alert that waited for tomorrow's digest instead of being emailed.
 * Concrete and specific beats a pricing table: the point is the delay, stated
 * with the real detection time.
 */
export default function UpgradePrompt({ variant = 'list', detectedAt = null, digestHour = 8 }) {
  if (variant === 'detail' && detectedAt) {
    const time = new Date(detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="sp-banner info mb-3">
        <span aria-hidden="true">⏱</span>
        <div className="flex-grow-1">
          <strong>This was detected at {time} — you&apos;ll see it in tomorrow&apos;s digest.</strong>
          <div className="mt-1">
            On Starter, StorePulse emails you the moment a critical issue is detected, instead of waiting until{' '}
            {String(digestHour).padStart(2, '0')}:00 the next morning.
          </div>
          <Link href="/plan" className="sp-btn sp-btn-sm sp-btn-primary mt-2">
            See Starter — $9/month
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-banner info mb-3">
      <span aria-hidden="true">⏱</span>
      <div className="flex-grow-1">
        <strong>Critical alerts are waiting for tomorrow&apos;s digest.</strong>
        <div className="mt-1">
          On the Free plan you find out the next morning. Starter emails you the moment something breaks — usually
          within a minute or two of it happening.
        </div>
        <Link href="/plan" className="sp-btn sp-btn-sm sp-btn-primary mt-2">
          See Starter — $9/month
        </Link>
      </div>
    </div>
  );
}
