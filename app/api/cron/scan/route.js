import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeCron, forEachActiveStore } from '@/lib/cron';
import { runAlertScan } from '@/lib/alerts/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Every 30 minutes: run the time-based rules. Webhooks cover instant changes;
 * this catches conditions that only emerge with the passage of time (delayed
 * orders, refund spikes, sales trends).
 */
export async function GET(request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const results = await forEachActiveStore(prisma, async (store) => runAlertScan(store, { notify: true }));

  return NextResponse.json({ ok: true, stores: results.length, results });
}
