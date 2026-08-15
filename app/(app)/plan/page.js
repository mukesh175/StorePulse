import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import { PLANS, PLAN_ORDER, planFor, historyWindowDays, hasFeature, FEATURES, BILLING_ENABLED } from '@/lib/billing';
import PlanSelector from '@/components/billing/PlanSelector';
import { PageHeader, Card, Section } from '@/components/ui/Primitives';
import { formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const ENTITLEMENTS = [
  { key: FEATURES.INSTANT_EMAIL, label: 'Instant critical alert emails', note: 'Emailed the moment a critical issue is detected' },
  { key: FEATURES.WEEKLY_SUMMARY, label: 'Weekly summary email', note: 'Monday report of the week just gone' },
  { key: FEATURES.ADVANCED_ALERTS, label: 'Advanced alerts', note: 'Sales drops and refund spike analysis' },
  { key: FEATURES.PRODUCT_HEALTH, label: 'Product health alerts', note: 'Per-product sales drops and demand spikes' },
  { key: FEATURES.TEAM_NOTIFICATIONS, label: 'Team notifications', note: 'Additional notification recipients' },
];

export default async function PlanPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const plan = planFor(store);
  const historyDays = historyWindowDays(store);

  return (
    <div className="sp-fade-in" style={{ maxWidth: 1100 }}>
      <PageHeader
        title="Plan"
        subtitle={`You are on the ${plan.name} plan. Alerts that need more history than your plan allows are simply not generated — nothing is hidden behind a paywall inside the app.`}
      />

      {params?.billing === 'active' && (
        <div className="sp-banner success mb-3">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Your plan is active.</strong>
            <div className="mt-1">The features below are available immediately.</div>
          </div>
        </div>
      )}
      {params?.billing === 'declined' && (
        <div className="sp-banner warning mb-3">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>The charge was not approved.</strong>
            <div className="mt-1">You are still on the {plan.name} plan. You can try again at any time.</div>
          </div>
        </div>
      )}

      <Section title="Choose a plan">
        <PlanSelector plans={PLANS} planOrder={PLAN_ORDER} currentPlan={store.plan} isDemo={store.isDemo} />
      </Section>

      <Section title="What your plan includes" sub="Exactly what is active for this store right now.">
        <Card>
          <div className="sp-kv">
            <span className="sp-kv-label">Reporting history</span>
            <span className="sp-kv-value">{historyDays} days</span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Daily digest</span>
            <span className="sp-kv-value" style={{ color: 'var(--sp-success)' }}>
              Included on every plan
            </span>
          </div>
          <div className="sp-kv">
            <span className="sp-kv-label">Inventory &amp; order alerts</span>
            <span className="sp-kv-value" style={{ color: 'var(--sp-success)' }}>
              Included on every plan
            </span>
          </div>

          {ENTITLEMENTS.map((entitlement) => {
            const enabled = hasFeature(store, entitlement.key);
            return (
              <div className="sp-kv" key={entitlement.key}>
                <span className="sp-kv-label">
                  {entitlement.label}
                  <div className="sp-help">{entitlement.note}</div>
                </span>
                <span
                  className="sp-kv-value"
                  style={{ color: enabled ? 'var(--sp-success)' : 'var(--sp-muted)' }}
                >
                  {enabled ? 'Active' : 'Not on your plan'}
                </span>
              </div>
            );
          })}

          {store.planActivatedAt && (
            <div className="sp-kv">
              <span className="sp-kv-label">Subscribed since</span>
              <span className="sp-kv-value">{formatDate(store.planActivatedAt, { dateStyle: 'medium' })}</span>
            </div>
          )}
        </Card>

        {!BILLING_ENABLED && (
          <div className="sp-help mt-2">
            Entitlement enforcement is currently disabled (BILLING_ENABLED=false), so every feature is active
            regardless of plan.
          </div>
        )}
      </Section>
    </div>
  );
}
