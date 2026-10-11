// 날짜 계산의 기본 규칙. 공휴일, 월말, 영업일을 사례로 맞춘다.
import test from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays, endOfDayPeriod, endOfMonthPeriod, holidayDataNote, isBusinessDay, isIso, isOffForCriminalPeriod,
  rollForward, toDate, 한글날짜,
} from "../src/engine/dates.mjs";
import { 공휴일 } from "../src/engine/holidays.mjs";

test("없는 날짜와 형식이 틀린 날짜는 받지 않는다", () => {
  assert.throws(() => toDate("2027-02-29"));
  assert.throws(() => toDate("2026/10/09"));
  assert.equal(isIso("2026-13-01"), false);
  assert.equal(isIso("2028-02-29"), true);
});

test("한글 날짜에 요일을 붙인다", () => {
  assert.equal(한글날짜("2027-01-07"), "2027.1.7(목)");
  assert.equal(한글날짜("2026-10-05"), "2026.10.5(월)");
});

test("2026년 10월 5일은 개천절 대체공휴일이다", () => {
  assert.equal(isOffForCriminalPeriod("2026-10-05"), true);
  assert.equal(isBusinessDay("2026-10-05"), false);
  assert.equal(isBusinessDay("2026-10-06"), true);
});

test("2026년 개정으로 노동절과 제헌절이 공휴일이고, 주말과 겹치면 대체공휴일이 생긴다", () => {
  assert.equal(isOffForCriminalPeriod("2026-05-01"), true);
  assert.equal(isOffForCriminalPeriod("2026-07-17"), true);
  assert.equal(isBusinessDay("2026-07-17"), false);
  assert.equal(isOffForCriminalPeriod("2027-05-03"), true); // 노동절이 토요일
  assert.equal(isOffForCriminalPeriod("2027-07-19"), true); // 제헌절이 토요일
  assert.equal(rollForward("2027-07-17").end, "2027-07-20");
});

test("공휴일 자료에 같은 날짜가 두 번 들어 있지 않다", () => {
  const 날짜들 = 공휴일.map((h) => h.date);
  assert.equal(new Set(날짜들).size, 날짜들.length);
  for (const d of 날짜들) assert.ok(isIso(d), d);
});

test("일 단위 기간은 첫날을 빼고 센다", () => {
  assert.equal(endOfDayPeriod("2026-10-02", 30).end, "2026-11-01");
  assert.equal(endOfDayPeriod("2026-12-17", 14).end, "2026-12-31");
});

test("월 단위 기간은 해당하는 날의 전날에 끝난다", () => {
  assert.equal(endOfMonthPeriod("2026-10-07", 3).end, "2027-01-07");
  assert.equal(endOfMonthPeriod("2026-10-31", 3).end, "2027-01-31");
  assert.equal(endOfMonthPeriod("2026-11-30", 3).end, "2027-02-28");
});

test("해당하는 날이 없는 달에서는 말일에 끝난다", () => {
  // 11월 29일 통지: 11월 30일부터 세어 3개월 뒤 2월 30일이 없다
  const r = endOfMonthPeriod("2026-11-29", 3);
  assert.equal(r.end, "2027-02-28");
  assert.match(r.steps.join(" "), /말일/);
});

test("끝날이 토요일, 일요일, 공휴일이면 다음 날로 넘긴다", () => {
  assert.equal(rollForward("2027-02-28").end, "2027-03-02"); // 일요일, 삼일절
  assert.equal(rollForward("2027-01-31").end, "2027-02-01");
  assert.equal(rollForward("2026-10-03").end, "2026-10-06"); // 개천절, 일요일, 대체공휴일
  assert.equal(rollForward("2027-01-07").end, "2027-01-07");
});

test("3영업일은 신청한 날을 빼고 주말과 공휴일을 건너뛴다", () => {
  const r = addBusinessDays("2026-10-02", 3);
  assert.equal(r.end, "2026-10-08");
  assert.match(r.steps[0], /2026\.10\.6\(화\), 2026\.10\.7\(수\), 2026\.10\.8\(목\)/);
  assert.equal(addBusinessDays("2026-09-23", 3).end, "2026-09-30"); // 추석 연휴
  assert.equal(addBusinessDays("2026-04-29", 3).end, "2026-05-06"); // 노동절, 어린이날
});

test("자료 범위를 벗어나면 밝히고, 확인한 공휴일만 걸리면 아무것도 붙이지 않는다", () => {
  assert.equal(holidayDataNote("2026-12-20", "2027-03-29"), null); // 2027년 설날은 월력요항으로 확인했다
  assert.equal(holidayDataNote("2026-10-07", "2027-01-14"), null);
  assert.match(holidayDataNote("2027-11-01", "2028-02-01"), /2026~2027년치/);
});
