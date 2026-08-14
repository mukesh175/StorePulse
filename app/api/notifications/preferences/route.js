import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { getPreferences } from '@/lib/notifications/dispatch';
import { withStore, validate } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withStore(async () => {
  const store = await requireStore();
  const preferences = await getPreferences(store);
  return NextResponse.json({ preferences });
});

export const PUT = withStore(async (request) => {
  const store = await requireStore();
  const body = await request.json().catch(() => ({}));
  const current = await getPreferences(store);

  const preferences = await prisma.notificationPreference.update({
    where: { shopId: store.id },
    data: {
      notifyEmail: validate.email(body.notifyEmail) ?? current.notifyEmail,
      emailEnabled: validate.bool(body.emailEnabled, current.emailEnabled),
      dailyDigestEnabled: validate.bool(body.dailyDigestEnabled, current.dailyDigestEnabled),
      weeklySummaryEnabled: validate.bool(body.weeklySummaryEnabled, current.weeklySummaryEnabled),
      instantAlertsEnabled: validate.bool(body.instantAlertsEnabled, current.instantAlertsEnabled),
      criticalAlertsOnly: validate.bool(body.criticalAlertsOnly, current.criticalAlertsOnly),
      browserNotificationsEnabled: validate.bool(
        body.browserNotificationsEnabled,
        current.browserNotificationsEnabled
      ),
      digestHour: validate.int(body.digestHour, { min: 0, max: 23, fallback: current.digestHour }),
    },
  });

  return NextResponse.json({ preferences });
});
