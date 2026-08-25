import { findLeaks } from '@/lib/profit/leaks';
import { getCostCoverage } from '@/lib/profit/costs';
import { productAdminUrl, adminUrl } from '@/lib/shopify/urls';
import { formatMoney } from '@/lib/utils/format';

export const PROFIT_ALERT_TYPES = ['PROFIT_LEAK'];

// Below this there is not enough money involved to be worth an alert.
const MIN_MONTHLY_IMPACT = 500;

const SEVERITY_BY_KIND = {
  UNPROFITABLE_PRODUCT: 'CRITICAL',
  HIGH_RETURN_PRODUCT: 'WARNING',
  EXPENSIVE_DISCOUNT: 'WARNING',
  EXPENSIVE_SHIPPING_ZONE: 'WARNING',
  REPEAT_REFUNDERS: 'WARNING',
  COD_RTO_EXPOSURE: 'WARNING',
  LOW_MARGIN_PRODUCT: 'INFO',
};

/**
 * Surface the largest profit leaks as alerts so they appear in the daily brief
 * rather than only when the merchant visits the profit page.
 *
 * Requires cost data: without it, margin is unknown and an alert claiming a
 * product loses money would be a guess.
 */
export async function evaluateProfitLeaks(store) {
  const coverage = await getCostCoverage(store);
  if (coverage.withCost === 0) return [];

  const { leaks } = await findLeaks(store, { days: 30 });

  return leaks
    .filter((leak) => leak.impact >= MIN_MONTHLY_IMPACT && SEVERITY_BY_KIND[leak.kind])
    .slice(0, 5)
    .map((leak) => ({
      type: 'PROFIT_LEAK',
      category: 'SALES',
      severity: SEVERITY_BY_KIND[leak.kind],
      title: leak.title,
      message: leak.detail,
      resourceType: 'PROFIT',
      resourceId: leak.id,
      scope: leak.kind,
      resourceUrl:
        leak.kind.includes('PRODUCT') && leak.resourceId
          ? productAdminUrl(store.shopDomain, leak.resourceId)
          : adminUrl(store.shopDomain, '/analytics'),
      whyItMatters: `Left unchanged this is worth about ${formatMoney(leak.impact, store.currency)} a month.${
        leak.basis === 'ESTIMATED' ? ' This figure uses the cost assumptions in your settings.' : ''
      }`,
      recommendedAction: leak.action,
      valueAtRisk: Number(leak.impact.toFixed(2)),
      metadata: {
        kind: leak.kind,
        basis: leak.basis,
        monthlyImpact: Number(leak.impact.toFixed(2)),
        coveragePercent: Number(coverage.percent.toFixed(1)),
      },
    }));
}
