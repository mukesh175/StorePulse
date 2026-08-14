import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeCron, forEachActiveStore } from '@/lib/cron';
import { refreshMetrics } from '@/lib/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Hourly: recompute today's and yesterday's metrics from stored orders. */
export async function GET(request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const results = await forEachActiveStore(prisma, async (store) => {
    const metrics = await refreshMetrics(store, { days: 2 });
    return { days: metrics.length };
  });

  return NextResponse.json({ ok: true, stores: results.length, results });
}
