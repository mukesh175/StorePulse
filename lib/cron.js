import { NextResponse } from 'next/server';

/**
 * Cron endpoints must never be publicly executable. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set in the project.
 */
export function authorizeCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : new URL(request.url).searchParams.get('secret');

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function forEachActiveStore(prisma, handler) {
  const stores = await prisma.store.findMany({
    where: { uninstalledAt: null },
    include: { settings: true, preference: true },
  });

  const results = [];
  for (const store of stores) {
    try {
      results.push({ shop: store.shopDomain, ...(await handler(store)) });
    } catch (error) {
      console.error(`[storepulse] cron failed for ${store.shopDomain}`, error);
      results.push({ shop: store.shopDomain, error: error.message });
    }
  }
  return results;
}
