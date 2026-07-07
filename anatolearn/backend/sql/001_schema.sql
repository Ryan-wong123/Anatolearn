DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS annotations CASCADE;
DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS programs CASCADE;

DROP TYPE IF EXISTS resource_type CASCADE;
DROP TYPE IF EXISTS annotation_type CASCADE;

CREATE TYPE annotation_type AS ENUM ('point', 'highlight', 'region_fill');

CREATE TYPE resource_type AS ENUM (
    'pdf',
    'document',
    'link'
);

CREATE TABLE programs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotations (
    id SERIAL PRIMARY KEY,

    model_id INTEGER NOT NULL
        REFERENCES models(id)
        ON DELETE CASCADE,

    annotation_type annotation_type NOT NULL,

    label VARCHAR(255) NOT NULL,
    description TEXT,

    color VARCHAR(20),

    -- flexible data depending on annotation type
    annotation_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    video_path TEXT NOT NULL,
    thumbnail_path TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,

    question TEXT NOT NULL,

    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,

    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D'))
);

CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    resource_type resource_type NOT NULL,
    file_path TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);