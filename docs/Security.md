# Security Overview

Controls implemented in AnatoLearn and where to find them. See `Deployment.md` for hosting-level steps.

## Authentication and sessions
- bcrypt (cost 12) password hashes. One server-side policy (`src/passwords.js`) applies to registration, password change, administrator-created and administrator-reset passwords and the admin scripts: 8 characters for students and 12 for teachers and administrators, at most 72 bytes, an uppercase letter and a number, not a common password (including capital, digit and symbol variations such as `P@ssw0rd!`), not a keyboard run or repeated pattern, and not containing the person's name or email. The browser mirrors the cheap rules for instant feedback; teacher registration needs `TEACHER_INVITE_CODE`; optional `ALLOWED_EMAIL_DOMAINS` restricts who can register.
- Session = signed JWT in an `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie. The token is never returned to or stored by page scripts. Each session has a server-side record, so logout, password change, disabling an account or changing a role revokes it immediately.
- Per-account lockout after 5 failed logins (15 minutes) plus per-IP rate limits on login, register and the API. Locked, disabled and unknown accounts get the same generic error and similar timing.
- **Two-factor authentication (TOTP)** for teachers and administrators, enforced with `MFA_REQUIRED=true`. Sign-in returns a 5-minute challenge token and no session until a valid code is entered; codes are single-use (replay-proof) and wrong codes feed the account lockout. Authenticator secrets are AES-256-GCM encrypted at rest (`MFA_ENCRYPTION_KEY`); 10 single-use recovery codes are stored hashed. Staff who have not enrolled can reach only the profile and enrolment endpoints, and cannot turn it off. Administrators can reset a lost device; every reset, failure and recovery-code use is audited.
- CSRF: double-submit token (`anatolearn_csrf` cookie echoed in `X-CSRF-Token`) required on cookie-authenticated unsafe requests, in addition to the origin check and SameSite=Strict.

## Authorisation
- Quiz answer keys (correct option, model answer) reach students only once the whole attempt is marked, so they cannot read the key on a quiz with open-ended questions and retake it before the teacher has reviewed. Teachers always see them.
- Content and attempt access checks (`middleware/contentAccess.js`) match the decoded path regardless of letter case, percent-encoding or HEAD requests, and routing is case-sensitive, so they cannot be skipped by rewriting the URL. Regression tests cover this.
- Role checks on every teacher route; students only see published content for their programme. Students cannot change their own programme. Teachers cannot demote, disable or delete themselves, and one active teacher always remains.
- Teaching files are served only through authenticated, programme-checked API routes; the S3 bucket is private.

## Data protection
- Uploads are validated by extension and file signature (models, resources, captions and videos), size and field limited, rate limited (60 per hour per IP), then scanned by ClamAV before reaching S3 (fail closed in production). Rejected uploads return 4xx.
- 500 responses never include internal error text. Request logs exclude query strings and bodies. CSV exports neutralise spreadsheet formulas.
- Users can export their data and delete their account from the Profile page.

## Accountability
- `audit_log` records sign-ins, failures, lockouts, user management and every successful state-changing API call (actor, action, record, IP). Administrators (not teachers) can review it under Users -> Audit log. Rotate or archive old rows as policy requires.

## Infrastructure
- The API connects as a least-privilege Postgres role (`anatolearn_app`, DML only); migrations and backups use the owner role.
- Containers drop all capabilities, run read-only with `no-new-privileges`, and have memory and process limits. Only Caddy (80/443) is published; Postgres, ClamAV, the API and nginx are internal.
- Caddy and the API send `Strict-Transport-Security` (one year, no `includeSubDomains`).
- The API validates its configuration at startup and refuses to run with a placeholder `JWT_SECRET`, non-https or wildcard `FRONTEND_ORIGINS`, or a short MFA key; it warns about risky settings and an over-privileged database role (`src/config.js`).
- Dependabot and CI run on every change: `npm audit`, tests, ESLint with `eslint-plugin-security` for the backend (`npm run lint`), a gitleaks secret scan, CodeQL static analysis and a Trivy scan that fails on fixable HIGH or CRITICAL vulnerabilities in the production images (also weekly, so new CVEs in base images are caught without a code change).

## Known limitations
- Direct-to-S3 browser uploads are intentionally not used: files pass through the API so they can be validated and virus-scanned before storage.
- Two-factor authentication is TOTP, which a real-time phishing page can still relay. Passkeys (WebAuthn) would close that gap. A lost device is recovered by an administrator, not by email.
- Email-based password reset and email verification are not implemented; teachers reset passwords from Users, and `ALLOWED_EMAIL_DOMAINS` limits who can register.
- Postgres inside Docker does not use TLS (traffic stays on the private Docker network). Use RDS with TLS if you need encryption in transit to the database.
