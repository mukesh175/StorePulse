import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata = {
  title: 'Terms & data processing — StorePulse',
  description: 'Terms of service and the data processing agreement between StorePulse and the merchant.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service & data processing agreement"
      intro="These terms govern a merchant's use of StorePulse. Part B is the data processing agreement that applies whenever StorePulse processes personal data on the merchant's behalf, and it takes effect automatically when the app is installed."
    >
      <LegalSection title="A1. The service">
        <p>
          StorePulse reads store data from the Shopify Admin API and generates alerts, metrics and email summaries
          for the merchant. It is a monitoring tool: it reports on the store and does not modify products, orders,
          inventory or customers. All Shopify permissions requested are read-only.
        </p>
      </LegalSection>

      <LegalSection title="A2. Acceptable use">
        <p>
          The merchant is responsible for keeping their Shopify and StorePulse credentials secure, and for the
          accuracy of the notification address they configure. The app must not be used to process data for a store
          the merchant does not control.
        </p>
      </LegalSection>

      <LegalSection title="A3. Availability and limits">
        <p>
          StorePulse depends on Shopify&apos;s APIs, scheduled jobs and third-party email delivery. Alerts are
          provided on a best-effort basis and are not guaranteed to be delivered or to be exhaustive. The merchant
          remains responsible for operating their store; StorePulse is decision support, not a substitute for the
          merchant&apos;s own checks.
        </p>
      </LegalSection>

      <LegalSection title="A4. Termination">
        <p>
          The merchant may uninstall at any time from the Shopify admin. On uninstall, processing stops immediately
          and stored data is deleted as described in the privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="B1. Roles">
        <p>
          The merchant is the <strong>controller</strong> of their customers&apos; personal data. StorePulse is a{' '}
          <strong>processor</strong> and processes personal data only on the merchant&apos;s documented
          instructions, which for these purposes are the app&apos;s configured features.
        </p>
      </LegalSection>

      <LegalSection title="B2. Scope of processing">
        <ul>
          <li>
            <strong>Categories of data subject:</strong> the merchant&apos;s customers who have placed orders.
          </li>
          <li>
            <strong>Categories of personal data:</strong> customer name and email address, associated with order
            totals and fulfillment status. No phone numbers, addresses or payment data.
          </li>
          <li>
            <strong>Purpose:</strong> generating store alerts, metrics and summaries for the merchant.
          </li>
          <li>
            <strong>Duration:</strong> for as long as the app is installed, then deleted per the privacy policy.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="B3. Our obligations">
        <ul>
          <li>Process personal data only for the purposes above, never for our own purposes.</li>
          <li>Apply the technical and organisational measures described on the security page.</li>
          <li>Ensure anyone with access is bound by confidentiality.</li>
          <li>Log access to personal data and retain those logs for audit.</li>
          <li>Assist the merchant in responding to data subject requests, via Shopify&apos;s privacy webhooks.</li>
          <li>Delete personal data on uninstall and on redaction requests.</li>
          <li>Notify the merchant without undue delay after becoming aware of a personal data breach.</li>
        </ul>
      </LegalSection>

      <LegalSection title="B4. Subprocessors">
        <p>
          StorePulse uses <strong>Neon</strong> (database hosting), <strong>Vercel</strong> (application hosting)
          and <strong>Resend</strong> (email delivery). Each is engaged under terms consistent with this agreement.
          Personal data is limited to what is described in B2 — Resend receives the merchant&apos;s own notification
          address, not customer data.
        </p>
      </LegalSection>

      <LegalSection title="B5. International transfers">
        <p>
          Data may be processed in the regions where the above providers operate. Transfers are made under the
          providers&apos; standard contractual clauses where applicable.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
