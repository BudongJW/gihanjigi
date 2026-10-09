# 기한지기 시제품

사기 피해를 입은 사람이 지금 할 일, 법정 기한, 제출할 증거를 정리하는 웹 시제품이다. 2026 신한 스퀘어브릿지
대학생 창업 공모전(HERO IR)에 낼 서비스를 실제로 눌러 볼 수 있게 만든 것이다. 살핀(Salpin) 제품과는 별개다.

설명 문서: `docs/strategy/2026-10-09-기한지기-시제품.md`

## 실행

의존성이 없다. 정적 파일 서버로 `src/` 를 열면 된다.

    npm start            # python3 -m http.server 4310 --directory src
    # http://127.0.0.1:4310/          오늘 날짜 기준
    # http://127.0.0.1:4310/?today=2026-10-09   기준일 고정

## 검사

    npm test                          # 엔진 검사 61건 (node:test)
    node scripts/browser-check.mjs    # 휴대폰 390px, PC 1280px 흐름 점검과 axe

`browser-check.mjs` 는 저장소 루트의 `playwright-core` 와 `axe-core` 를 빌려 쓴다. 저장소 루트에서
`npm ci` 를 한 뒤에 돌린다. 크로미움 위치는 `CHROMIUM` 환경 변수로 바꿀 수 있다.

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
    scripts/      화면 점검

## 지켜야 할 것

- 사건 기록은 이 기기의 브라우저(localStorage, 열쇠 `gihanjigi.v1`)에만 둔다. 서버로 보내는 코드를 넣지 않는다.
- 사진 속 글자 읽기(AI)는 연결하지 않았다. 유료 API 를 붙이려면 의뢰인 승인이 먼저다.
- 배포하기 전에 별도 저장소로 옮긴다. 이 저장소는 살핀 제품의 저장소다.
- 화면 문구는 「~습니다」체로 쓰고, 엠대시와 가운뎃점을 쓰지 않는다.
