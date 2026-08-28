# Copilot Instructions

- Follow `AGENTS.md` and the requirement IDs in `PRD.md`, `SRS.md`, and `ACCEPTANCE_TESTS.md`.
- Treat `docs/openapi.yaml` as the API contract and Flyway files as the runtime database history.
- Keep domain rules in application/domain services, backed by database constraints where possible.
- Add focused tests for every state transition, ownership check, idempotency rule, and publish invariant.
- Do not weaken tests, expose answers before submission, or import unverified source material.
