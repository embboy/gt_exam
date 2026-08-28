# Source Verification Standard

## Authority order

1. 법령: 국가법령정보센터의 법령별 현행본과 해당 시험 기준일의 연혁본
2. 시험 시행: Q-Net 공인중개사 해당 연도 시행공고와 시험안내
3. 기출 정답: Q-Net의 해당 회차 최종정답 PDF
4. 기출 문제: Q-Net의 해당 회차 문제지 PDF

검색 결과, 강의 자료, 블로그, OCR 텍스트는 검수 보조 자료일 뿐 1차 근거가 아니다.

## Required evidence

법령 또는 정책을 포함한 문항은 연결된 `law_version`에 다음 정보를 갖춰야 한다.

- 국가법령정보센터 원문 URL
- 시행 시작일과 종료일
- 원문 SHA-256
- 관리자 확인 시각과 확인자

기출 문항의 정답은 Q-Net 최종정답 PDF의 `source_document`와 페이지 좌표를 연결한다.
스캔 PDF의 OCR 결과만으로는 정답을 확정할 수 없으며, 원본 화면 확인을 마친 검수자의
승인이 있어야 한다.

## Publish gate

시험 기준일에 유효하지 않은 법령 version, 검증되지 않은 시행공고, 또는 검수되지 않은
정답 근거가 연결된 문항은 `APPROVED` 또는 `PUBLISHED` 상태가 될 수 없다. 원문이 변경되면
기존 레코드를 수정하지 않고 새 source/law version을 추가한다.

## 2026 baseline sources

- Q-Net 2026 공인중개사 시행공고: `https://www.q-net.or.kr/crf002.do?gId=08&gSite=L&id=crf00201`
- Q-Net 공인중개사 시험안내: `https://www.q-net.or.kr/man001.do?gId=08&gSite=L`
- 국가법령정보센터 공인중개사법: `https://www.law.go.kr/법령/공인중개사법`
- 국가법령정보센터 공인중개사법 시행령: `https://www.law.go.kr/법령/공인중개사법시행령`
- 국가법령정보센터 공인중개사법 시행규칙: `https://www.law.go.kr/법령/공인중개사법시행규칙`

위 URL은 수집 시점에 다시 열어 원문과 checksum을 등록한다. URL 존재만으로 최신성이나
내용 정확성이 확인된 것은 아니다.