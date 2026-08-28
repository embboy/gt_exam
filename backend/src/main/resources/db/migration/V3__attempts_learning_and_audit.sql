CREATE TABLE refresh_token (
  refresh_token_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE law (
  law_id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(300) NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE law_version (
  law_version_id BIGSERIAL PRIMARY KEY,
  law_id BIGINT NOT NULL REFERENCES law(law_id),
  promulgated_at DATE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_document_id BIGINT REFERENCES source_document(source_document_id),
  checksum_sha256 CHAR(64) NOT NULL,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(law_id, effective_from)
);

CREATE TABLE question_law_version (
  question_version_id BIGINT NOT NULL REFERENCES question_version(question_version_id) ON DELETE CASCADE,
  law_version_id BIGINT NOT NULL REFERENCES law_version(law_version_id),
  PRIMARY KEY(question_version_id, law_version_id)
);

CREATE TABLE question_usage (
  question_usage_id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES question(question_id),
  exam_id BIGINT REFERENCES mock_exam(exam_id),
  user_id BIGINT REFERENCES app_user(user_id),
  usage_type VARCHAR(30) NOT NULL CHECK (usage_type IN ('OFFICIAL_MOCK', 'PERSONAL_REVIEW')),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (usage_type = 'OFFICIAL_MOCK' AND exam_id IS NOT NULL AND user_id IS NULL)
    OR (usage_type = 'PERSONAL_REVIEW' AND exam_id IS NULL AND user_id IS NOT NULL)
  )
);

CREATE TABLE user_exam (
  user_exam_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(user_id),
  exam_id BIGINT NOT NULL REFERENCES mock_exam(exam_id),
  attempt_no SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_no > 0),
  status VARCHAR(30) NOT NULL CHECK (status IN ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED')),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  total_score NUMERIC(6, 2),
  passed BOOLEAN,
  row_version BIGINT NOT NULL DEFAULT 0,
  start_request_id UUID NOT NULL UNIQUE,
  submit_idempotency_key VARCHAR(100),
  UNIQUE(user_id, exam_id, attempt_no),
  UNIQUE(user_exam_id, exam_id),
  UNIQUE(user_id, submit_idempotency_key),
  CHECK (submitted_at IS NULL OR status IN ('SUBMITTED', 'EXPIRED'))
);

CREATE TABLE user_exam_session (
  user_exam_session_id BIGSERIAL PRIMARY KEY,
  user_exam_id BIGINT NOT NULL REFERENCES user_exam(user_exam_id) ON DELETE CASCADE,
  exam_session_id BIGINT NOT NULL REFERENCES mock_exam_session(exam_session_id),
  status VARCHAR(30) NOT NULL CHECK (status IN ('READY', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  row_version BIGINT NOT NULL DEFAULT 0,
  UNIQUE(user_exam_id, exam_session_id),
  CHECK (expires_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE user_exam_question (
  user_exam_id BIGINT NOT NULL,
  exam_id BIGINT NOT NULL,
  exam_question_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  question_version_id BIGINT NOT NULL,
  PRIMARY KEY(user_exam_id, exam_question_id),
  FOREIGN KEY (user_exam_id, exam_id) REFERENCES user_exam(user_exam_id, exam_id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id, exam_question_id, question_id, question_version_id)
    REFERENCES mock_exam_question(exam_id, exam_question_id, question_id, question_version_id)
);

CREATE TABLE user_answer (
  user_exam_id BIGINT NOT NULL,
  exam_question_id BIGINT NOT NULL,
  selected_answer SMALLINT CHECK (selected_answer BETWEEN 1 AND 5),
  is_correct BOOLEAN,
  answer_version BIGINT NOT NULL DEFAULT 0,
  last_request_id UUID NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_exam_id, exam_question_id),
  FOREIGN KEY (user_exam_id, exam_question_id)
    REFERENCES user_exam_question(user_exam_id, exam_question_id) ON DELETE CASCADE,
  UNIQUE(user_exam_id, last_request_id)
);

CREATE TABLE user_exam_subject_result (
  user_exam_id BIGINT NOT NULL REFERENCES user_exam(user_exam_id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subject(subject_id),
  correct_count SMALLINT NOT NULL CHECK (correct_count BETWEEN 0 AND 40),
  score NUMERIC(6, 2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed_cutoff BOOLEAN NOT NULL,
  PRIMARY KEY(user_exam_id, subject_id)
);

CREATE TABLE wrong_history (
  wrong_history_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(user_id),
  question_id BIGINT NOT NULL REFERENCES question(question_id),
  question_version_id BIGINT NOT NULL REFERENCES question_version(question_version_id),
  user_exam_id BIGINT REFERENCES user_exam(user_exam_id),
  selected_answer SMALLINT CHECK (selected_answer BETWEEN 1 AND 5),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wrong_note (
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES question(question_id),
  note TEXT,
  review_status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (review_status IN ('NEW', 'REVIEWING', 'MASTERED')),
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, question_id)
);

CREATE TABLE audit_log (
  audit_log_id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES app_user(user_id),
  actor_type VARCHAR(30) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  before_value JSONB,
  after_value JSONB,
  trace_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_exam_owner ON user_exam(user_id, status);
CREATE INDEX idx_wrong_history_user_question ON wrong_history(user_id, question_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_type, target_id, created_at DESC);