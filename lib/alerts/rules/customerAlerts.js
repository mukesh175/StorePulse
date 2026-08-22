import { getSegments } from '@/lib/segments';
import { adminUrl } from '@/lib/shopify/urls';
import { formatMoney } from '@/lib/utils/format';

export const CUSTOMER_ALERT_TYPES = ['CUSTOMER_VIP_AT_RISK', 'CUSTOMER_CHURN_SPIKE'];

// Small stores produce noisy segments; require a real base before alerting.
const MIN_CUSTOMERS = 20;
const MIN_AT_RISK = 3;

/**
 * Customer health. Reports on segments the merchant should act on — the
 * recommended action is always something they do in Shopify, never a message
 * StorePulse sends.
 */
export async function evaluateCustomerHealth(store) {
  const { totalCustomers, segments } = await getSegments(store, { days: 365 });
  if (totalCustomers < MIN_CUSTOMERS) return [];

  const definitions = [];
  const bySegment = Object.fromEntries(segments.map((s) => [s.id, s]));

  const atRisk = bySegment.AT_RISK;
  if (atRisk && atRisk.count >= MIN_AT_RISK) {
    definitions.push({
      type: 'CUSTOMER_VIP_AT_RISK',
      category: 'SALES',
      severity: atRisk.value > 0 ? 'WARNING' : 'INFO',
      title: 'Repeat customers are drifting away',
      message: `${atRisk.count} customers who used to order regularly haven't purchased in 60 days.`,
      resourceType: 'SEGMENT',
      resourceId: 'AT_RISK',
      resourceUrl: adminUrl(store.shopDomain, '/customers'),
      whyItMatters: `These customers are worth ${formatMoney(atRisk.value, store.currency)} in lifetime value — an average of ${formatMoney(
        atRisk.averageValue,
        store.currency
      )} each. Winning back a past buyer costs far less than acquiring a new one.`,
      recommendedAction:
        'Review this segment in StorePulse, then reach out through your own email or marketing tool.',
      valueAtRisk: Number(atRisk.value.toFixed(2)),
      metadata: {
        segment: 'AT_RISK',
        customers: atRisk.count,
        lifetimeValue: Number(atRisk.value.toFixed(2)),
        averageValue: Number(atRisk.averageValue.toFixed(2)),
      },
    });
  }

  const lost = bySegment.LOST;
  if (lost && lost.count >= MIN_AT_RISK && lost.value > 0) {
    definitions.push({
      type: 'CUSTOMER_CHURN_SPIKE',
      category: 'SALES',
      severity: 'INFO',
      title: 'Valuable customers have stopped ordering',
      message: `${lost.count} previously valuable customers have not ordered in 120 days.`,
      resourceType: 'SEGMENT',
      resourceId: 'LOST',
      resourceUrl: adminUrl(store.shopDomain, '/customers'),
      whyItMatters: `${formatMoney(lost.value, store.currency)} of lifetime value sits in customers who have gone quiet.`,
      recommendedAction:
        'Check whether these customers bought a product that has since sold out or changed price.',
      valueAtRisk: Number(lost.value.toFixed(2)),
      metadata: {
        segment: 'LOST',
        customers: lost.count,
        lifetimeValue: Number(lost.value.toFixed(2)),
      },
    });
  }

  return definitions;
}
