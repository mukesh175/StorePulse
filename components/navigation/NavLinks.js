'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '◎' },
  { href: '/alerts', label: 'Alerts', icon: '⚠' },
  { href: '/orders', label: 'Orders', icon: '🧾' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/inventory', label: 'Inventory', icon: '🗃' },
  { href: '/reports', label: 'Reports', icon: '📈' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
  { href: '/plan', label: 'Plan', icon: '✦' },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((i) =>
  ['/dashboard', '/alerts', '/orders', '/inventory', '/settings'].includes(i.href)
);

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ criticalCount = 0 }) {
  const pathname = usePathname();

  return (
    <nav className="sp-nav" aria-label="Main">
      <div className="sp-nav-label">Monitoring</div>
      {NAV_ITEMS.slice(0, 6).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`sp-nav-item${isActive(pathname, item.href) ? ' active' : ''}`}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
        >
          <span className="sp-nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
          {item.href === '/alerts' && criticalCount > 0 && (
            <span className="sp-nav-badge" aria-label={`${criticalCount} critical alerts`}>
              {criticalCount}
            </span>
          )}
        </Link>
      ))}

      <div className="sp-nav-label">Account</div>
      {NAV_ITEMS.slice(6).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`sp-nav-item${isActive(pathname, item.href) ? ' active' : ''}`}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
        >
          <span className="sp-nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sp-mobile-nav" aria-label="Main (mobile)">
      {MOBILE_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
          <span className="ico" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
