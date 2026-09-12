import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/auth" className="kc-link text-sm">← Back to login</Link>

        <div className="mt-6 flex items-center gap-3">
          <img src="/k-logo.png" alt="KaushalChakra" className="w-10 h-10 rounded-xl bg-white border border-line p-1 shadow-sm" />
          <div>
            <h1 className="kc-display text-3xl font-bold text-ink">Privacy Policy</h1>
            <p className="text-muted text-sm">KaushalChakra — Trade skills, not money</p>
          </div>
        </div>

        <div className="kc-card p-6 sm:p-8 mt-6 space-y-7 text-sm leading-6 text-ink">
          <div>
            <p className="text-muted text-xs uppercase tracking-wide">Effective Date: September 9, 2026</p>
            <p className="mt-3">
              KaushalChakra respects your privacy and complies with India&apos;s <span className="font-semibold">Digital Personal Data Protection Act, 2023 (DPDP Act)</span>.
              This policy explains what we collect, why we collect it, and your rights.
            </p>
          </div>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">1. Information We Collect</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li><span className="text-ink font-medium">Profile Information</span> — name, email, department, password hash. Used to create and secure your account and to display your identity to matched partners after confirmation.</li>
              <li><span className="text-ink font-medium">Skill Claims</span> — offered and wanted skills with levels (BEGINNER/INTERMEDIATE/EXPERT). Used to run the cyclic matching engine.</li>
              <li><span className="text-ink font-medium">Availability Slots</span> — e.g. WEEKDAY_EVENING. Used only as a tie-breaker to prefer cycles where neighbours share a slot.</li>
              <li><span className="text-ink font-medium">Verification Data</span> — quiz attempts and certificate issuer/verification ID. Only a boolean <span className="font-mono text-xs bg-parchment px-1.5 py-0.5 rounded">verified</span> badge is shown to others; raw IDs are never public.</li>
              <li><span className="text-ink font-medium">Exchange Data</span> — match cycles, participants, chat messages (scoped to confirmed cycles), ratings and task descriptions.</li>
              <li><span className="text-ink font-medium">Consent Timestamp</span> — <span className="font-mono text-xs">consentGivenAt</span> records when you consented.</li>
              <li><span className="text-ink font-medium">Credits &amp; Tasks</span> — ledger entries and task credit values.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">2. How We Use Your Data</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>To build and run the cyclic matching engine (2–5 person cycles).</li>
              <li>To manage exchange lifecycle: propose → confirm → complete, plus chat and notifications.</li>
              <li>To operate credits, tasks, verification and reporting.</li>
              <li>To keep the platform safe and to enforce community guidelines.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">3. Sharing</h2>
            <p className="text-muted mt-2">
              We do not sell your data. Contact details (email) are hidden while a cycle is <span className="font-medium text-ink">proposed</span> and revealed only after it becomes <span className="font-medium text-ink">confirmed</span> to participants. Certificate IDs and quiz answers are never shared with other users — only admins can review pending certificates.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">4. Your Rights (DPDP Act, 2023)</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>Access, correction and deletion of your personal data.</li>
              <li>Withdraw consent — withdrawing will deactivate your account and stop matching.</li>
              <li>Grievance redressal via the administrator.</li>
            </ul>
            <p className="text-muted mt-2">
              To exercise these rights, contact the administrator via the in-app support channel or email the admin account.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">5. Data Retention</h2>
            <p className="text-muted mt-2">
              Data is retained while your account is active and for a limited period after deactivation to resolve disputes, enforce credits, and comply with law. Deactivated accounts are excluded from matching and cannot use credits/tasks.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">6. Security</h2>
            <p className="text-muted mt-2">
              Passwords are hashed with bcrypt, sessions use httpOnly cookies (SameSite=Lax) and JWTs, and rate-limits protect auth and matching endpoints. No system is 100% secure — report vulnerabilities to the admin.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">7. Contact</h2>
            <p className="text-muted mt-2">
              For privacy queries, contact the KaushalChakra administrator via the in-app support channel. Effective date will be updated when this policy changes.
            </p>
          </section>

          <div className="border-t border-line pt-4 flex flex-wrap gap-3 text-xs">
            <Link to="/terms" className="kc-link">Terms &amp; Conditions</Link>
            <span className="text-line">•</span>
            <Link to="/auth" className="kc-link">Back to login</Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted/60 mt-6">© {new Date().getFullYear()} KaushalChakra · All rights reserved</p>
      </div>
    </div>
  );
}
