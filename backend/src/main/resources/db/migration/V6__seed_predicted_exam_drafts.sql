INSERT INTO mock_exam (exam_kind, exam_stage, set_no, title, status, legal_reference_date)
SELECT 'PREDICTED', 1, set_no, '예상 제1차 모의고사 ' || set_no || '회', 'DRAFT', DATE '2026-10-31'
FROM generate_series(1, 10) AS set_no;

INSERT INTO mock_exam (exam_kind, exam_stage, set_no, title, status, legal_reference_date)
SELECT 'PREDICTED', 2, set_no, '예상 제2차 모의고사 ' || set_no || '회', 'DRAFT', DATE '2026-10-31'
FROM generate_series(1, 10) AS set_no;

INSERT INTO mock_exam_session (exam_id, session_no, duration_minutes)
SELECT exam_id, 1, 100
FROM mock_exam
WHERE exam_kind = 'PREDICTED' AND exam_stage IN (1, 2);

INSERT INTO mock_exam_session (exam_id, session_no, duration_minutes)
SELECT exam_id, 2, 50
FROM mock_exam
WHERE exam_kind = 'PREDICTED' AND exam_stage = 2;