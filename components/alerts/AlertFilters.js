'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const STATUS_TABS = [
  { key: 'ALL_ACTIVE', label: 'All', param: {} },
  { key: 'CRITICAL', label: 'Critical', param: { severity: 'CRITICAL' } },
  { key: 'WARNING', label: 'Warning', param: { severity: 'WARNING' } },
  { key: 'INFO', label: 'Info', param: { severity: 'INFO' } },
  { key: 'RESOLVED', label: 'Resolved', param: { status: 'RESOLVED' } },
];

const CATEGORY_TABS = [
  { key: 'ALL', label: 'All categories' },
  { key: 'INVENTORY', label: 'Inventory' },
  { key: 'ORDERS', label: 'Orders' },
  { key: 'REFUNDS', label: 'Refunds' },
  { key: 'PRODUCTS', label: 'Products' },
  { key: 'SALES', label: 'Sales' },
];

export default function AlertFilters({ facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const severity = searchParams.get('severity') || 'ALL';
  const status = searchParams.get('status') || 'ACTIVE';
  const category = searchParams.get('category') || 'ALL';

  function apply(next) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === 'ALL') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeStatusKey =
    status === 'RESOLVED' ? 'RESOLVED' : severity !== 'ALL' ? severity : 'ALL_ACTIVE';

  return (
    <div className="d-flex flex-column gap-2 mb-3">
      <div className="sp-tabs" role="tablist" aria-label="Filter alerts by severity">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.key === 'RESOLVED'
              ? facets.resolved
              : tab.key === 'ALL_ACTIVE'
                ? facets.active
                : facets.severity[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeStatusKey === tab.key}
              className={`sp-tab${activeStatusKey === tab.key ? ' active' : ''}`}
              onClick={() => apply({ severity: tab.param.severity ?? null, status: tab.param.status ?? null })}
            >
              {tab.label}
              <span className="sp-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="sp-tabs" aria-label="Filter alerts by category">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`sp-tab${category === tab.key ? ' active' : ''}`}
            onClick={() => apply({ category: tab.key })}
          >
            {tab.label}
            {tab.key !== 'ALL' && <span className="sp-tab-count">{facets.category[tab.key] ?? 0}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
