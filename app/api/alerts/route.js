import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { listAlerts, getAlertFacets } from '@/lib/alerts/queries';
import { withStore, validate } from '@/lib/api';
import { alertHistoryDays } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withStore(async (request) => {
  const store = await requireStore();
  const { searchParams } = new URL(request.url);
  const historyDays = alertHistoryDays(store);

  const result = await listAlerts(store.id, {
    severity: validate.oneOf(searchParams.get('severity'), ['CRITICAL', 'WARNING', 'INFO', 'SUCCESS'], 'ALL'),
    category: validate.oneOf(
      searchParams.get('category'),
      ['INVENTORY', 'ORDERS', 'REFUNDS', 'PRODUCTS', 'SALES', 'SYSTEM'],
      'ALL'
    ),
    status: validate.oneOf(
      searchParams.get('status'),
      ['ACTIVE', 'ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
      'ACTIVE'
    ),
    page: validate.int(searchParams.get('page'), { min: 1, max: 500, fallback: 1 }),
    pageSize: validate.int(searchParams.get('pageSize'), { min: 5, max: 50, fallback: 20 }),
    historyDays,
  });

  const facets = await getAlertFacets(store.id, { historyDays });
  return NextResponse.json({ ...result, facets });
});
