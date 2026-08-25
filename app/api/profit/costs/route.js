import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStore } from '@/lib/shopify/session';
import { getCostSettings } from '@/lib/profit/costs';
import { withStore } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clamp to a sane range and round to 2dp; never let a stray value poison the model. */
function money(value, fallback, { max = 1_000_000 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(Math.min(n, max).toFixed(2));
}

function percent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(Math.min(n, 100).toFixed(2));
}

export const GET = withStore(async () => {
  const store = await requireStore();
  const costSettings = await getCostSettings(store);
  return NextResponse.json({ costSettings });
});

export const PUT = withStore(async (request) => {
  const store = await requireStore();
  const body = await request.json().catch(() => ({}));
  const current = await getCostSettings(store);

  const costSettings = await prisma.costSetting.update({
    where: { shopId: store.id },
    data: {
      shippingCostPerOrder: money(body.shippingCostPerOrder, Number(current.shippingCostPerOrder)),
      paymentFeePercent: percent(body.paymentFeePercent, Number(current.paymentFeePercent)),
      codRtoPercent: percent(body.codRtoPercent, Number(current.codRtoPercent)),
      codRtoCostPerOrder: money(body.codRtoCostPerOrder, Number(current.codRtoCostPerOrder)),
      monthlyAdSpend: money(body.monthlyAdSpend, Number(current.monthlyAdSpend)),
      freeShippingThreshold: money(body.freeShippingThreshold, Number(current.freeShippingThreshold)),
    },
  });

  return NextResponse.json({ costSettings });
});
