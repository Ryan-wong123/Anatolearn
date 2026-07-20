-- Adds authentication support (Task 9.1+).
-- Unlike 001_schema.sql, this file does NOT drop existing tables —
-- it's meant to be run against an already-seeded database.
--
-- To apply on an existing dev database:
--   docker compose exec -T postgres psql -U anatolearn -d anatolearn < backend/sql/003_add_users.sql
--
-- On a brand-new database, this also runs automatically (docker-entrypoint-initdb.d
-- runs every *.sql file in backend/sql in filename order).

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
