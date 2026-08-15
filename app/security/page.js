import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata = {
  title: 'Security & incident response — StorePulse',
  description: 'Security measures and the incident response process StorePulse follows.',
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security & incident response"
      intro="The technical measures StorePulse applies, and the process followed if a security incident occurs."
    >
      <LegalSection title="Authentication and secrets">
        <ul>
          <li>Shopify OAuth with HMAC signature verification and single-use, server-stored state values.</li>
          <li>
            The Shopify access token is stored server-side only. It is never sent to the browser, never placed in a
            URL, and is destroyed when the app is uninstalled.
          </li>
          <li>Sessions use signed, HTTP-only, Secure cookies. The authenticated shop is derived from that signature, never from a client-supplied parameter.</li>
          <li>Every webhook is HMAC-verified before any processing occurs; unverified requests are rejected.</li>
          <li>Scheduled jobs require a bearer secret; there are no publicly executable endpoints.</li>
          <li>All secrets are held in environment variables and are never committed to source control.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Data protection">
        <ul>
          <li>TLS for all connections to Shopify, the database and the email provider.</li>
          <li>Encryption at rest for the database and its backups, provided by Neon.</li>
          <li>Point-in-time recovery for the database.</li>
          <li>Data minimisation: only two protected customer fields are read, and only read-only Shopify scopes are requested.</li>
          <li>Test and production data are separated; demo data is synthetic and flagged distinctly.</li>
          <li>All reads of customer name or email are recorded in an access log.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Access control">
        <p>
          Access to production systems is limited to the app developer, protected by two-factor authentication on
          the Shopify Partner, Vercel and Neon accounts. Credentials are not shared, and access is reviewed when
          anyone joins or leaves.
        </p>
      </LegalSection>

      <LegalSection title="Incident response process">
        <p>If a security incident affecting personal data is suspected, the following steps are taken:</p>
        <ol>
          <li>
            <strong>Detect and triage</strong> — assess scope, what data is involved and whether it is ongoing.
          </li>
          <li>
            <strong>Contain</strong> — within 24 hours: rotate the affected credentials (Shopify API secret,
            session secret, database credentials, email API key), and revoke sessions if needed.
          </li>
          <li>
            <strong>Assess</strong> — use webhook records and the data access log to establish which stores and
            which records were affected.
          </li>
          <li>
            <strong>Notify</strong> — inform affected merchants without undue delay, and Shopify Partner support,
            within 72 hours of becoming aware. Notification states what happened, what data was involved, what has
            been done, and what the merchant should do.
          </li>
          <li>
            <strong>Remediate and review</strong> — fix the root cause, then record the incident, timeline and
            corrective actions.
          </li>
        </ol>
        <p>
          Suspected vulnerabilities can be reported through the support address on the app listing. Reports are
          acknowledged within three business days.
        </p>
      </LegalSection>

      <LegalSection title="Known limitations">
        <p>
          Stated plainly rather than omitted: StorePulse has not undergone a third-party security audit and holds
          no SOC 2 or ISO 27001 certification. It is operated by a small team, and the measures above are those
          appropriate to that scale.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
