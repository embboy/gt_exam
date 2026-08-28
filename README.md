# 2026 공인중개사 AI 모의고사 플랫폼 - Development Pack v2

목표: DB 기반 3-Tier 웹서비스를 GitHub에서 AI 코딩 에이전트로 개발할 수 있는 기준 문서.

공식 시험일은 Q-Net 공고 기준 2026-10-31이다.
이 문서의 시험 구조는 사용자의 요구사항인 '각 과목 40문항'을 플랫폼 모의고사 기준으로 적용한다.

## 확정 범위
- 제1차 모의고사 10회: 회차별 2개 시험과목 단위, 총 80문항
- 제2차 모의고사 10회: 회차별 3개 시험과목 단위, 총 120문항
- 2016~2025 기출문제 원문과 메타데이터를 문제은행으로 구축
- 기출·예상 공식 모의고사 40회에 사용되는 문항 버전은 서로 중복되지 않음
- 기출문제의 공개/재사용은 출처별 이용조건 확인 후 수행

## 시험 운영 기준
- 제한시간과 과목 구성은 DB 설정값이며 Q-Net 공식 시행계획을 근거로 관리한다.
- 합격 판정 기본값은 과목별 40점 이상, 단계 평균 60점 이상이다.
- 답안 저장, 만료, 제출, 채점은 서버 기준이며 제출은 멱등 처리한다.
- 시험 편성 시 문항 버전을 고정하여 이후 문항 수정이 과거 결과에 영향을 주지 않게 한다.

## 권장 Stack
- Application: Next.js 16 + TypeScript on Vercel
- API: Next.js Route Handlers on Node.js 22
- Reference backend: Spring Boot + Java 25 (Vercel 운영 경로 아님)
- DB: Vercel Marketplace PostgreSQL + Prisma 7
- Cache/Session: Redis
- Auth: JWT + Refresh Token
- API: REST/OpenAPI
- Infra: Docker Compose → Cloud
- CI/CD: GitHub Actions
- AI: LLM + Embedding
- Test: JUnit/Mockito/Testcontainers + Playwright

## 핵심 원칙
제1차 10회와 제2차 10회, 총 20회 공식 모의고사 간 동일/유사 문제 0.
AI 생성문제는 검수 전 공개 금지.
법령/정책 문제는 시험 기준일 검증.

## Local run
Vercel 운영 프로젝트의 Root Directory는 `frontend`로 설정한다. 필수 환경 변수는
`DATABASE_URL`, migration용 선택 값 `DIRECT_URL`, 인증용 `AUTH_SECRET`이다.

Vercel Function은 사용자 API만 제공하며 PDF/OCR, 대량 AI 생성, DB migration을 실행하지 않는다.
`DIRECT_URL`은 Vercel Runtime에 넣지 않고 GitHub `production` Environment의 secret으로만 등록한다.
`main` push는 `production-deploy` workflow에서 Flyway를 먼저 실행하고 Vercel prebuilt production deployment를 수행한다.
Vercel Project의 Git 자동 배포는 끄고, Production Branch는 `main`으로 설정한다.

| 환경 변수 | 위치 | 용도 |
|---|---|---|
| `DATABASE_URL` | Vercel Production/Preview | pooled PostgreSQL 연결 |
| `AUTH_SECRET` | Vercel Production/Preview | 32 bytes 이상 JWT 서명 키 |
| `DIRECT_URL` | GitHub production Environment secret | migration 전용 direct PostgreSQL 연결 |
| `VERCEL_TOKEN` | GitHub production Environment secret | Vercel CLI 배포 토큰 |
| `VERCEL_ORG_ID` | GitHub production Environment secret | Vercel 조직 또는 개인 계정 ID |
| `VERCEL_PROJECT_ID` | GitHub production Environment secret | Vercel 프로젝트 ID |

로컬 필수 도구는 Node.js 22와 PostgreSQL 16이며 Java 모듈 검증에는 Java 25 + Maven 3.9가 추가로 필요하다.

```powershell
Copy-Item .env.example frontend/.env
npm --prefix frontend install
npm --prefix frontend run db:generate
npm --prefix frontend run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3000/api/v1
- PostgreSQL: Marketplace 또는 로컬 PostgreSQL 16

현재 구현된 수직 단위는 문제/source/version migration, 2026 시험 구조 seed,
공식 시험 후보 생성·검증, 점수/합격 판정, 시험 대시보드, AI 문항 schema/validator다.
구현 진행 상태와 미완료 adapter는 `docs/traceability.md`에서 관리한다.

## Q-Net 기출 수집과 검수 적재
수집과 OCR은 Vercel request 함수가 아니라 로컬 또는 승인된 CI one-shot 작업으로 실행한다.
원본과 OCR JSONL은 Git에 포함하지 않는다. OCR 결과는 오탈자와 표 구조 오류가 있을 수 있으므로
항상 `NEEDS_REVIEW`로 적재하며, 관리자 검수 전 `question_version`이나 사용자 API에 노출하지 않는다.

```powershell
.venv\Scripts\python.exe ingestion/qnet/collect_qnet.py
.venv\Scripts\python.exe ingestion/qnet/ocr_questions.py
.venv\Scripts\python.exe ingestion/qnet/ocr_answers.py
npm --prefix frontend run db:import-qnet
```

- 수집 범위: 2016~2025 Q-Net 시험문제 및 최종정답 게시물
- manifest: `data/processed/qnet-manifest.json`
- 문제 OCR: `data/processed/qnet-question-ocr.jsonl`
- 정답 OCR: `data/processed/qnet-answer-ocr.jsonl`
- DB staging: `source_document`, `source_import_item` (Flyway V4)
- 재실행: 수집과 DB import는 checksum/key 기반 멱등 처리하며 문제 OCR은 완료된 페이지를 이어서 처리한다.
