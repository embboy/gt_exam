ALTER TABLE mock_exam
  ADD COLUMN exam_kind VARCHAR(30) NOT NULL DEFAULT 'PAST_EXAM',
  ADD CONSTRAINT ck_mock_exam_kind
    CHECK (exam_kind IN ('PAST_EXAM', 'PREDICTED'));

ALTER TABLE mock_exam
  DROP CONSTRAINT mock_exam_exam_stage_set_no_key;

ALTER TABLE mock_exam
  ADD CONSTRAINT uq_mock_exam_kind_stage_set
    UNIQUE (exam_kind, exam_stage, set_no);