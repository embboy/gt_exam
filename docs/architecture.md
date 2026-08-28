# Architecture Decisions

## ADR-001 Vercel-native modular monolith
운영 서비스는 `frontend`를 Vercel Project Root Directory로 지정한 Next.js full-stack 애플리케이션이다.
App Router의 Route Handler와 Server Action이 PostgreSQL에 직접 접근한다. Java는 Vercel 공식 Function 런타임이
아니므로 기존 Spring Boot 모듈은 도메인 규칙의 reference와 대체 컨테이너 배포용으로 유지하되 운영 요청 경로에서는 제외한다.

## ADR-001A Runtime and data
- Runtime: Vercel Node.js Function, Node.js 22
- Framework: Next.js 16 App Router
- Database: Vercel Marketplace PostgreSQL integration, pooled `DATABASE_URL`
- Schema CLI: `DIRECT_URL`이 있으면 migration에 사용하고 application query에는 `DATABASE_URL`을 사용한다.
- ORM: Prisma 7 + PostgreSQL adapter. SQL partial index 등 Prisma가 표현하지 못하는 제약은 기존 SQL migration이 소유한다.
- Region: PostgreSQL provider와 가장 가까운 Vercel Function region을 `VERCEL_FUNCTION_REGION` 결정 기록에 남긴다.
- 원본 기출 ZIP/PDF는 Vercel 함수 파일시스템에 저장하지 않고 수집 작업에서 checksum만 DB에 기록한다.
- `DIRECT_URL`과 migration 실행 권한은 Vercel Runtime에 주지 않는다. GitHub `production` Environment의
	승인된 `production-deploy` workflow가 Flyway CLI로 `flyway_schema_history`를 검증·적용한 후 Vercel prebuilt deployment를 수행한다.
	Vercel Project Git 자동 배포는 비활성화해 migration과 runtime 배포의 순서를 보장한다.

## ADR-002 Exam hierarchy
`mock_exam`은 제1차 또는 제2차의 한 회차를 나타낸다. 회차 아래 `mock_exam_session`이 교시 시간과 만료를,
`mock_exam_question`이 과목별 40문항 편성을 나타낸다. 제1차는 1교시, 제2차는 2교시다.

## ADR-003 Immutable question versions
문항의 식별과 검수 상태는 `question`, 실제 지문·보기·정답·해설은 `question_version`이 소유한다.
시험 편성과 응시 snapshot은 version ID를 참조하여 과거 시험과 채점을 재현한다.

## ADR-004 Database-backed invariants
공식 사용 문항과 normalized hash 중복은 PostgreSQL unique constraint/index로 방어한다.
정확히 40문항, 승인 상태, 법령 유효성, semantic block은 application service가 transaction 안에서 검증한다.

## ADR-005 Historical source ingestion
기출 범위는 2016~2025다. 파일을 직접 수집하기 전에 source URL, checksum, 발행기관, 이용조건 확인자를 등록한다.
자동 파싱 결과는 검수 대기 상태로만 저장하며 정답과 보기 파싱 오류를 사람이 확인한다.
Q-Net 게시물의 공공누리 유형과 출처표시 문구를 원문별로 보존하고 서비스 문항에 출처를 표시한다.
대용량 다운로드와 PDF/HWP 파싱은 Vercel request 함수에서 수행하지 않고 로컬/CI one-shot 수집 작업으로 실행한다.

## ADR-006 Server-authoritative attempts
교시 시작·만료·제출은 서버 시각으로 판정한다. 답안은 낙관적 version과 request ID를 사용하고 제출은
idempotency key를 사용한다. 클라이언트 타이머는 표시 수단이며 판정 근거가 아니다.

## Delivery slices
1. 문제은행/source/version과 공식 시험 편성
2. 인증, 응시 snapshot, 답안 자동저장, 제출/채점
3. 오답노트와 취약도
4. AI 생성/검증과 관리자 승인
5. 운영, 성능, 백업/복구
