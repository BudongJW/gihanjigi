// 사건 기록. 카카오톡 대화 내보내기 파일과 은행 거래내역 CSV 를 읽어 시간순 기록을 만든다.
// 읽은 금액과 계좌는 모두 "확인 필요" 로 두고, 이용자가 확정해야 증거 목록에 들어간다.
// 이미지 속 글자 읽기(AI)는 이 시제품에 연결하지 않았다. 이미지는 파일 이름만 기록한다.

const 은행이름 = [
  "KB국민", "국민", "신한", "우리", "하나", "NH농협", "농협", "IBK기업", "기업", "카카오뱅크", "케이뱅크", "토스뱅크",
  "새마을금고", "우체국", "수협", "신협", "SC제일", "제일", "씨티", "부산", "대구", "iM뱅크", "경남", "광주", "전북", "제주", "산업",
];

const BOM = /^﻿/;

/** "오후 2:05" → "14:05" */
function 시각(오전오후, 시, 분) {
  let h = Number(시) % 12;
  if (오전오후 === "오후") h += 12;
  return `${String(h).padStart(2, "0")}:${String(분).padStart(2, "0")}`;
}
const 날짜문자 = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * CSV 글 전체를 행으로 나눈다. 큰따옴표 안의 쉼표와 줄바꿈을 지킨다.
 * @returns {{ 칸: string[], 줄: number }[]} 줄은 그 행이 시작한 줄 번호
 */
function CSV행들(글, 구분) {
  const 행들 = [];
  let 칸 = [];
  let 지금 = "";
  let 따옴표 = false;
  let 줄 = 1;
  let 시작줄 = 1;
  const 행끝 = () => {
    칸.push(지금.trim());
    if (칸.some((c) => c !== "")) 행들.push({ 칸, 줄: 시작줄 });
    칸 = [];
    지금 = "";
    시작줄 = 줄;
  };
  for (let i = 0; i < 글.length; i++) {
    const c = 글[i];
    if (c === '"') {
      if (따옴표 && 글[i + 1] === '"') { 지금 += '"'; i++; } else 따옴표 = !따옴표;
    } else if (c === 구분 && !따옴표) {
      칸.push(지금.trim());
      지금 = "";
    } else if ((c === "\n" || c === "\r") && !따옴표) {
      if (c === "\r" && 글[i + 1] === "\n") i++;
      줄 += 1;
      행끝();
    } else {
      if (c === "\n") 줄 += 1;
      지금 += c;
    }
  }
  if (지금 !== "" || 칸.length) 행끝();
  return 행들;
}

const 카톡CSV머리 = /^\s*"?(Date|날짜)"?\s*,\s*"?(User|사용자|이름)"?\s*,\s*"?(Message|메시지|내용)"?\s*$/i;

/** Mac 카카오톡이 내보낸 CSV(Date,User,Message). 날짜는 "2026-10-03 14:05:00" 꼴이다. */
function 카톡CSV읽기(글) {
  const 메시지 = [];
  for (const { 칸, 줄 } of CSV행들(글, ",").slice(1)) {
    const m = String(칸[0] ?? "").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})\D+(\d{1,2}):(\d{2})/);
    if (!m) continue;
    메시지.push({ 일시: `${날짜문자(m[1], m[2], m[3])}T${m[4].padStart(2, "0")}:${m[5]}`, 보낸이: 칸[1] ?? "", 내용: 칸[2] ?? "", 줄 });
  }
  return 메시지;
}

/**
 * 카카오톡 대화 내보내기 텍스트를 메시지 목록으로 바꾼다.
 * 휴대폰 형식("2026년 10월 3일 오후 2:05, 판매자 : 내용", "2026. 10. 3. 오후 2:05, 판매자 : 내용"),
 * PC 형식("--- 2026년 10월 3일 토요일 ---" 다음 "[판매자] [오후 2:05] 내용"), Mac 의 CSV 형식(Date,User,Message)을 읽는다.
 * @returns {{ 일시: string, 보낸이: string, 내용: string, 줄: number }[]}
 */
