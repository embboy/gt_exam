ALTER TABLE mock_exam
  ADD COLUMN source_exam_year SMALLINT,
  ADD COLUMN source_pdf_url TEXT,
  ADD COLUMN is_historical_paper BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE mock_exam
  ADD CONSTRAINT ck_mock_exam_source_paper
  CHECK (
    (source_exam_year IS NULL AND source_pdf_url IS NULL)
    OR (source_exam_year BETWEEN 2017 AND 2025 AND source_pdf_url IS NOT NULL)
  );

CREATE TABLE question_version_accepted_answer (
  question_version_id BIGINT NOT NULL REFERENCES question_version(question_version_id) ON DELETE CASCADE,
  answer SMALLINT NOT NULL CHECK (answer BETWEEN 1 AND 5),
  PRIMARY KEY (question_version_id, answer)
);

ALTER TABLE question_version
  ADD COLUMN answer_evidence_import_item_id BIGINT
  REFERENCES source_import_item(source_import_item_id);