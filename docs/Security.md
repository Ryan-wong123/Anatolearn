# Security Overview

Controls implemented in AnatoLearn and where to find them. See `Deployment.md` for hosting-level steps.

## Authentication and sessions
- bcrypt (cost 12) password hashes; passwords limited to 8-72 bytes. Registration needs an uppercase letter and number in the UI; teacher registration needs `TEACHER_INVITE_CODE`; optional `ALLOWED_EMAIL_DOMAINS` restricts who can register.
- Session = signed JWT in an `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie. The token is never returned to or stored by page scripts. Each session has a server-side record, so logout, password change, disabling an account or changing a role revokes it immediately.
- Per-account lockout after 5 failed logins (15 minutes) plus per-IP rate limits on login, register and the API. Locked, disabled and unknown accounts get the same generic error and similar timing.
- CSRF: double-submit token (`anatolearn_csrf` cookie echoed in `X-CSRF-Token`) required on cookie-authenticated unsafe requests, in addition to the origin check and SameSite=Strict.

## Authorisation
- Role checks on every teacher route; students only see published content for their programme. Students cannot change their own programme. Teachers cannot demote, disable or delete themselves, and one active teacher always remains.
- Teaching files are served only through authenticated, programme-checked API routes; the S3 bucket is private.

## Data protection
- Uploads are validated by extension and file signature, size limited, then scanned by ClamAV before reaching S3 (fail closed in production).
- 500 responses never include internal error text. Request logs exclude query strings and bodies. CSV exports neutralise spreadsheet formulas.
- Users can export their data and delete their account from the Profile page.

## Accountability
- `audit_log` records sign-ins, failures, lockouts, user management and every successful state-changing API call (actor, action, record, IP). Teachers can review it under Users -> Audit log. Rotate or archive old rows as policy requires.

## Infrastructure
- The API connects as a least-privilege Postgres role (`anatolearn_app`, DML only); migrations and backups use the owner role.
- Containers drop all capabilities, run read-only with `no-new-privileges`, and have memory and process limits. Only Caddy (80/443) is published; Postgres, ClamAV, the API and nginx are internal.
- Dependabot and CI (`npm audit`, tests, image builds) run on every change.

## Known limitations
- Direct-to-S3 browser uploads are intentionally not used: files pass through the API so they can be validated and virus-scanned before storage.
- Email-based password reset and email verification are not implemented; teachers reset passwords from Users, and `ALLOWED_EMAIL_DOMAINS` limits who can register.
- Postgres inside Docker does not use TLS (traffic stays on the private Docker network). Use RDS with TLS if you need encryption in transit to the database.
