# Acceptance Tests

각 시나리오는 API 통합 테스트와 Playwright E2E 테스트에 연결한다.

## Catalogue and source
- AT-001 Given 2016~2025 이외의 기출 원문, when 등록, then `422`로 거부한다.
- AT-002 Given 이용조건 미확인 원문, when import 또는 공개, then 거부하고 감사로그를 남긴다.
- AT-003 Given 동일 출처 문항번호 또는 동일 checksum, when 재수집, then 중복 생성하지 않는다.

## Exam generation and publish
- AT-004 Given 충분한 승인 문항, when 생성, then 제1차 10회와 제2차 10회를 만든다.
- AT-005 Given 생성된 시험, then 각 시험과목 단위는 정확히 40문항이다.
- AT-006 Given 20개 공식 시험, then 전체 `question_id`와 `normalized_hash` 중복은 0이다.
- AT-007 Given `BLOCK` 유사도 쌍, when 검증, then 같은 공식 시험군에 publish하지 않는다.
- AT-008 Given 미승인 또는 법령 기준일 부적합 문항, when publish, then `422`로 거부한다.
- AT-009 Given publish 도중 한 검증 실패, then 시험과 `official_slot` 변경을 모두 rollback한다.
- AT-010 Given 동시 publish 두 건이 같은 문항을 선택, then 하나만 성공하고 다른 요청은 `409`다.
- AT-011 Given publish 후 원문 문항 수정, then 기존 시험의 문항·정답·채점은 변하지 않는다.

## Exam attempt
- AT-012 Given 사용자와 published 시험, when 시작, then 서버 기준 `startedAt/expiresAt`과 문항 snapshot을 생성한다.
- AT-013 Given 같은 start request ID 재호출, then 같은 `userExamId`를 반환한다.
- AT-014 Given 시험에 없는 문항, when 답안 저장, then `QUESTION_NOT_IN_EXAM`으로 거부한다.
- AT-015 Given 저장된 답안, when 새로고침, then 선택 답안과 answer version을 복구한다.
- AT-016 Given 오래된 answer version, when 저장, then `409 VERSION_CONFLICT`를 반환한다.
- AT-017 Given 같은 submit idempotency key, when 반복 제출, then 같은 채점 결과를 반환한다.
- AT-018 Given 제출 또는 만료된 시험, when 답안 변경, then `409`로 거부한다.
- AT-019 Given 제한시간 경과, when 저장 또는 조회, then 서버가 `EXPIRED` 처리하고 저장 답안만 채점한다.
- AT-020 Given 채점 완료, then 과목별 점수, 과락, 단계 평균, 최종 합격 여부가 일치한다.
- AT-021 Given 다른 사용자의 `userExamId`, when 조회/저장/제출, then `403`을 반환한다.

## Learning and operations
- AT-022 Given 오답, when 채점 완료, then 오답 이력과 사용자별 오답노트를 upsert한다.
- AT-023 Given 오답노트, when 재학습, then 개인 학습에서는 공식 사용 문항도 재사용할 수 있다.
- AT-024 Given 단원별 이력, when 취약도 조회, then 정의된 계산식과 결과가 일치한다.
- AT-025 Given AI 요약 생성, then 입력 문항 버전과 모델/프롬프트 버전을 추적할 수 있다.
- AT-026 Given 승인, publish, 법령 또는 권한 변경, then before/after와 trace ID를 감사로그에 남긴다.

## Non-functional gates
- AT-027 시험 제출을 제외한 API는 명시된 부하 조건에서 p95 500ms 미만이다.
- AT-028 자동저장 재시도와 서버 재기동 후에도 승인된 답안 유실이 0건이다.
- AT-029 키보드만으로 시험 응시와 제출이 가능하고 WCAG 2.2 AA 자동 검사를 통과한다.
- AT-030 백업본으로 RPO/RTO 목표 안에 복구하고 표본 채점 결과가 동일하다.
