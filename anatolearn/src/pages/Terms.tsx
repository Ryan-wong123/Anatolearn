import { Link } from 'react-router-dom';
import LegalLayout from '../components/account/LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="Terms of use">
      <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        These terms are a starting point. The institution running AnatoLearn should review and adapt them before relying on them.
      </p>

      <section aria-labelledby="accept">
        <h2 id="accept">Using AnatoLearn</h2>
        <p>By creating an account or signing in you agree to these terms and to the <Link to="/privacy" className="text-blue-700 underline dark:text-blue-400">Privacy notice</Link>. AnatoLearn is provided for teaching and learning anatomy within your institution.</p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Your account</h2>
        <ul>
          <li>Give accurate registration details and keep your password private. Do not share your account.</li>
          <li>You are responsible for activity under your account. Tell the administrator straight away if you think it has been misused.</li>
          <li>Teacher accounts need an invite code from your institution. Do not use another person's code or account.</li>
          <li>Accounts may be disabled or removed if these terms are broken or the account is no longer needed.</li>
        </ul>
      </section>

      <section aria-labelledby="conduct">
        <h2 id="conduct">Acceptable use</h2>
        <ul>
          <li>Use the platform for your studies or teaching only.</li>
          <li>Do not try to access content or accounts you are not allowed to see, bypass security, overload the service, or upload malicious files.</li>
          <li>Do not upload content that is unlawful, offensive, or that you do not have the right to share. Teachers must not upload identifiable patient information.</li>
          <li>During quizzes, do not cheat, share questions or answers outside permitted use, or use automated tools.</li>
        </ul>
      </section>

      <section aria-labelledby="content">
        <h2 id="content">Teaching content and ownership</h2>
        <p>Models, videos, captions, quizzes and library materials belong to the institution, its teachers or their original licensors. You may use them for your own study. Do not copy, download (unless a teacher has enabled downloads for that model), redistribute or share materials outside the platform without permission. Teachers confirm they have the right to upload what they add.</p>
      </section>

      <section aria-labelledby="availability">
        <h2 id="availability">Availability</h2>
        <p>We aim to keep AnatoLearn available, but it may be unavailable during maintenance or because of problems we do not control. Content and features may change or be removed. Anatomy models and quizzes are learning aids and are not clinical advice.</p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes to these terms</h2>
        <p>We may update these terms. The date at the top shows the latest version. Continuing to use AnatoLearn after a change means you accept it.</p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Contact</h2>
        <p>[Administrator contact: set by your institution]</p>
      </section>
    </LegalLayout>
  );
}
