// 사건 하나. 이 기기에만 저장한다. 저장 형식이 바뀌면 판을 올리고 옮기기 규칙을 더한다.
import { 질문, 유형확인 } from "./classify.mjs";
import { 할일목록 } from "./checklist.mjs";
import { 날짜항목, 기한계산, 다음마감, 정렬 } from "./deadlines.mjs";
import { isIso } from "./dates.mjs";
import { 은행단계, 수사단계 } from "./stages.mjs";

export const 판 = 1;
export const 저장열쇠 = "gihanjigi.v1";

/** @param {string} 오늘 */
export function 새사건(오늘) {
  return { 판, 만든날: 오늘, 이름: "", 내이름: "나", 답: {}, 날짜: {}, 기록: [], 한일: [] };
}

const 기록종류 = ["대화", "송금", "통화", "문자", "사진", "기타"];
const 기록상태 = ["확인 필요", "확정"];

function 기록다듬기(r) {
  if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.일시 !== "string") return null;
  const 금액 = Number.isFinite(r.금액) && r.금액 > 0 ? r.금액 : null;
  const 계좌 = r.계좌 && typeof r.계좌.번호 === "string" ? { 은행: typeof r.계좌.은행 === "string" ? r.계좌.은행 : null, 번호: r.계좌.번호 } : null;
  return {
    id: r.id, 일시: r.일시, 종류: 기록종류.includes(r.종류) ? r.종류 : "기타",
    내용: String(r.내용 ?? ""), 보낸이: typeof r.보낸이 === "string" ? r.보낸이 : null,
    금액, 계좌, 출처: String(r.출처 ?? ""), 상태: 기록상태.includes(r.상태) ? r.상태 : "확인 필요",
  };
}

/**
 * 저장된 글을 사건으로 되돌린다. 모르는 칸과 잘못된 값은 버린다.
 * @returns {{ 사건: ReturnType<typeof 새사건>, 문제: string | null }}
 */
export function 불러오기(글, 오늘) {
  if (!글) return { 사건: 새사건(오늘), 문제: null };
  let 원본;
  try { 원본 = JSON.parse(글); } catch { return { 사건: 새사건(오늘), 문제: "저장된 사건을 읽지 못해 새 사건으로 시작합니다." }; }
  if (!원본 || typeof 원본 !== "object") return { 사건: 새사건(오늘), 문제: "저장된 사건을 읽지 못해 새 사건으로 시작합니다." };
  if (원본.판 > 판) return { 사건: 새사건(오늘), 문제: "더 새로운 판에서 저장한 사건이라 읽지 않았습니다." };

  const 답 = {};
  for (const q of 질문) {
    const v = 원본.답?.[q.id];
    if (q.선택지.some(([값]) => 값 === v)) 답[q.id] = v;
  }
  const 날짜 = {};
  for (const { id } of 날짜항목) if (isIso(원본.날짜?.[id])) 날짜[id] = 원본.날짜[id];
  const 기록 = Array.isArray(원본.기록) ? 원본.기록.map(기록다듬기).filter(Boolean) : [];
  const 한일 = Array.isArray(원본.한일) ? [...new Set(원본.한일.filter((x) => typeof x === "string"))] : [];
  return {
    사건: { 판, 만든날: isIso(원본.만든날) ? 원본.만든날 : 오늘, 이름: String(원본.이름 ?? "").slice(0, 40), 내이름: String(원본.내이름 ?? "나").slice(0, 40) || "나", 답, 날짜, 기록, 한일 },
    문제: null,
  };
}

export const 저장하기 = (사건) => JSON.stringify(사건);

/** 사건 파일(백업)로 내보낼 글. 사람이 열어 볼 수 있게 들여 쓴다. */
export const 사건파일 = (사건) => `${JSON.stringify(사건, null, 2)}\n`;

/**
 * 이용자가 고른 사건 파일을 읽는다. 기한지기 사건 파일이 아니면 읽지 않는다.
 * @returns {{ 사건: ReturnType<typeof 새사건> | null, 문제: string | null }}
 */
export function 사건파일읽기(글, 오늘) {
  let 원본;
  try { 원본 = JSON.parse(글); } catch { return { 사건: null, 문제: "사건 파일을 읽지 못했습니다. 기한지기에서 내려받은 파일인지 확인해 주십시오." }; }
  if (!원본 || typeof 원본 !== "object" || typeof 원본.판 !== "number") return { 사건: null, 문제: "기한지기 사건 파일이 아닙니다." };
  const r = 불러오기(글, 오늘);
  return r.문제 ? { 사건: null, 문제: r.문제 } : r;
}

/** 사건에서 화면에 필요한 것을 모두 계산한다. */
export function 풀이(사건, 오늘) {
  const 유형 = 유형확인(사건.답);
  const 기한 = 정렬(기한계산(유형, 사건.날짜, 사건.답, 오늘));
  return {
    유형,
    기한,
    다음: 다음마감(기한),
    할일: 할일목록(유형, 사건.답),
    은행: 유형.유형 === "보이스피싱" && 유형.지급정지 ? 은행단계(사건.날짜, 오늘) : [],
    수사: 유형.유형 === "보이스피싱" || 유형.유형 === "거래사기" ? 수사단계(사건.날짜) : [],
  };
}
