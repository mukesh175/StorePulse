import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlertSettings } from '@/lib/alerts/scan';
import { getPreferences } from '@/lib/notifications/dispatch';
import { planFor, historyWindowDays } from '@/lib/billing';
import AlertSettingsForm from '@/components/settings/AlertSettingsForm';
import CostSettingsForm from '@/components/settings/CostSettingsForm';
import { getCostSettings } from '@/lib/profit/costs';
import { PageHeader, Card, Section } from '@/components/ui/Primitives';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const [settings, preferences, costSettings] = await Promise.all([
    getAlertSettings(store),
    getPreferences(store),
    getCostSettings(store),
  ]);
  const currentPlan = planFor(store);

  return (
    <div className="sp-fade-in" style={{ maxWidth: 940 }}>
      <PageHeader title="Settings" subtitle="Store details, alert thresholds and your plan." />

      <Section title="General">
        <Card>
          <div className="sp-kv">
            <span className="sp-kv-label">Store</span>
            <span className="sp-kv-value">{store.shopName || store.shopDomain}</span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Shopify domain</span>
            <span className="sp-kv-value">{store.shopDomain}</span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Timezone</span>
            <span className="sp-kv-value">{store.timezone}</span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Currency</span>
            <span className="sp-kv-value">{store.currency}</span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Daily digest time</span>
            <span className="sp-kv-value">
              {String(preferences.digestHour).padStart(2, '0')}:00 ·{' '}
              <Link href="/notifications">change</Link>
            </span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Installed</span>
            <span className="sp-kv-value">{formatDate(store.installedAt, { dateStyle: 'medium' })}</span>
          </div>
          <div className="sp-help mt-2">
            Timezone and currency come from your Shopify store settings and update on every sync.
          </div>
        </Card>
      </Section>

      <Section title="Alert settings" sub="Tune what counts as a problem for your store.">
        <AlertSettingsForm
          initial={{
            lowStockThreshold: settings.lowStockThreshold,
            delayedOrderWarnHours: settings.delayedOrderWarnHours,
            delayedOrderCritHours: settings.delayedOrderCritHours,
            salesDropPercent: settings.salesDropPercent,
            refundSpikePercent: settings.refundSpikePercent,
            inventoryAlertsEnabled: settings.inventoryAlertsEnabled,
            orderAlertsEnabled: settings.orderAlertsEnabled,
            refundAlertsEnabled: settings.refundAlertsEnabled,
            salesAlertsEnabled: settings.salesAlertsEnabled,
            productAlertsEnabled: settings.productAlertsEnabled,
            profitAlertsEnabled: settings.profitAlertsEnabled,
          }}
        />
      </Section>

      <Section
        title="Profit assumptions"
        sub="Used by the profit leak report for the costs Shopify does not know."
      >
        <CostSettingsForm
          currency={store.currency}
          initial={{
            shippingCostPerOrder: Number(costSettings.shippingCostPerOrder),
            paymentFeePercent: Number(costSettings.paymentFeePercent),
            codRtoPercent: Number(costSettings.codRtoPercent),
            codRtoCostPerOrder: Number(costSettings.codRtoCostPerOrder),
            monthlyAdSpend: Number(costSettings.monthlyAdSpend),
            freeShippingThreshold: Number(costSettings.freeShippingThreshold),
          }}
        />
      </Section>

      <Section title="Plan" sub="Your subscription and what it unlocks.">
        <Card>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <strong style={{ fontSize: 16 }}>{currentPlan.name}</strong>
                <span className="sp-pill info">Current plan</span>
              </div>
              <div className="sp-card-sub mt-1">
                {currentPlan.price === 0 ? 'No charge' : `$${currentPlan.price} per month`} ·{' '}
                {historyWindowDays(store)} days of reporting history
              </div>
            </div>
            <Link href="/plan" className="sp-btn sp-btn-primary">
              {currentPlan.id === 'PRO' ? 'Manage plan' : 'Compare & upgrade'}
            </Link>
          </div>
        </Card>
      </Section>
    </div>
  );
}