export function 카톡읽기(text) {
  const 원문 = String(text ?? "").replace(BOM, "");
  if (카톡CSV머리.test(원문.split(/\r?\n/, 1)[0])) return 카톡CSV읽기(원문);
  const 줄들 = 원문.split(/\r?\n/);
  const 휴대폰 = /^(\d{4})[년.]\s*(\d{1,2})[월.]\s*(\d{1,2})[일.]?\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s?(.*)$/;
  const 날짜줄 = /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*?-+$/;
  const PC = /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s?(.*)$/;
  const 메시지 = [];
  let 오늘 = null;
  줄들.forEach((줄, i) => {
    let m = 줄.match(휴대폰);
    if (m) {
      메시지.push({ 일시: `${날짜문자(m[1], m[2], m[3])}T${시각(m[4], m[5], m[6])}`, 보낸이: m[7], 내용: m[8], 줄: i + 1 });
      return;
    }
    m = 줄.match(날짜줄);
    if (m) { 오늘 = 날짜문자(m[1], m[2], m[3]); return; }
    m = 줄.match(PC);
    if (m && 오늘) {
      메시지.push({ 일시: `${오늘}T${시각(m[2], m[3], m[4])}`, 보낸이: m[1], 내용: m[5], 줄: i + 1 });
      return;
    }
    // 앞 메시지에 이어지는 줄. 머리말(저장한 날짜 등)은 메시지가 생기기 전이라 버린다.
    if (메시지.length && 줄.trim()) 메시지[메시지.length - 1].내용 += `\n${줄}`;
  });
  return 메시지;
}

/** 가져온 파일이 대화인지 거래내역인지 정한다. */
export function 글종류(글, 이름 = "") {
  const 첫줄들 = String(글 ?? "").replace(BOM, "").split(/\r?\n/).slice(0, 5);
  if (카톡CSV머리.test(첫줄들[0] ?? "")) return "대화";
  if (/\.(csv|tsv)$/i.test(이름) || /거래일|출금|입금/.test(첫줄들.join(" "))) return "거래내역";
  return "대화";
}

const 숫자 = (v) => Number(String(v).replace(/,/g, ""));

/** 글에서 원 단위 금액 후보를 찾는다. "350,000원", "₩350,000", "35만원", "1,200만원", "3만5천원", "5천원" */
export function 금액찾기(text) {
  const 결과 = [];
  const s = String(text ?? "");
  for (const m of s.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)) {
    const 앞 = s.slice(Math.max(0, m.index - 1), m.index);
    if (/[만천]/.test(앞)) continue;
    결과.push(숫자(m[1]));
  }
  for (const m of s.matchAll(/₩\s*(\d{1,3}(?:,\d{3})+|\d+)/g)) 결과.push(숫자(m[1]));
  for (const m of s.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*만\s*(?:(\d+)\s*천)?\s*원?/g)) {
    결과.push(숫자(m[1]) * 10000 + (m[2] ? Number(m[2]) * 1000 : 0));
  }
  for (const m of s.matchAll(/(?<![만\d])(\d+)\s*천\s*원/g)) 결과.push(Number(m[1]) * 1000);
  return [...new Set(결과)].filter((n) => n > 0);
}

/** 글에서 은행 이름과 계좌번호 후보를 찾는다. 가린 자리(*)가 있어도 읽는다. */
export function 계좌찾기(text) {
  const s = String(text ?? "");
  const 결과 = [];
  const 번호 = /(\d[\d*]{1,6}(?:-[\d*]{1,8}){1,3}|\d{10,14})/g;
  for (const m of s.matchAll(번호)) {
    const 앞글 = s.slice(Math.max(0, m.index - 14), m.index);
    const 은행 = 은행이름.find((b) => 앞글.includes(b) || 앞글.includes(`${b}은행`)) ?? null;
    const 숫자만 = m[1].replace(/[^\d*]/g, "");
    if (숫자만.length < 10 && !은행) continue;
    // 휴대폰 번호는 은행 이름이 바로 앞에 있을 때만 계좌로 본다(휴대폰 번호 계좌)
    if (!은행 && /^01[016789]-?\d{3,4}-?\d{4}$/.test(m[1])) continue;
    결과.push({ 은행: 은행 ? (은행.endsWith("은행") || 은행.endsWith("뱅크") || 은행.endsWith("금고") || 은행.endsWith("국") ? 은행 : `${은행}은행`) : null, 번호: m[1] });
  }
  return 결과;
}

