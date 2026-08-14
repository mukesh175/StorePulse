import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/lib/env';
import {
  normalizeShopDomain,
  verifyOAuthHmac,
  exchangeCodeForToken,
  signSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/shopify/auth';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { syncShopProfile } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shopDomain = normalizeShopDomain(searchParams.get('shop'));
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!shopDomain || !code || !state) {
    return NextResponse.json({ error: 'Malformed OAuth callback' }, { status: 400 });
  }

  if (!verifyOAuthHmac(searchParams)) {
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
  }

  // The state must exist, be unused, and belong to this shop.
  const stateRow = await prisma.oAuthState.findUnique({ where: { state } });
  if (!stateRow || stateRow.shopDomain !== shopDomain) {
    return NextResponse.json({ error: 'Invalid or expired OAuth state' }, { status: 401 });
  }
  await prisma.oAuthState.delete({ where: { id: stateRow.id } });

  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForToken(shopDomain, code);
  } catch (error) {
    console.error('[storepulse] token exchange failed', error);
    return NextResponse.json({ error: 'Could not complete installation with Shopify.' }, { status: 502 });
  }

  const store = await prisma.store.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      accessToken: tokenResponse.access_token,
      installedAt: new Date(),
    },
    update: {
      accessToken: tokenResponse.access_token,
      uninstalledAt: null,
      installedAt: new Date(),
      lastSyncError: null,
    },
  });

  // Defaults so every page has settings to read from the first render.
  await prisma.alertSetting.upsert({ where: { shopId: store.id }, create: { shopId: store.id }, update: {} });
  await prisma.notificationPreference.upsert({
    where: { shopId: store.id },
    create: { shopId: store.id },
    update: {},
  });

  // Shop profile is one cheap call and gives us currency/timezone immediately.
  let hydrated = store;
  try {
    hydrated = await syncShopProfile(store);
    await prisma.notificationPreference.updateMany({
      where: { shopId: store.id, notifyEmail: null },
      data: { notifyEmail: hydrated.email },
    });
  } catch (error) {
    console.error('[storepulse] shop profile sync failed', error);
  }

  try {
    await registerWebhooks(hydrated);
  } catch (error) {
    console.error('[storepulse] webhook registration failed', error);
  }

  const destination = hydrated.onboardedAt ? '/dashboard' : '/onboarding';
  const response = NextResponse.redirect(
    `${env.appUrl}${destination}?shop=${encodeURIComponent(shopDomain)}&host=${encodeURIComponent(
      searchParams.get('host') ?? ''
    )}`
  );
  response.cookies.set(SESSION_COOKIE, signSession(shopDomain), sessionCookieOptions);
  return response;
}
