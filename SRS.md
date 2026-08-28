# SRS

## Actors
- USER
- ADMIN
- QUESTION_REVIEWER
- AI_AGENT
- SYSTEM

## Functional Requirements
FR-001 회원가입/로그인
FR-002 모의고사 목록 조회
FR-003 시험 시작
FR-004 문제/보기 조회
FR-005 답안 저장
FR-006 시험 제출
FR-007 채점
FR-008 결과 조회
FR-009 오답노트
FR-010 취약단원 분석
FR-011 AI 요약
FR-012 문제 재학습
FR-013 관리자 문제 CRUD
FR-014 AI 문제 생성
FR-015 품질 검증
FR-016 중복 검증
FR-017 시험지 생성
FR-018 법령 기준일 검증
FR-019 사용이력 관리
FR-020 감사로그
FR-021 2016~2025 기출문제 일괄수집 및 검수
FR-022 기출문제 출처/이용조건/원문 식별자 관리
FR-023 제1차 10회 및 제2차 10회 공식 시험 관리
FR-024 서버 기준 제한시간 만료 및 자동제출
FR-025 제출 멱등성 및 동시 답안저장 제어
FR-026 문항 버전 고정 및 과거 결과 재현
FR-027 과목별 과락과 시험 단계별 평균 합격 판정

## Exam Composition
- 제1차: 회차별 2개 과목, 과목별 40문항, 총 80문항
- 제2차: 회차별 3개 시험과목 단위, 단위별 40문항, 총 120문항
- 제1차와 제2차는 각각 1회부터 10회까지 제공한다.
- 시험과목 단위와 제한시간은 DB 설정으로 관리하며 Q-Net 시행계획 변경 시 코드 수정 없이 반영한다.
- 제한시간과 만료 상태는 단계 전체가 아니라 제1차/제2차의 각 교시별로 관리한다.
- 합격 판정 기본 규칙은 각 시험과목 단위 40점 이상, 단계 평균 60점 이상이다.

## State Machines
- QUESTION: DRAFT -> IN_REVIEW -> APPROVED -> RETIRED
- SOURCE_DOCUMENT: REGISTERED -> RIGHTS_VERIFIED -> IMPORTED -> REJECTED
- MOCK_EXAM: DRAFT -> VALIDATED -> PUBLISHED -> ARCHIVED
- USER_EXAM: CREATED -> IN_PROGRESS -> SUBMITTED 또는 EXPIRED
- USER_EXAM_SESSION: READY -> IN_PROGRESS -> SUBMITTED 또는 EXPIRED
- 허용되지 않은 역방향 전이는 관리자 보정 API와 감사로그 없이는 수행할 수 없다.

## Authorization
- USER: 본인의 응시, 답안, 결과, 오답노트만 접근한다.
- QUESTION_REVIEWER: 문항 검수와 반려를 수행하되 publish 권한은 없다.
- ADMIN: 승인, 시험지 생성/publish, 법령 기준일 및 사용자 권한을 관리한다.
- AI_AGENT: 생성/검증 작업 전용 서비스 계정이며 직접 승인하거나 publish할 수 없다.

## Non-functional
NFR-001 REST API
NFR-002 PostgreSQL source of truth
NFR-003 Dockerized deployment
NFR-004 HTTPS
NFR-005 password hash
NFR-006 secrets via environment
NFR-007 auditability
NFR-008 backup/recovery
NFR-009 responsive UI
NFR-010 accessibility
NFR-011 답안 저장과 제출 API는 멱등성과 낙관적 동시성 제어를 제공한다.
NFR-012 시험 종료시각은 서버 시각을 기준으로 하며 클라이언트 시각을 신뢰하지 않는다.
NFR-013 감사로그는 append-only이며 actor, action, target, before/after, trace ID를 보존한다.
NFR-014 개인정보와 인증 토큰의 보존/파기 정책을 적용한다.
NFR-015 공식 시험 조회 API는 정답과 해설을 제출 전 노출하지 않는다.
NFR-016 2016~2025 원문 데이터는 출처와 이용조건 확인 전 사용자에게 공개하지 않는다.
