// 달력 파일(.ics). 날짜가 계산된 마감과 가능일을 종일 일정으로 내보낸다.
// RFC 5545: 줄 끝은 CRLF, 한 줄은 75옥텟 안, 글 속 쉼표와 세미콜론과 역슬래시와 줄바꿈은 이스케이프한다.
import { addDays, 한글날짜 } from "./dates.mjs";
import { 조문표시 } from "./law.mjs";

/** 알림을 거는 시점. 종일 일정은 그날 0시가 기준이다. */
export const 알림시점 = [
  { 값: "-P30D", 일: 30 },
  { 값: "-P7D", 일: 7 },
  { 값: "-P1D", 일: 1 },
];

const 날짜값 = (s) => s.replaceAll("-", "");

export function 이스케이프(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 75옥텟이 넘는 줄을 접는다. 한글 한 글자(3옥텟)가 두 줄로 갈리지 않게 글자 단위로 자른다. */
export function 줄접기(줄) {
  const 인코더 = new TextEncoder();
  const 조각 = [];
  let 지금 = "";
  let 길이 = 0;
  let 한도 = 75;
  for (const 글자 of 줄) {
    const n = 인코더.encode(글자).length;
    if (길이 + n > 한도) {
      조각.push(지금);
      지금 = "";
      길이 = 0;
      한도 = 74; // 이어지는 줄은 맨 앞 공백 한 칸을 뺀다
    }
    지금 += 글자;
    길이 += n;
  }
  조각.push(지금);
  return 조각.join("\r\n ");
}

/** "20261009T090000Z" 꼴 */
const 찍은시각 = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * @param {import("./deadlines.mjs").기한[]} 기한목록
 * @param {{ 오늘: string, 만든시각: Date, 사건이름?: string }} 설정
 * @returns {{ 내용: string, 개수: number }}
 */
export function 일정파일(기한목록, { 오늘, 만든시각, 사건이름 = "" }) {
  const 대상 = 기한목록.filter((k) => k.알림 && k.날짜 && k.상태 === "계산됨" && k.날짜 >= 오늘 && (k.종류 === "마감" || k.종류 === "가능일"));
  const 줄 = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//gihanjigi//prototype//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const k of 대상) {
    const 머리 = k.종류 === "마감" ? "마감" : "가능";
    const 설명 = [
      k.종류 === "마감" ? `${한글날짜(k.날짜)}까지` : `${한글날짜(k.날짜)}부터`,
      k.근거.length ? `근거: ${k.근거.map(조문표시).join(", ")}` : "",
      ...k.계산,
      ...k.메모,
      "기한지기 시제품이 계산한 날짜입니다. 기관이 보낸 통지서의 날짜와 다르면 통지서를 따릅니다.",
    ].filter(Boolean).join("\n");
    줄.push(
      "BEGIN:VEVENT",
      `UID:${k.id}-${날짜값(k.날짜)}@gihanjigi.invalid`,
      `DTSTAMP:${찍은시각(만든시각)}`,
      `DTSTART;VALUE=DATE:${날짜값(k.날짜)}`,
      `DTEND;VALUE=DATE:${날짜값(addDays(k.날짜, 1))}`,
      `SUMMARY:${이스케이프(`[${머리}] ${k.이름}${사건이름 ? ` (${사건이름})` : ""}`)}`,
      `DESCRIPTION:${이스케이프(설명)}`,
      "TRANSP:TRANSPARENT",
    );
    if (k.종류 === "마감") {
      for (const a of 알림시점) {
        // 이미 지난 알림은 넣지 않는다. 일정 0시 기준으로 a.일 전이 오늘보다 앞이면 뺀다.
        if (addDays(k.날짜, -a.일) < 오늘) continue;
        줄.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${a.값}`, `DESCRIPTION:${이스케이프(`${k.이름} ${a.일}일 전`)}`, "END:VALARM");
      }
    }
    줄.push("END:VEVENT");
  }
  줄.push("END:VCALENDAR");
  return { 내용: `${줄.map(줄접기).join("\r\n")}\r\n`, 개수: 대상.length };
}
