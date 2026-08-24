-- Deterministic records reserved for automated tests. All accounts use the
-- non-production password `TestPass123!`.
TRUNCATE TABLE downloads, quiz_attempt_answers, quiz_attempts, users RESTART IDENTITY CASCADE;

INSERT INTO users (id, program_id, name, email, password_hash, role) VALUES
(1001, 1, 'Test Student', 'student@test.invalid', '$2a$10$yLFVRnsgzvyRicn8DlNzweVuHWWHcka2SdqT4l.RCkf2qxuqHuGZW', 'student'),
(1002, 1, 'Other Student', 'other.student@test.invalid', '$2a$10$yLFVRnsgzvyRicn8DlNzweVuHWWHcka2SdqT4l.RCkf2qxuqHuGZW', 'student'),
(1003, 1, 'Test Teacher', 'teacher@test.invalid', '$2a$10$yLFVRnsgzvyRicn8DlNzweVuHWWHcka2SdqT4l.RCkf2qxuqHuGZW', 'teacher');

SELECT setval(pg_get_serial_sequence('users', 'id'), 1003, true);
