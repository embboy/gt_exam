# GitHub Repository Structure

```text
gongjunggae/
├─ pom.xml
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  └─ tests/
├─ backend/
│  ├─ pom.xml
│  ├─ src/main/java/com/gtexam/
│  │  ├─ auth/
│  │  ├─ exam/
│  │  ├─ question/
│  │  ├─ wrongnote/
│  │  └─ admin/
│  ├─ src/main/resources/db/migration/
│  └─ src/test/
├─ database/
│  ├─ seeds/
│  └─ import-schemas/
├─ ai/
│  ├─ prompts/
│  ├─ validators/
│  └─ evaluators/
├─ docs/
│  ├─ openapi.yaml
│  ├─ architecture.md
│  └─ traceability.md
├─ docker/
├─ .github/
│  ├─ workflows/
│  ├─ instructions/
│  └─ skills/
├─ docker-compose.yml
└─ README.md
```

## Branch
main: production
develop: integration
feature/*: implementation
hotfix/*: production fix

## PR
PR은 반드시 REQ/FR/AT ID를 연결한다.

## Module dependency rule
- API 계약의 source of truth는 `docs/openapi.yaml`이다.
- frontend는 OpenAPI 계약만 의존하고 backend 내부 모델을 복제하지 않는다.
- backend domain은 Spring MVC/JPA 구현 세부사항에 의존하지 않는다.
- AI 결과와 import 파일은 validator를 통과한 뒤에만 database로 이동한다.
- database migration은 변경하지 않고 새 migration으로 전진한다.