const 머리이름 = {
  일시: ["거래일시", "거래일자", "일시", "거래일", "날짜", "일자"],
  시간: ["거래시간", "시간", "시각"],
  출금: ["출금액", "출금", "찾으신금액", "보낸금액", "지급액"],
  입금: ["입금액", "입금", "맡기신금액", "받은금액"],
  금액: ["거래금액", "금액"],
  구분: ["구분", "거래구분", "입출금구분", "입출금"],
  내용: ["적요", "내용", "거래내용", "기재내용", "메모"],
  상대: ["받는분", "보낸분", "보낸분/받는분", "받는분/보낸분", "상대방", "상대계좌", "상대예금주", "의뢰인", "수취인", "거래처"],
  잔액: ["잔액", "거래후잔액"],
};

const 금액값 = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function 일시값(일자, 시간) {
  const m = String(일자 ?? "").match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const t = m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : (String(시간 ?? "").match(/(\d{1,2}):(\d{2})/)?.slice(1).map((x) => x.padStart(2, "0")).join(":") ?? null);
  return `${날짜문자(m[1], m[2], m[3])}${t ? `T${t}` : ""}`;
}

/**
 * 은행 거래내역 CSV 를 읽는다. 은행마다 칸 이름이 달라 자주 쓰는 이름을 찾아 맞춘다.
 * 출금과 입금 칸이 따로 있는 파일과, 거래금액 한 칸에 부호나 구분(출금, 입금)으로 적은 파일을 모두 읽는다.
 * @returns {{ 거래: { 일시: string, 출금: number, 입금: number, 내용: string, 상대: string, 줄: number }[], 못읽음: string | null }}
 */
export function 거래내역읽기(text) {
  const 글 = String(text ?? "").replace(BOM, "");
  const 구분자 = 글.split(/\r?\n/, 5).some((l) => l.includes("\t")) ? "\t" : ",";
  const 행들 = CSV행들(글, 구분자);
  const 정리 = (h) => h.replace(/[\s()원]/g, "");
  const 있나 = (칸, 이름들) => 칸.some((c) => 이름들.includes(c));
  const 머리행 = 행들.findIndex(({ 칸 }) => {
    const 이름 = 칸.map(정리);
    return 있나(이름, 머리이름.일시) && (있나(이름, 머리이름.출금) || 있나(이름, 머리이름.입금) || 있나(이름, 머리이름.금액));
  });
  if (머리행 < 0) return { 거래: [], 못읽음: "거래일시와 금액 칸을 찾지 못했습니다. 은행 앱에서 내려받은 원본 파일인지 확인해 주십시오." };
  const 머리 = 행들[머리행].칸.map(정리);
  const 자리 = Object.fromEntries(Object.entries(머리이름).map(([k, 이름들]) => [k, 머리.findIndex((h) => 이름들.includes(h))]));
  const 칸값 = (칸, k) => (자리[k] >= 0 ? 칸[자리[k]] ?? "" : "");
  const 거래 = [];
  for (const { 칸, 줄 } of 행들.slice(머리행 + 1)) {
    const 일시 = 일시값(칸값(칸, "일시"), 자리.시간 >= 0 ? 칸값(칸, "시간") : null);
    if (!일시) continue;
    let 출금 = Math.abs(금액값(칸값(칸, "출금")));
    let 입금 = Math.abs(금액값(칸값(칸, "입금")));
    if (자리.출금 < 0 && 자리.입금 < 0) {
      const 값 = 금액값(칸값(칸, "금액"));
      const 갈래 = 칸값(칸, "구분");
      if (/출금|지급/.test(갈래) || (!/입금/.test(갈래) && 값 < 0)) 출금 = Math.abs(값);
      else 입금 = Math.abs(값);
    }
    거래.push({ 일시, 출금, 입금, 내용: 칸값(칸, "내용"), 상대: 칸값(칸, "상대"), 줄 });
  }
  return { 거래, 못읽음: null };
}

let 순번 = 0;
const 새번호 = () => `e${Date.now().toString(36)}${(순번++).toString(36)}`;

