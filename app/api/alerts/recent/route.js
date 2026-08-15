import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight poll target for browser notifications: the newest open alerts,
 * with only the fields a notification needs.
 */
export const GET = withStore(async (request) => {
  const store = await requireStore();
  const { searchParams } = new URL(request.url);

  const since = searchParams.get('since');
  const sinceDate = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;

  const alerts = await prisma.alert.findMany({
    where: {
      shopId: store.id,
      status: 'OPEN',
      severity: { in: ['CRITICAL', 'WARNING'] },
      ...(sinceDate ? { firstDetectedAt: { gt: sinceDate } } : {}),
    },
    orderBy: { firstDetectedAt: 'desc' },
    take: 5,
    select: { id: true, title: true, message: true, severity: true, firstDetectedAt: true },
  });

  return NextResponse.json({ alerts, now: new Date().toISOString() });
});
