import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/auth" className="kc-link text-sm">← Back to login</Link>

        <div className="mt-6 flex items-center gap-3">
          <img src="/k-logo.png" alt="KaushalChakra" className="w-10 h-10 rounded-xl bg-white border border-line p-1 shadow-sm" />
          <div>
            <h1 className="kc-display text-3xl font-bold text-ink">Terms &amp; Conditions</h1>
            <p className="text-muted text-sm">KaushalChakra — Skill Bartering Platform</p>
          </div>
        </div>

        <div className="kc-card p-6 sm:p-8 mt-6 space-y-7 text-sm leading-6 text-ink">
          <p className="text-muted text-xs uppercase tracking-wide">Effective Date: September 9, 2026</p>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">1. Acceptance</h2>
            <p className="text-muted mt-2">
              By creating an account and ticking the consent checkbox, you agree to these Terms, our Privacy Policy, and the community guidelines. If you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">2. Accounts &amp; Eligibility</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>You must provide a valid name, email and password (6–72 characters).</li>
              <li>You are responsible for keeping your credentials confidential.</li>
              <li>One account per person. Deactivated accounts (due to reports) cannot create new accounts to bypass enforcement.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">3. Skill Exchange &amp; Matching</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>Skills are from a fixed taxonomy — no free-text skills to keep matching precise.</li>
              <li>The engine builds 2–5 person cycles. Shorter cycles and better level/availability fit are preferred.</li>
              <li>One active cycle per user. Rejecting a proposal permanently blocks that directed edge.</li>
              <li>Contact details are revealed only after all participants accept (status → confirmed).</li>
              <li>Marking a cycle complete requires every participant to confirm; ratings are allowed only after completion and only between directly connected partners.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">4. Credits &amp; Tasks</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>Teach a one-off lesson and both sides mark complete → teacher earns +1 credit.</li>
              <li>Redeeming a lesson reserves –1 credit immediately; it is refunded if the teacher declines.</li>
              <li>Tasks have a poster-set credit value. On completion, credits move from poster to helper (both must mark complete). Insufficient poster balance will block completion.</li>
              <li>Credits have no monetary value and are non-transferable outside the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">5. Verification</h2>
            <p className="text-muted mt-2">
              Claiming <span className="font-medium text-ink">INTERMEDIATE</span> requires a passed quiz for that skill; <span className="font-medium text-ink">EXPERT</span> requires a verified certificate (admin-reviewed). Misrepresentation may lead to removal of the claimed level or account action.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">6. Conduct &amp; Reporting</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted">
              <li>Be respectful in chats, tasks and exchanges. No harassment, spam or fraudulent certificates.</li>
              <li>Any user can report another user, task or chat. Admins may warn, freeze credits, or deactivate accounts.</li>
              <li>Frozen credits block teach/redeem and new tasks until lifted by an admin.</li>
            </ul>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">7. Availability &amp; Content</h2>
            <p className="text-muted mt-2">
              Availability slots are optional and used only as a matching tie-breaker. Chat messages are limited to 1000 characters and are scoped to participants of a cycle.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">8. Termination</h2>
            <p className="text-muted mt-2">
              You may stop using the platform at any time. We may suspend or terminate accounts that violate these Terms, with or without prior notice for serious violations.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">9. Disclaimer &amp; Liability</h2>
            <p className="text-muted mt-2">
              Skill quality is community-provided and not guaranteed. KaushalChakra is provided “as is” without warranties. To the extent permitted by law, our liability is limited to the extent of credits in your ledger.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">10. Governing Law</h2>
            <p className="text-muted mt-2">
              These Terms are governed by the laws of India. Disputes are subject to the jurisdiction of courts at the platform operator’s location.
            </p>
          </section>

          <section>
            <h2 className="kc-display text-lg font-bold text-ink">11. Changes</h2>
            <p className="text-muted mt-2">
              We may update these Terms. Material changes will be notified via in-app notification. Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <div className="border-t border-line pt-4 flex flex-wrap gap-3 text-xs">
            <Link to="/privacy" className="kc-link">Privacy Policy</Link>
            <span className="text-line">•</span>
            <Link to="/auth" className="kc-link">Back to login</Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted/60 mt-6">© {new Date().getFullYear()} KaushalChakra · All rights reserved</p>
      </div>
    </div>
  );
}
