# REST API Specification

모든 JSON API는 `application/json`, UTC ISO-8601 시각, Bearer access token을 사용한다.
관리자 API는 역할을 검사하며 모든 `{userExamId}` API는 소유권을 검사한다.
상세 schema와 예시는 구현 저장소의 `docs/openapi.yaml`을 source of truth로 사용한다.

## Auth
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout

## Exams
GET /api/v1/exams
GET /api/v1/exams/{examId}
POST /api/v1/exams/{examId}/start
GET /api/v1/user-exams/{userExamId}
POST /api/v1/user-exams/{userExamId}/sessions/{sessionNo}/start
POST /api/v1/user-exams/{userExamId}/answers
POST /api/v1/user-exams/{userExamId}/sessions/{sessionNo}/submit
POST /api/v1/user-exams/{userExamId}/submit
GET /api/v1/user-exams/{userExamId}/result

### Exam rules
- `start`는 같은 사용자와 시험에 대해 진행 중 응시가 있으면 이를 반환한다.
- 시험 시작 응답은 교시 목록, 저장된 답안과 문항 버전을 포함한다.
- 교시 시작 응답은 서버 기준 `startedAt`과 `expiresAt`을 포함한다.
- 문항 조회 응답은 제출 전 `correctAnswer`와 `explanation`을 포함하지 않는다.
- 답안 저장은 `requestId`와 `expectedVersion`을 받아 재시도와 동시 수정을 제어한다.
- `submit`은 `Idempotency-Key`를 필수로 받고 반복 호출에 동일한 결과를 반환한다.
- 만료 시 서버가 `EXPIRED`로 전환하고 저장된 답안만 채점한다.
- 결과는 과목별 점수, 평균, 과락 여부, 합격 여부를 포함한다.

## Wrong Note
GET /api/v1/me/wrong-notes
GET /api/v1/me/wrong-notes/summary
POST /api/v1/me/wrong-notes/{questionId}/review

## Questions Admin
GET /api/v1/admin/questions
POST /api/v1/admin/questions
GET /api/v1/admin/questions/{questionId}
PATCH /api/v1/admin/questions/{questionId}
POST /api/v1/admin/questions/{questionId}/review
POST /api/v1/admin/questions/{questionId}/approve
POST /api/v1/admin/questions/{questionId}/retire

## Source Import Admin
POST /api/v1/admin/source-documents
POST /api/v1/admin/source-documents/{sourceDocumentId}/verify-rights
POST /api/v1/admin/source-documents/{sourceDocumentId}/imports
GET /api/v1/admin/import-jobs/{jobId}

## AI
POST /api/v1/admin/ai/questions/generate
POST /api/v1/admin/ai/questions/validate
POST /api/v1/admin/ai/similarity/check

## Exam Generator
POST /api/v1/admin/exams/generate
POST /api/v1/admin/exams/{examId}/validate
POST /api/v1/admin/exams/{examId}/publish

## Operations Admin
GET /api/v1/admin/audit-logs
GET /api/v1/admin/question-usage
GET /api/v1/admin/laws
POST /api/v1/admin/laws
POST /api/v1/admin/laws/{lawId}/versions

## Common status codes
- `200`: 조회, 멱등 재호출 성공
- `201`: 리소스 생성
- `202`: 비동기 AI/수집 작업 접수
- `400`: schema 또는 상태 전이 오류
- `401`: 인증 실패
- `403`: 역할 또는 소유권 위반
- `404`: 리소스 없음
- `409`: 중복, 버전 충돌, 이미 제출된 응시
- `422`: 문항 수, 승인, 법령 기준일, 품질 검증 실패
- `429`: 호출 한도 초과

## Error format
{
  "code":"QUESTION_DUPLICATE",
  "message":"...",
  "traceId":"...",
  "fieldErrors":[]
}

오류 코드는 최소 `VALIDATION_FAILED`, `FORBIDDEN`, `VERSION_CONFLICT`,
`EXAM_EXPIRED`, `EXAM_ALREADY_SUBMITTED`, `QUESTION_NOT_IN_EXAM`,
`QUESTION_DUPLICATE`, `QUESTION_NOT_APPROVED`, `LEGAL_DATE_INVALID`를 제공한다.
