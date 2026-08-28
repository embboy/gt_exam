CREATE TABLE source_question_draft (
  source_question_draft_id BIGSERIAL PRIMARY KEY,
  source_import_item_id BIGINT NOT NULL REFERENCES source_import_item(source_import_item_id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subject(subject_id),
  source_question_no SMALLINT NOT NULL CHECK (source_question_no BETWEEN 1 AND 40),
  stem TEXT NOT NULL,
  option_1 TEXT NOT NULL,
  option_2 TEXT NOT NULL,
  option_3 TEXT NOT NULL,
  option_4 TEXT NOT NULL,
  option_5 TEXT NOT NULL,
  proposed_answer SMALLINT CHECK (proposed_answer BETWEEN 1 AND 5),
  answer_evidence_import_item_id BIGINT REFERENCES source_import_item(source_import_item_id),
  review_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (review_status IN ('DRAFT', 'IN_REVIEW', 'ACCEPTED', 'REJECTED')),
  reviewer_note TEXT,
  reviewed_by BIGINT REFERENCES app_user(user_id),
  reviewed_at TIMESTAMPTZ,
  promoted_question_id BIGINT REFERENCES question(question_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_import_item_id, source_question_no),
  CHECK (review_status <> 'ACCEPTED' OR proposed_answer IS NOT NULL),
  CHECK (review_status <> 'ACCEPTED' OR answer_evidence_import_item_id IS NOT NULL)
);

CREATE INDEX idx_source_question_draft_review
  ON source_question_draft(review_status, subject_id, source_question_no);