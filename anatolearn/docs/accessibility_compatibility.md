# Accessibility and browser acceptance

Updated 22 October 2026. This is an execution checklist, not a certification.
PRD.md NFR-17 requires Chrome, Edge, Firefox and Safari; incomplete verification does not waive that requirement.

## Current evidence

Final Playwright run, 22 October 2026: **39 passed, 1 explicitly skipped, 0 failed**. Across 116 axe scans there were **zero detected violations** for the configured WCAG 2 A/AA and 2.1 A/AA tags. Full scope and explicit skip are preserved in [the sanitized summary](verification/browser-accessibility-summary.json).

| Environment | Actual outcome |
|---|---|
| Installed Chrome, Windows | 10/10 tests passed; 29 axe scans |
| Installed Edge, Windows | 10/10 tests passed; 29 axe scans |
| Playwright Firefox, Windows | 10/10 tests passed; 29 axe scans |
| Playwright WebKit, Windows | 9 passed; MP4 playback explicitly skipped; 29 axe scans |
| Safari on macOS/iOS | Actual Safari not executed; Windows WebKit is engine coverage only |
| NVDA/VoiceOver | No spoken-output test; user selected Playwright/axe as the available alternative |

The automated suite exercises auth semantics, both roles across five sections in both themes, a teacher upload dialog, compact navigation at 375×812, viewer annotations and linked-video feedback, MP4 playback where supported, keyboard MCQ submission/results and simulated read-error retry. Desktop size is 1440×900. It uses the Physiotherapy/shared fixture, not a full programme/browser/viewport Cartesian matrix.

The Windows WebKit player rejected the fixture H.264 Main/AAC LC MP4 with NotSupportedError even though authenticated media delivery returned HTTP 206. Chrome, Edge and Firefox decoded and played it. WebKit's visible media-error feedback was verified; a separate playback test is explicitly skipped on that platform. It must be exercised on actual Safari/macOS before claiming Safari video compatibility. See [Playwright's platform/codec guidance](https://playwright.dev/docs/browsers#webkit).

Axe reports retain incomplete/manual-review findings: contrast over complex backgrounds, the annotation minus-icon label, and WebKit autoplay/audio checks. The minus icon has an explicit “Collapse annotations” name matching its purpose. Standalone video-page autoplay is disabled; the viewer's video dialog still starts after the learner activates Watch. Optional English WebVTT caption upload/playback is implemented and tested, but caption content remains teacher-supplied and must be reviewed for accuracy and coverage. WebKit verified protected VTT response and track markup; its fixture video did not trigger an automatic track request, so this does not establish native Safari caption rendering. Representative contrast checks below were completed; a full rendered-state manual audit remains outstanding. Zero detected automated violations is not complete WCAG compliance or spoken-output verification; see [Playwright's accessibility guidance](https://playwright.dev/docs/accessibility-testing).

## Contrast follow-up

Placeholder text changed from slate-400 to slate-500 in light mode (4.76:1 on white) and remains slate-400 in dark mode (6.96:1 on slate-900). Representative small text on the viewer's 90%-opaque panels was checked against the worst-case opposing background blend: 6.07:1 for slate-600 in light mode and 5.11:1 for slate-400 in dark mode. White text on blue-600 primary actions measures 5.17:1. These calculations support the palette choices and supplement axe; animated/transient and every interactive/state surface were not measured exhaustively.

## Run the automated alternative

Follow the host installation and commands in [README.md](README.md#automated-browser-and-accessibility-checks). `npm run test:browser` creates and cleans disposable Docker fixtures. `npm run test:browser:summary` produces the shareable summary. `npm run test:browser:report` opens the private local HTML report. Browsers and reports are excluded from Vite polling to avoid slowing Windows bind-mounted development services; raw traces are denied by Vite and ignored by Git/Docker because they can contain authentication data.

## Prepare a repeatable run

1. Start Docker Desktop, then `docker compose up -d` from `anatolearn/`.
2. Run `docker compose exec -T backend node tests/browser-fixture.js` only when no previous browser fixture manifest exists. Record printed teacher/student accounts and content IDs. The fixture password is `Testing123`; use only these disposable accounts.
3. Open `http://localhost:5173` in each actual target browser. Enable the screen reader for spoken-output runs. Test both roles with their actual accounts, rather than the development role preview.
4. Record browser, OS and screen-reader versions, date, role, viewport, result and any defect reproduction. An absent environment is “not run”, not “passed”.
5. After all runs, sign out and run `docker compose exec -T backend node tests/browser-fixture.js cleanup`. This removes the recorded disposable fixture, including its attempts. Do not rerun setup over an existing manifest.

## Browser workflow checklist

Repeat in Chrome, Edge, Firefox and Safari at desktop and narrow widths.

| Scenario | Expected result |
|---|---|
| Sign in/register | Named controls; password guidance associated; programme choices load; readable validation; teacher self-registration remains available |
| Navigation | Correct title; destination status updates; current link exposed; SPA navigation focuses main; skip link moves focus to main |
| Compact menu | Toggle exposes expanded state; Escape closes and returns focus; no horizontal overflow |
| Upload/edit dialog, teacher | Named heading/fields; background unavailable while open; Tab/Shift+Tab stay inside; Escape and close restore trigger focus |
| Five main sections, both roles | Content loads; student authoring controls absent; programme/shared rules preserved |
| Viewer | Geometry visible; rotate/pan/zoom/reset work; keyboard annotation selection exposes description/video; selected and collapse states correct |
| Quiz, student | Answers usable by keyboard; submission result and history available; timer expiry behaves correctly |
| Video | Authenticated media loads; native playback controls work; errors retain useful navigation and retry |
| Request failure/retry | Persistent readable error; no false empty result; retry restores content and sensible focus |
| Theme and zoom | Focus visible in both themes; content usable at 200% zoom without obscured controls |

For a local request-failure test, stop only the development backend with
`docker compose stop backend`, navigate to Library, then restore it with
`docker compose start backend` and activate Try again. Always restart the backend
even if a check fails. Do not apply this interruption to a shared/production service.

## Spoken-output checklist

Use NVDA with Chrome and Firefox on Windows and VoiceOver with Safari on an Apple
device. Record what is actually announced, rather than inferred ARIA values.

- Navigate by landmarks and headings: each page has a usable main region, and auth forms have an identifiable purpose.
- Follow SPA links: the destination is identifiable through title/main focus/status without stale page context. Check that announcements are not disruptive or repeatedly duplicated.
- Focus the registration password: requirements are read as its description.
- Open/close a teacher dialog: its title is announced, background content cannot be traversed, and closing restores the invoking control.
- Select an annotation by keyboard: selection state is announced; its named details region, description and linked video can be reached without using the canvas.
- Complete an MCQ: question, choices and selected answer are understandable; result and validation feedback can be found.
- Trigger a read failure and retry: error and loading feedback are discoverable; focus remains useful after failure/success.

The automated alternative now has dated results above. Actual spoken-output and
Safari acceptance still require their respective manual runs before those specific items close. Track any discovered defect separately with its failing setup
and rerun the affected scenario after fixing it. English WebVTT caption tracks
are supported; teachers still need to supply and review the text, and no
transcript generation or accuracy check is provided. Complete contrast auditing
and WCAG certification require additional scope and evidence.

The 22 October follow-up disabled autoplay on the standalone video page and
added a regression assertion. The latest Docker-backed Playwright run passed
39 tests and skipped one Windows WebKit MP4 playback test. Both dependency
audits report zero vulnerabilities. See testing_log.md for full verification.
