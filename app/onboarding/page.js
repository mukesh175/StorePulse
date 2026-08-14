import { redirect } from 'next/navigation';
import { getCurrentStore } from '@/lib/shopify/session';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import AppBridgeScript from '@/components/AppBridgeScript';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 16px' }}>
      <AppBridgeScript />
      <OnboardingFlow
        store={{
          shopName: store.shopName || store.shopDomain,
          shopDomain: store.shopDomain,
          email: store.email,
          isDemo: store.isDemo,
        }}
      />
    </div>
  );
}
