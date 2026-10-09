// 날짜는 "YYYY-MM-DD" 문자열로 다룬다. 시간대에 흔들리지 않게 UTC 자정으로만 계산한다.
import { 공휴일, 은행휴무, 자료범위 } from "./holidays.mjs";

const 하루 = 86400000;
const 요일이름 = ["일", "월", "화", "수", "목", "금", "토"];

/** @param {string} iso */
export function toDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`날짜 형식이 아니다: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) throw new Error(`없는 날짜: ${iso}`);
  return back;
}

/** @param {Date} date */
export function toIso(date) {
  return date.toISOString().slice(0, 10);
}

export const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { try { toDate(s); return true; } catch { return false; } })();

export const addDays = (iso, n) => toIso(new Date(toDate(iso).getTime() + n * 하루));
export const diffDays = (from, to) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / 하루);
export const weekday = (iso) => toDate(iso).getUTCDay();
export const weekdayName = (iso) => 요일이름[weekday(iso)];
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** "2027.1.7(목)" 꼴. 화면에 쓴다. */
export function 한글날짜(s) {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}.${m}.${d}(${weekdayName(s)})`;
}

const 공휴일표 = new Map(공휴일.map((h) => [h.date, h]));
const 은행휴무표 = new Map(은행휴무.map((h) => [h.date, h]));

export const 자료안 = (s) => s >= 자료범위.from && s <= 자료범위.to;

/** 관공서 공휴일인가. 일요일 포함. */
export function isPublicHoliday(s) {
  return weekday(s) === 0 || 공휴일표.has(s);
}

/** 형사소송법 제66조 제3항이 기간에 넣지 않는 날: 토요일과 공휴일. */
export const isOffForCriminalPeriod = (s) => weekday(s) === 6 || isPublicHoliday(s);

/** 은행 영업일: 토요일, 일요일, 공휴일, 은행 휴무일이 아닌 날. */
export const isBusinessDay = (s) => weekday(s) !== 6 && !isPublicHoliday(s) && !은행휴무표.has(s);

export function holidayName(s) {
  if (공휴일표.has(s)) return 공휴일표.get(s).name;
  if (은행휴무표.has(s)) return 은행휴무표.get(s).name;
  if (weekday(s) === 0) return "일요일";
  if (weekday(s) === 6) return "토요일";
  return null;
}

/** 두 날짜 사이에 추정 공휴일이 있거나 자료 범위를 벗어나면 그 사실을 돌려준다. */
export function holidayDataNote(from, to) {
  if (!자료안(from) || !자료안(to)) return `공휴일 자료는 ${자료범위.from.slice(0, 4)}~${자료범위.to.slice(0, 4)}년치만 있습니다. 범위 밖의 날짜에는 토요일과 일요일만 반영했습니다.`;
  const 추정 = 공휴일.filter((h) => !h.확인 && h.date >= from && h.date <= to);
  if (추정.length) return `이 기간에 있는 ${추정.map((h) => h.name).join(", ")}의 날짜는 추정값입니다.`;
  return null;
}

/**
 * 첫날을 빼고 일 단위로 센 기간의 끝날(민법 제157조, 형사소송법 제66조 제1항).
 * @returns {{ end: string, steps: string[] }}
 */
export function endOfDayPeriod(eventDate, days) {
  const start = addDays(eventDate, 1);
  const end = addDays(start, days - 1);
  return { end, steps: [`첫날을 빼고 ${한글날짜(start)}부터 셉니다.`, `${days}일째 되는 날 ${한글날짜(end)}`] };
}

/**
 * 첫날을 빼고 월 단위로 센 기간의 끝날(민법 제157조, 제160조, 형사소송법 제66조 제2항).
 * 마지막 달의 시작일에 해당하는 날의 전날에 끝나고, 해당하는 날이 없으면 그 달 말일에 끝난다.
 */
export function endOfMonthPeriod(eventDate, months) {
  const start = addDays(eventDate, 1);
  const [y, m, d] = start.split("-").map(Number);
  let ty = y;
  let tm = m + months;
  while (tm > 12) { tm -= 12; ty += 1; }
  const 말일 = daysInMonth(ty, tm);
  if (d > 말일) {
    const end = iso(ty, tm, 말일);
    return { end, steps: [`첫날을 빼고 ${한글날짜(start)}부터 셉니다.`, `${months}개월 뒤 ${tm}월에는 ${d}일이 없어 그 달 말일 ${한글날짜(end)}에 끝납니다.`] };
  }
  const 해당일 = iso(ty, tm, d);
  const end = addDays(해당일, -1);
  return { end, steps: [`첫날을 빼고 ${한글날짜(start)}부터 셉니다.`, `${months}개월 뒤 같은 날 ${한글날짜(해당일)}의 전날 ${한글날짜(end)}`] };
}

/** 끝날이 쉬는 날이면 다음 날로 넘긴다(형사소송법 제66조 제3항, 민법 제161조). */
export function rollForward(end, isOff = isOffForCriminalPeriod) {
  let d = end;
  const 넘긴날 = [];
  while (isOff(d)) {
    넘긴날.push(`${한글날짜(d)} ${holidayName(d) ?? "휴일"}`);
    d = addDays(d, 1);
  }
  const steps = 넘긴날.length ? [`끝날이 쉬는 날이라 다음 날로 넘깁니다: ${넘긴날.join(", ")}`, `마감 ${한글날짜(d)}`] : [`끝날이 토요일이나 공휴일이 아니어서 그대로 마감입니다.`];
  return { end: d, steps };
}

/** 첫날을 빼고 n번째 영업일. 은행 서류 기한에 쓴다. */
export function addBusinessDays(eventDate, n) {
  let d = eventDate;
  const 센날 = [];
  while (센날.length < n) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) 센날.push(한글날짜(d));
  }
  return { end: d, steps: [`신청한 날을 빼고 영업일만 셉니다: ${센날.join(", ")}`, `${n}번째 영업일 ${한글날짜(d)}`] };
}
