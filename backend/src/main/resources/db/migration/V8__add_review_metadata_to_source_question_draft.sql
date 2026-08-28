ALTER TABLE source_question_draft
  ADD COLUMN topic_id BIGINT REFERENCES topic(topic_id),
  ADD COLUMN difficulty SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  ADD COLUMN explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN exam_reference_date DATE NOT NULL DEFAULT DATE '2026-10-31';