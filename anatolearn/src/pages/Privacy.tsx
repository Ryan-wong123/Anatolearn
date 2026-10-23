import { Link } from 'react-router-dom';
import LegalLayout from '../components/account/LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy notice">
      <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        This notice describes how the AnatoLearn software handles personal data. The institution running this site is responsible for it and should review and adapt this text (including the contact line below) to its own legal and policy requirements before relying on it.
      </p>

      <section aria-labelledby="who">
        <h2 id="who">Who this applies to</h2>
        <p>AnatoLearn is a learning platform for anatomy teaching. It is only available to signed-in students and teachers. This notice applies to everyone who has an account.</p>
      </section>

      <section aria-labelledby="collected">
        <h2 id="collected">What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name, email address, role (student or teacher) and programme, and a hashed version of your password. We never store your password in readable form.</li>
          <li><strong>Learning activity:</strong> your quiz attempts, answers and scores, teacher grades and feedback scores, the models, videos, quizzes and library items you open, and your favourites.</li>
          <li><strong>Downloads:</strong> a log of which 3D models you downloaded and when.</li>
          <li><strong>Security records:</strong> sign-in times, failed sign-in counts, and an audit log of account and teacher actions (for example publishing content, grading, or changing accounts) that includes the IP address the action came from.</li>
          <li><strong>Technical logs:</strong> our servers record each request (time, page address without search terms, response status, your user ID and IP address) to keep the service running and secure.</li>
        </ul>
      </section>

      <section aria-labelledby="why">
        <h2 id="why">Why we use it</h2>
        <ul>
          <li>To provide the teaching service: showing the right content for your programme, running and marking quizzes, and showing your progress.</li>
          <li>To assess learning: teachers can see quiz results for their students.</li>
          <li>To keep the platform secure: preventing misuse, investigating problems and protecting accounts (for example temporarily locking an account after repeated failed sign-ins).</li>
        </ul>
        <p className="mt-2">We do not sell personal data, show advertising, or use it for marketing.</p>
      </section>

      <section aria-labelledby="storage">
        <h2 id="storage">Where it is stored and who can see it</h2>
        <p>Data is stored on Amazon Web Services infrastructure. Account and activity data is held in a database that is not reachable from the internet. Uploaded teaching content (3D models, videos, captions, documents and images) is kept in a private storage bucket and is only delivered to signed-in users who are allowed to see it. Teachers can see student names, programmes and quiz results. Platform administrators can access the system to operate and secure it.</p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies">Cookies</h2>
        <p>AnatoLearn uses two cookies, both strictly necessary for the site to work: a session cookie that keeps you signed in (it cannot be read by page scripts) and a security cookie that protects against forged requests. We do not use analytics, tracking or advertising cookies. Your theme choice and the time you last viewed announcements are stored in your browser only.</p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">How long we keep it</h2>
        <ul>
          <li>Sign-in sessions expire after 24 hours, and expired session records are removed after about 30 days.</li>
          <li>Account data is kept until the account is deleted.</li>
          <li>When an account is deleted, personal details, favourites and activity are removed. Past quiz attempts are kept without your name so teachers' statistics stay accurate.</li>
          <li>Audit and technical logs are kept for as long as needed for security and operations, and encrypted database backups are kept for about 35 days, so deleted data can remain in backups until they expire.</li>
        </ul>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Your choices and rights</h2>
        <ul>
          <li>View and update your name (and, for teachers, programme) on your <Link to="/profile" className="text-blue-700 underline dark:text-blue-400">Profile</Link> page.</li>
          <li>Download a copy of your data from the Profile page.</li>
          <li>Change your password or delete your account from the Profile page.</li>
          <li>Ask the administrator to correct details you cannot change yourself (such as your email address or programme), or about any other privacy question.</li>
        </ul>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">How we protect it</h2>
        <p>Connections are encrypted with HTTPS. Passwords are hashed. Access is limited by role and programme. Repeated failed sign-ins lock an account for a short time, uploads are scanned for malware, teacher actions are logged, and systems are monitored and backed up. No system is perfectly secure; please use a strong, unique password and sign out on shared devices.</p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Contact</h2>
        <p>[Administrator contact: set by your institution]</p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes</h2>
        <p>We may update this notice. The date at the top shows when it last changed. See also the <Link to="/terms" className="text-blue-700 underline dark:text-blue-400">Terms of use</Link>.</p>
      </section>
    </LegalLayout>
  );
}
