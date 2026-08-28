# Repository Agent Guide

1. 작업 전 `README.md`, `PRD.md`, `SRS.md`, `docs/architecture.md`, 관련 AT를 읽는다.
2. 변경에는 BR/FR/AT ID를 연결하고 `docs/traceability.md`를 갱신한다.
3. 정답과 해설을 제출 전 사용자 DTO에 포함하지 않는다.
4. 시험 시간은 서버의 교시별 `expiresAt`으로 판정한다.
5. 공식 publish는 승인, 40문항, hash, semantic block, 법령 기준일, 기사용 여부를 transaction 안에서 검증한다.
6. Flyway migration은 적용 후 수정하지 않고 새 version으로 전진한다.
7. 기출 원문은 출처와 이용조건 확인 전 import 또는 공개하지 않는다.
8. AI 출력은 schema와 validator를 통과해도 사람 승인 전에는 `DRAFT`다.

## Validation commands
- Backend: `mvn verify`
- AI validator: `python -m unittest discover -s ai/validators -p "test_*.py"`
- Frontend: `npm --prefix frontend run typecheck && npm --prefix frontend run build`
- Infrastructure: `docker compose config`
