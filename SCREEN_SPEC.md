# 화면 설계

## User
1. 로그인
2. 홈
3. 모의고사 목록
4. 시험 시작 전 안내
5. 시험 화면
6. 제출 확인
7. 결과
8. 문제별 해설
9. 오답노트
10. 취약단원
11. AI 요약학습
12. 재학습

## Exam Screen
- 상단: 회차/과목/남은 시간
- 중앙: 문제/보기
- 하단: 이전/다음
- 우측/상단: 문항 네비게이션
- 답안 자동저장 상태: 저장 중/저장됨/충돌/재시도
- 제출 전 미응답 표시
- 남은 시간은 서버의 `expiresAt`을 기준으로 표시
- 시간 만료 시 저장된 답안으로 자동제출하고 결과 화면으로 이동
- 제출 전에는 정답과 해설을 DOM/API 응답에 포함하지 않음
- 키보드 문항 이동, 보기 선택, 제출 확인을 지원

## Exam List and Result
- 제1차와 제2차 탭에서 각각 1~10회차를 표시
- 미응시/진행 중/제출/만료 상태와 이어하기를 표시
- 결과는 과목별 점수, 과락, 평균, 합격 여부를 표시
- 해설은 제출 또는 만료 처리 이후에만 표시

## Admin
1. Dashboard
2. Question Bank
3. AI Generate
4. Review Queue
5. Duplicate Monitor
6. Law/Policy
7. Exam Blueprint
8. Exam Generator
9. Usage Analytics
10. Audit Log

## Admin source workflow
1. 2016~2025 원문 등록 및 checksum 중복 검사
2. 출처 URL, 발행기관, 이용조건 확인 상태 기록
3. 파싱 미리보기와 문항/보기/정답 수동 검수
4. import 실행 및 실패 행 재처리
5. AI 변형문제 생성 시 원본 문항과 모델/프롬프트 버전 연결
