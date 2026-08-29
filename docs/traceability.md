# Requirements Traceability

| Requirement | Design | Initial implementation | Acceptance |
|---|---|---|---|
| BR-001, BR-009, BR-016, BR-017 | `subject`, `mock_exam`, `mock_exam_session`, composition policy | Generated exams use difficulty quotas and atomic publish. Historical-paper practice is explicitly marked, retains the original PDF, and its dedicated importer atomically verifies 80 links and 40 questions per Stage 1 subject before publication. | AT-004, AT-005 |
| BR-002, BR-003 | official partial unique index, hash unique | global official-slot unique index and transactional `composeAndPublish` | AT-006, AT-010 |
| BR-004, BR-005 | similarity decision, question status | transactional `composeAndPublish` excludes `BLOCK` pairs and non-approved candidates | AT-007, AT-008 |
| BR-007 | version reference date and law versions | target schema, source/version evidence required; validator port pending | AT-008 |
| BR-008, BR-015 | transactional publish service | generator/validator implemented, transaction adapter pending | AT-009 |
| BR-010 | immutable `question_version` | V1 migration | AT-011 |
| BR-011 | `user_exam_question` membership FK | V3 migration | AT-014 |
| BR-012, BR-013 | per-session server expiry | server expiry, start/save/submit 구현; stage 2 다음 session start transition pending | AT-012, AT-018, AT-019 |
| FR-001, NFR-005, NFR-006 | signup/login/password routes, bcrypt hash, `AUTH_SECRET` | email/password login and signup; 8~128 password validation; authenticated current-password verification and password change; bcrypt hash and JWT signing implemented | authentication route test pending |
| BR-014, FR-021, FR-022 | source rights gate and review staging | User-provided PDF checksum manifest, native-text-first/OCR-fallback page extraction, per-question review draft, reviewer queue, admin promotion API and review UI implemented; ZIP/Q-Net source data removed. Historical-paper imports link each version to a reviewed Q-Net official final-answer evidence item. | AT-001~AT-003 |
| FR-007, FR-027 | score and pass policy | `ScoreCalculator`; paper-practice scoring accepts every verified official final-answer value, including multi-answer corrections, only after submission | AT-020 |
| FR-009~FR-012 | wrong history/note and learning | submit transaction writes wrong history/note; owner-scoped wrong-note query/review API and UI implemented | AT-022~AT-025 |
| FR-020 | append-only audit log | V3 migration; question promotion and compose/publish writes implemented | AT-026 |
| Deployment constraint | Vercel runtime and controlled release | pooled runtime DB URL, GitHub Flyway-before-Vercel release workflow | production secret and Vercel project configuration required |

`pending` 항목은 구현되지 않은 기능을 의미하며 API가 완료된 것으로 간주하지 않는다.
