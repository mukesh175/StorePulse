import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlertCounts } from '@/lib/health';
import { SidebarNav, MobileNav } from '@/components/navigation/NavLinks';
import SyncButton from '@/components/ui/SyncButton';
import ReconnectBanner from '@/components/ui/ReconnectBanner';
import { needsReconnect } from '@/lib/shopify/token';
import BrowserNotifier from '@/components/notifications/BrowserNotifier';
import { timeAgo } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const counts = await getAlertCounts(store.id);
  const browserNotifications = store.preference?.browserNotificationsEnabled ?? false;

  return (
    <div className="sp-shell">
      <BrowserNotifier enabled={browserNotifications} />

      <aside className="sp-sidebar">
        <div className="sp-brand">
          <span className="sp-brand-mark" aria-hidden="true">
            ◈
          </span>
          StorePulse
        </div>
        <SidebarNav criticalCount={counts.CRITICAL} />

        <div className="sp-card sp-card-pad mt-4" style={{ background: 'var(--sp-canvas)', boxShadow: 'none' }}>
          <div className="sp-card-title">Store health at a glance</div>
          <div className="sp-card-sub mt-1">
            {counts.CRITICAL} critical · {counts.WARNING} warnings
          </div>
          <Link href="/alerts" className="sp-btn sp-btn-sm w-100 mt-3">
            Open alert center
          </Link>
        </div>
      </aside>

      <div className="sp-main">
        <header className="sp-topbar">
          <span className="sp-store-chip">
            <span className="dot" aria-hidden="true" />
            {store.shopName || store.shopDomain}
            {store.isDemo && <span className="sp-pill neutral ms-1">Demo</span>}
          </span>

          <span className="d-none d-md-inline sp-card-sub">
            Last sync {store.lastSyncAt ? timeAgo(store.lastSyncAt) : 'not yet run'}
          </span>

          <div className="ms-auto d-flex align-items-center gap-2">
            <SyncButton />
          </div>
        </header>

        <main className="sp-content">
          {needsReconnect(store) && <ReconnectBanner shopDomain={store.shopDomain} />}
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
