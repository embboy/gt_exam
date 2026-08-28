CREATE TABLE source_import_item (
  source_import_item_id BIGSERIAL PRIMARY KEY,
  source_document_id BIGINT NOT NULL REFERENCES source_document(source_document_id) ON DELETE CASCADE,
  source_item_key VARCHAR(500) NOT NULL,
  record_type VARCHAR(30) NOT NULL CHECK (record_type IN ('OCR_COLUMN', 'ANSWER_PAGE')),
  page_no INTEGER NOT NULL CHECK (page_no > 0),
  page_column VARCHAR(10) CHECK (page_column IN ('LEFT', 'RIGHT')),
  raw_text TEXT NOT NULL,
  source_coordinates JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  review_status VARCHAR(30) NOT NULL DEFAULT 'NEEDS_REVIEW'
    CHECK (review_status IN ('NEEDS_REVIEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED')),
  promoted_question_id BIGINT REFERENCES question(question_id),
  reviewed_by BIGINT REFERENCES app_user(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_document_id, source_item_key),
  CHECK (review_status = 'ACCEPTED' OR promoted_question_id IS NULL)
);

CREATE INDEX idx_source_import_review_queue
  ON source_import_item(review_status, source_document_id, page_no);