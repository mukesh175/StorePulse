import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { buildDailyBrief } from '@/lib/brief';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Machine-readable version of the daily brief (used by onboarding). */
export const GET = withStore(async () => {
  const store = await requireStore();
  const brief = await buildDailyBrief(store);

  return NextResponse.json({
    health: brief.health,
    counts: brief.counts,
    metrics: brief.metrics,
    series: brief.series,
  });
});
