import { NextResponse } from 'next/server';
import { requireStore } from '@/lib/shopify/session';
import { getAlert, applyAlertAction, isValidAction } from '@/lib/alerts/queries';
import { withStore, badRequest, validate } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withStore(async (_request, { params }) => {
  const store = await requireStore();
  const { id } = await params;

  const alert = await getAlert(store.id, id);
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  return NextResponse.json({ alert });
});

export const PATCH = withStore(async (request, { params }) => {
  const store = await requireStore();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!isValidAction(body.action)) {
    return badRequest('action must be one of: resolve, dismiss, acknowledge, snooze, reopen');
  }

  const hours = validate.int(body.hours, { min: 1, max: 24 * 14, fallback: 24 });
  const alert = await applyAlertAction(store.id, id, body.action, { hours });

  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  return NextResponse.json({ alert });
});
