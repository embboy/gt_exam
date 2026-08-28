INSERT INTO subject (code, name, exam_stage, session_no, display_order) VALUES
  ('REAL_ESTATE_PRINCIPLES', '부동산학개론', 1, 1, 1),
  ('CIVIL_LAW', '민법 및 민사특별법 중 부동산 중개 관련 규정', 1, 1, 2),
  ('BROKERAGE_LAW', '공인중개사법령 및 중개실무', 2, 1, 1),
  ('PUBLIC_LAW', '부동산공법 중 부동산중개 관련 규정', 2, 1, 2),
  ('DISCLOSURE_AND_TAX', '부동산공시법 및 부동산세법', 2, 2, 3);

INSERT INTO mock_exam (exam_stage, set_no, title, status, legal_reference_date)
SELECT 1, set_no, '제1차 모의고사 ' || set_no || '회', 'DRAFT', DATE '2026-10-31'
FROM generate_series(1, 10) AS set_no;

INSERT INTO mock_exam (exam_stage, set_no, title, status, legal_reference_date)
SELECT 2, set_no, '제2차 모의고사 ' || set_no || '회', 'DRAFT', DATE '2026-10-31'
FROM generate_series(1, 10) AS set_no;

INSERT INTO mock_exam_session (exam_id, session_no, duration_minutes)
SELECT exam_id, 1, 100 FROM mock_exam WHERE exam_stage = 1;

INSERT INTO mock_exam_session (exam_id, session_no, duration_minutes)
SELECT exam_id, 1, 100 FROM mock_exam WHERE exam_stage = 2;

INSERT INTO mock_exam_session (exam_id, session_no, duration_minutes)
SELECT exam_id, 2, 50 FROM mock_exam WHERE exam_stage = 2;