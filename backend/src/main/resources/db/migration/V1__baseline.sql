CREATE TABLE app_user (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('USER', 'QUESTION_REVIEWER', 'ADMIN', 'AI_AGENT')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED', 'WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subject (
  subject_id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  exam_stage SMALLINT NOT NULL CHECK (exam_stage IN (1, 2)),
  session_no SMALLINT NOT NULL CHECK (session_no BETWEEN 1 AND 2),
  display_order SMALLINT NOT NULL,
  question_count SMALLINT NOT NULL DEFAULT 40 CHECK (question_count = 40),
  UNIQUE(exam_stage, display_order)
);

CREATE TABLE topic (
  topic_id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subject(subject_id),
  parent_topic_id BIGINT REFERENCES topic(topic_id),
  code VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  UNIQUE(subject_id, code)
);

CREATE TABLE source_document (
  source_document_id BIGSERIAL PRIMARY KEY,
  source_kind VARCHAR(30) NOT NULL CHECK (source_kind IN ('PAST_EXAM', 'STATUTE', 'POLICY', 'EDITORIAL')),
  exam_year SMALLINT CHECK (exam_year BETWEEN 2016 AND 2025),
  title VARCHAR(300) NOT NULL,
  source_url TEXT,
  publisher VARCHAR(200),
  checksum_sha256 CHAR(64),
  rights_status VARCHAR(30) NOT NULL CHECK (rights_status IN ('REGISTERED', 'RIGHTS_VERIFIED', 'REJECTED')),
  rights_note TEXT,
  verified_by BIGINT REFERENCES app_user(user_id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_kind, exam_year, checksum_sha256)
);

CREATE TABLE question (
  question_id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subject(subject_id),
  topic_id BIGINT REFERENCES topic(topic_id),
  source_document_id BIGINT REFERENCES source_document(source_document_id),
  source_item_no VARCHAR(30),
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('PAST_EXAM', 'AI_DERIVED', 'EDITORIAL')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED')),
  current_version_id BIGINT,
  created_by BIGINT REFERENCES app_user(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_document_id, source_item_no)
);

CREATE TABLE question_version (
  question_version_id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES question(question_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  question_type VARCHAR(30) NOT NULL DEFAULT 'SINGLE_CHOICE',
  difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  stem TEXT NOT NULL,
  option_1 TEXT NOT NULL,
  option_2 TEXT NOT NULL,
  option_3 TEXT NOT NULL,
  option_4 TEXT NOT NULL,
  option_5 TEXT NOT NULL,
  correct_answer SMALLINT NOT NULL CHECK (correct_answer BETWEEN 1 AND 5),
  explanation TEXT NOT NULL,
  exam_reference_date DATE NOT NULL,
  normalized_hash CHAR(64) NOT NULL UNIQUE,
  created_by BIGINT REFERENCES app_user(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, version_no),
  UNIQUE(question_id, question_version_id)
);

ALTER TABLE question
  ADD CONSTRAINT fk_question_current_version
  FOREIGN KEY (question_id, current_version_id)
  REFERENCES question_version(question_id, question_version_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE question_similarity (
  lower_question_id BIGINT NOT NULL REFERENCES question(question_id),
  higher_question_id BIGINT NOT NULL REFERENCES question(question_id),
  similarity_score NUMERIC(8, 6) NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  algorithm_version VARCHAR(50) NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('ALLOW', 'REVIEW', 'BLOCK')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lower_question_id < higher_question_id),
  PRIMARY KEY(lower_question_id, higher_question_id, algorithm_version)
);

CREATE TABLE mock_exam (
  exam_id BIGSERIAL PRIMARY KEY,
  exam_stage SMALLINT NOT NULL CHECK (exam_stage IN (1, 2)),
  set_no SMALLINT NOT NULL CHECK (set_no BETWEEN 1 AND 10),
  title VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED')),
  legal_reference_date DATE NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_stage, set_no)
);

CREATE TABLE mock_exam_session (
  exam_session_id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES mock_exam(exam_id) ON DELETE CASCADE,
  session_no SMALLINT NOT NULL CHECK (session_no BETWEEN 1 AND 2),
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
  UNIQUE(exam_id, session_no),
  UNIQUE(exam_id, exam_session_id)
);

CREATE TABLE mock_exam_question (
  exam_question_id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES mock_exam(exam_id) ON DELETE CASCADE,
  exam_session_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL REFERENCES subject(subject_id),
  question_id BIGINT NOT NULL REFERENCES question(question_id),
  question_version_id BIGINT NOT NULL,
  question_no SMALLINT NOT NULL CHECK (question_no BETWEEN 1 AND 40),
  official_slot BOOLEAN NOT NULL DEFAULT false,
  FOREIGN KEY (exam_id, exam_session_id) REFERENCES mock_exam_session(exam_id, exam_session_id),
  FOREIGN KEY (question_id, question_version_id) REFERENCES question_version(question_id, question_version_id),
  UNIQUE(exam_id, subject_id, question_no),
  UNIQUE(exam_id, question_id),
  UNIQUE(exam_id, exam_question_id),
  UNIQUE(exam_id, exam_question_id, question_id, question_version_id)
);

CREATE UNIQUE INDEX uq_official_mock_question
  ON mock_exam_question(question_id)
  WHERE official_slot;

CREATE INDEX idx_question_subject_topic ON question(subject_id, topic_id);
CREATE INDEX idx_question_status ON question(status);
CREATE INDEX idx_mock_exam_question_exam ON mock_exam_question(exam_id, subject_id);
