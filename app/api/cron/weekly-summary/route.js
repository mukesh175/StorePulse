import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeCron, forEachActiveStore } from '@/lib/cron';
import { buildWeeklySummary } from '@/lib/reports';
import { dispatchWeeklySummary } from '@/lib/notifications/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Mondays: send the weekly store report. */
export async function GET(request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const results = await forEachActiveStore(prisma, async (store) => {
    const summary = await buildWeeklySummary(store);
    const result = await dispatchWeeklySummary(store, summary);
    return { sent: Boolean(result.ok), skipped: Boolean(result.skipped), reason: result.reason ?? result.error ?? null };
  });

  return NextResponse.json({ ok: true, stores: results.length, results });
}
