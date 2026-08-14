import { NextResponse } from 'next/server';
import { seedDemoStore, DEMO_SHOP_DOMAIN } from '@/lib/demo';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/shopify/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Creates the demo store and signs the browser into it. Only available when
 * DEMO_MODE=true, so production installs can never reach it.
 */
export async function POST() {
  if (!env.demoMode) {
    return NextResponse.json({ error: 'Demo mode is disabled' }, { status: 403 });
  }

  try {
    const result = await seedDemoStore({ reset: true });
    const response = NextResponse.json({
      ok: true,
      shop: DEMO_SHOP_DOMAIN,
      products: result.products,
      variants: result.variants,
      scan: result.scan,
    });
    response.cookies.set(SESSION_COOKIE, signSession(DEMO_SHOP_DOMAIN), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error('[storepulse] demo seed failed', error);
    return NextResponse.json({ error: 'Could not create the demo store. Is DATABASE_URL set?' }, { status: 500 });
  }
}
