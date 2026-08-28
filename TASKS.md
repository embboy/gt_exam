# AI Coding Agent Task Plan

## Phase 0 — Repository
- [x] initialize monorepo
- [x] add README/AGENTS/copilot instructions
- [x] Docker Compose
- [x] GitHub Actions
- 완료 기준: frontend/backend/database/ai가 독립 빌드되고 CI에서 동일 명령을 실행

## Phase 1 — Database
- [x] PostgreSQL migration
- [ ] subject/topic seed
- [x] question schema
- [x] exam schema
- [x] user answer/wrong history
- [x] similarity schema
- [x] source document and rights schema
- [x] immutable question version
- [x] law/law-version schema
- [x] audit and refresh-token schema
- [ ] 2016~2025 subject/source seed
- 완료 기준: Testcontainers로 migration과 핵심 unique/FK 제약 검증

## Phase 2 — Backend
- [ ] Auth
- [ ] Question API
- [ ] Exam API
- [ ] Answer API
- [x] Score service
- [ ] Wrong-note API
- [ ] Admin API
- [ ] server clock expiration
- [ ] optimistic answer save
- [ ] idempotent start/submit
- [ ] ownership and role authorization
- 완료 기준: OpenAPI 계약과 AT-012~AT-023 통합 테스트 통과

## Phase 3 — AI
- [x] prompt templates
- [x] JSON schema validator
- [x] answer uniqueness validator
- [ ] legal-date validator
- [x] normalized hash
- [ ] embedding similarity
- [ ] quality gate
- [ ] source provenance and prompt/model version
- [ ] asynchronous job status
- 완료 기준: 승인 전 공개/출제 불가 및 모든 생성 결과 추적 가능

## Phase 4 — Exam Generator
- [x] blueprint engine
- [x] candidate selector
- [x] 20-set uniqueness
- [x] 40-question validator
- [ ] atomic publish
- [ ] stage 1 x 10 and stage 2 x 10 generator
- [ ] concurrent publish conflict test
- 완료 기준: AT-004~AT-011 및 2,000문항 이상 용량 시뮬레이션 통과

## Phase 5 — Frontend
- [ ] login
- [x] dashboard
- [ ] exam
- [ ] timer
- [ ] autosave
- [ ] result
- [ ] wrong note
- [ ] AI summary
- [x] stage/set list and resume
- [ ] save/conflict/expired states
- [ ] keyboard and WCAG 2.2 AA
- 완료 기준: desktop/mobile Playwright와 AT-012~AT-025 사용자 흐름 통과

## Phase 6 — Test
- [x] unit
- [ ] integration
- [ ] E2E
- [ ] duplicate rule tests
- [ ] load test
- [ ] security test
- [ ] OpenAPI contract test
- [ ] migration test
- [ ] backup restore rehearsal
- 완료 기준: AT-001~AT-030과 NFR gate 결과 보관

## Phase 7 — Production
- [ ] monitoring
- [ ] backup
- [ ] alerting
- [ ] deployment
- [ ] RPO/RTO rehearsal
- [ ] privacy retention jobs
- 완료 기준: staging smoke test, rollback, restore 절차 검증
