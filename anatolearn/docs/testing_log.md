# Testing Log

## Docker PostgreSQL Init Script Mount
Date: 8 Jul 2026
Tester: Codex

### Test Method
Updated `docker-compose.yml` so the Postgres service mounts `backend/sql` to `/docker-entrypoint-initdb.d` as read-only. Validated the Docker Compose file with `docker compose config`.

### Expected Behavior
On first startup with an empty `postgres_data` volume, the official PostgreSQL image runs `001_schema.sql` and then `002_seed.sql`, creating and seeding the `anatolearn` database automatically.

### Results
Pass. `docker compose config` accepted the compose file and resolved the init mount to `/docker-entrypoint-initdb.d:ro`.

### Notes
The init scripts only run automatically when the PostgreSQL data volume is empty. Existing local volumes keep their current database contents and require a deliberate `docker compose down -v` reset before init scripts rerun.

## Task 7.7 — Video Playback Compatibility Test
Date: 15 Jun 2026
Tester: Natalie

### Test Method
Tested using a standalone HTML file (outside the AnatoLearn codebase) with native HTML5 `<video>` elements — NOT tested within the actual AnatoLearn app, since the in-app VideoPlayer component (Task 7.4) and click-to-play wiring (Task 7.3) are not yet built. Test files were a YouTube video converted to `.mp4` and `.webm`.

### Test Environment
- Microsoft Edge Version: 149.0.4022.69 (Official Build) (64-bit)
- Google Chrome Version: 149.0.7827.103 (Official Build) (64-bit)
- Firefox Version: 151.0.4 (64-bit)
- OS: Windows

### Test Files
- test.mp4
- test.webm

### Results

| Format | Chrome | Firefox | Edge |
|---|---|---|---|
| .mp4   | Pass   | Pass    | Pass |
| .webm  | Pass   | Pass    | Pass |

### Notes
Both .mp4 and .webm formats loaded and played correctly across all three browsers using native HTML5 `<video>` controls (play, pause, seek, volume). No buffering issues or playback errors observed.

### Conclusion
Chrome, Firefox, and Edge all support native HTML5 playback of `.mp4` and `.webm` formats, confirming the browser-level format support AnatoLearn can rely on.

**This does NOT yet confirm that AnatoLearn's own in-app video player works correctly** — that requires Task 7.4 (VideoPlayer component) and Task 7.3 (click-to-play wiring) to be built first, followed by a re-test inside the actual app (including the modal/player UI, controls, and any file-size or upload-related edge cases).
