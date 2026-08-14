import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Marks onboarding complete so the merchant lands on the dashboard next time. */
export const POST = withStore(async () => {
  const store = await requireStore();
  await prisma.store.update({ where: { id: store.id }, data: { onboardedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
