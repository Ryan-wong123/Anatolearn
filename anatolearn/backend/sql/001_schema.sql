DROP TABLE IF EXISTS quiz_attempt_answers CASCADE;
DROP TYPE IF EXISTS question_format CASCADE;
DROP TYPE IF EXISTS attempt_status CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
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

CREATE TYPE quiz_type AS ENUM ('MCQ', 'Practical', 'Mixed');

CREATE TABLE programs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TYPE question_format AS ENUM ('mcq', 'open_ended');
CREATE TYPE attempt_status AS ENUM ('graded', 'pending_review');

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
    is_published BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    type quiz_type NOT NULL DEFAULT 'MCQ',
    category VARCHAR(100),
    is_published BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,

    question TEXT NOT NULL,
    format question_format NOT NULL DEFAULT 'mcq',

    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_option CHAR(1) CHECK (correct_option IN ('A', 'B', 'C', 'D')),

    model_answer TEXT
);

CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER,
    status attempt_status NOT NULL DEFAULT 'graded',
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option CHAR(1),
    answer_text TEXT,
    is_correct BOOLEAN,
    teacher_score INTEGER
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