import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlertSettings } from '@/lib/alerts/scan';
import { getPreferences } from '@/lib/notifications/dispatch';
import { PLANS, BILLING_ENABLED, planFor } from '@/lib/billing';
import AlertSettingsForm from '@/components/settings/AlertSettingsForm';
import { PageHeader, Card, Section } from '@/components/ui/Primitives';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const [settings, preferences] = await Promise.all([getAlertSettings(store), getPreferences(store)]);
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
          }}
        />
      </Section>

      <Section title="Plan" sub={BILLING_ENABLED ? 'Your current subscription.' : 'Billing is not enabled yet — every feature is available.'}>
        <div className="row g-3">
          {Object.values(PLANS).map((plan) => (
            <div className="col-12 col-md-6 col-xl-3" key={plan.id}>
              <div
                className="sp-card sp-card-pad h-100"
                style={plan.id === currentPlan.id ? { borderColor: 'var(--sp-brand)' } : undefined}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <strong>{plan.name}</strong>
                  {plan.id === currentPlan.id && <span className="sp-pill info">Current</span>}
                </div>
                <div className="sp-metric-value" style={{ fontSize: 22 }}>
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  {plan.price > 0 && <span className="sp-card-sub"> /month</span>}
                </div>
                <ul className="sp-card-sub mt-2 mb-0" style={{ paddingLeft: 18 }}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        {!BILLING_ENABLED && (
          <div className="sp-help mt-2">
            Plan selection is intentionally inactive in this version — no charge is ever created.
          </div>
        )}
      </Section>
    </div>
  );
}