/** 카카오톡 메시지를 기록 항목으로. 금액이나 계좌가 보이면 확인 필요로 둔다. */
export function 대화를기록으로(메시지들, 파일이름) {
  return 메시지들.map((m) => {
    const 금액 = 금액찾기(m.내용);
    const 계좌 = 계좌찾기(m.내용);
    return {
      id: 새번호(), 일시: m.일시, 종류: "대화", 내용: m.내용, 보낸이: m.보낸이,
      금액: 금액[0] ?? null, 계좌: 계좌[0] ?? null,
      출처: `${파일이름} ${m.줄}번째 줄`,
      상태: 금액.length || 계좌.length ? "확인 필요" : "확정",
    };
  });
}

/** 거래내역의 출금 거래를 송금 기록 항목으로. 금액은 원본 숫자라 확정, 받는 쪽 정보는 확인 필요. */
export function 거래를기록으로(거래들, 파일이름) {
  return 거래들.filter((t) => t.출금 > 0).map((t) => ({
    id: 새번호(), 일시: t.일시, 종류: "송금", 내용: t.내용 || "출금", 보낸이: null,
    금액: t.출금, 계좌: 계좌찾기(t.상대)[0] ?? (t.상대 ? { 은행: null, 번호: t.상대 } : null),
    출처: `${파일이름} ${t.줄}번째 줄`, 상태: "확인 필요",
  }));
}

/** 이용자가 직접 넣는 항목 */
export function 직접기록({ 일시, 종류 = "기타", 내용 = "", 금액 = null, 계좌 = null }) {
  return { id: 새번호(), 일시, 종류, 내용, 보낸이: null, 금액, 계좌, 출처: "직접 입력", 상태: "확정" };
}

export const 시간순 = (기록) => [...기록].sort((a, b) => String(a.일시).localeCompare(String(b.일시)));

/**
 * 제출용 증거 목록. 확정한 항목만 넣는다.
 * @param {"은행" | "경찰"} 용도
 * @param {string} 내이름 대화 파일에서 피해자 본인을 가리키는 이름. 상대방 목록에서 뺀다.
 */
export function 증거목록(기록, 용도, 유형, 내이름 = "나") {
  const 확정 = 시간순(기록.filter((r) => r.상태 === "확정"));
  const 송금인가 = (r) => r.종류 === "송금" || Boolean(r.금액 && r.계좌);
  const 송금 = 확정.filter(송금인가);
  const 합계 = 송금.reduce((n, r) => n + (r.금액 ?? 0), 0);
  const 없음 = "확정한 기록이 없습니다. 사건 기록 화면에서 항목을 확인하고 확정해 주십시오.";
  if (용도 === "은행") {
    return {
      제목: "은행 제출용 피해 내역",
      항목: 송금.map((r) => ({ 일시: r.일시, 금액: r.금액, 계좌: r.계좌, 내용: r.내용 })),
      합계,
      첨부: ["피해구제 신청서(은행 서식)", "사건사고사실확인원(경찰서 발급)", "신분증 사본", "송금 확인증이나 거래내역서"],
      빠진것: 확정.length === 0 ? [없음]
        : 송금.length === 0 ? ["확정한 송금 기록이 없습니다. 거래내역 파일을 가져오거나 송금을 직접 넣고 확정해 주십시오."] : [],
    };
  }
  const 상대 = [...new Set(확정.map((r) => r.보낸이).filter((n) => n && n !== 내이름))];
  return {
    제목: "경찰 제출용 사건 경위",
    항목: 확정.map((r) => ({ 일시: r.일시, 종류: r.종류, 내용: r.내용, 금액: r.금액, 계좌: r.계좌, 출처: r.출처, 송금: 송금인가(r) })),
    합계,
    상대방: { 이름: 상대, 계좌: [...new Set(송금.map((r) => r.계좌 && `${r.계좌.은행 ?? ""} ${r.계좌.번호}`.trim()).filter(Boolean))] },
    첨부: 유형 === "거래사기"
      ? ["대화 내보내기 파일 원본", "판매 게시글 화면", "송금 확인증이나 거래내역서", "판매자 계정 정보 화면"]
      : ["통화 목록과 문자 화면", "송금 확인증이나 거래내역서", "받은 서류나 링크 화면"],
    빠진것: 확정.length === 0 ? [없음] : [],
  };
}
