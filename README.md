# 기한지기

사기 피해를 입은 사람이 지금 할 일, 법정 기한, 제출할 증거를 정리하는 웹 시제품이다. 2026 신한 스퀘어브릿지
대학생 창업 공모전(HERO IR)에 낼 서비스를 실제로 눌러 볼 수 있게 만든 것이다.

설명 문서: [`docs/시제품-설명.md`](docs/시제품-설명.md)

## 실행

Node 24.10.0 을 쓴다. 화면과 계산 엔진은 의존성이 없다.

    npm start                 # http://127.0.0.1:4310/
    # http://127.0.0.1:4310/?today=2026-10-09   기준일을 고정해서 볼 때

## 검사

    npm ci
    npm test                  # 엔진 검사 69건 (node:test)
    npm run check:browser     # 휴대폰 320px, 390px, PC 1280px 흐름 점검과 axe
    npm run verify            # 둘 다

화면 점검은 `playwright-core` 와 `axe-core` 를 쓰고 브라우저는 따로 받지 않는다. 크로미움이나 크롬의 위치를
`CHROMIUM` 환경 변수로 넘긴다. GitHub Actions 는 러너에 깔린 구글 크롬을 쓴다.

## 배포

Vercel 에 `src/` 를 그대로 올린다. GitHub Actions 의 `deploy` 워크플로를 `main` 에서 손으로 돌릴 때만 배포되고,
건마다 의뢰인 승인을 받는다. 처음 한 번 할 일과 시크릿은 [`docs/배포.md`](docs/배포.md) 에 적었다.

## 구조

    src/engine/   계산 규칙. 브라우저와 Node 에서 그대로 돈다.
      holidays.mjs   2026~2027년 공휴일(음력 날짜는 추정 표시)과 은행 휴무일
      dates.mjs      기간 계산(첫날 빼기, 월 단위, 말일 넘기기, 영업일)
      law.mjs        근거 조문, 요지, 원문 대조 여부, 국가법령정보센터 주소
      classify.mjs   유형 확인 질문과 규칙
      deadlines.mjs  기한 규칙 11개
      checklist.mjs  유형별 지금 할 일
      stages.mjs     은행 피해구제와 수사 단계
      evidence.mjs   카카오톡 대화와 은행 거래내역 읽기, 증거 목록
      ics.mjs        달력 파일(.ics)
      case.mjs       사건 저장과 불러오기
    src/ui/       화면. 엔진을 불러 쓰는 바닐라 자바스크립트
    test/         엔진 검사
    scripts/      정적 서버와 화면 점검
    docs/         설명 문서

## 지켜야 할 것

`CLAUDE.md` 에 적었다. 사건 기록은 이용자 기기 밖으로 보내지 않고, 배포와 유료 API 는 건마다 승인을 받는다.
