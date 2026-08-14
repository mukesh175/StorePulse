import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeCron, forEachActiveStore } from '@/lib/cron';
import { buildDailyBrief } from '@/lib/brief';
import { refreshMetrics } from '@/lib/metrics';
import { dispatchDailyDigest, getPreferences } from '@/lib/notifications/dispatch';
import { localHourInTimezone } from '@/lib/utils/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs hourly and sends to the stores whose *local* time has just reached
 * their configured digest hour, so every merchant gets the brief in the
 * morning regardless of timezone. Send-once is guaranteed by the
 * NotificationLog dedupe key (`digest:<local date>`).
 */
export async function GET(request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const force = new URL(request.url).searchParams.get('force') === 'true';

  const results = await forEachActiveStore(prisma, async (store) => {
    const prefs = await getPreferences(store);
    const localHour = localHourInTimezone(store.timezone);

    if (!force && localHour !== prefs.digestHour) {
      return { skipped: true, localHour, digestHour: prefs.digestHour };
    }

    await refreshMetrics(store, { days: 2 });
    const brief = await buildDailyBrief(store);
    const result = await dispatchDailyDigest(store, brief);

    return {
      sent: Boolean(result.ok),
      skipped: Boolean(result.skipped),
      reason: result.reason ?? result.error ?? null,
      critical: brief.counts.critical,
      warnings: brief.counts.warning,
    };
  });

  return NextResponse.json({ ok: true, stores: results.length, results });
}
