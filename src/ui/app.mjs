// 기한지기 시제품 화면. 엔진 모듈을 그대로 불러 쓰고, 사건은 이 기기의 localStorage 에만 둔다.
// 서버로 보내는 것은 없다. 사진 속 글자 읽기(AI)는 연결하지 않았다.
import { h, 내려받기, 복사하기, 글로읽기 } from "./dom.mjs";
import { 예시사건 } from "./sample.mjs";
import { 질문 } from "../engine/classify.mjs";
import { 날짜항목 } from "../engine/deadlines.mjs";
import { 조문 } from "../engine/law.mjs";
import { 새사건, 불러오기, 저장하기, 풀이, 저장열쇠 } from "../engine/case.mjs";
import { 일정파일 } from "../engine/ics.mjs";
import { 카톡읽기, 거래내역읽기, 대화를기록으로, 거래를기록으로, 직접기록, 시간순, 증거목록 } from "../engine/evidence.mjs";
import { isIso, 한글날짜 } from "../engine/dates.mjs";

// ?today=2026-10-09 로 기준일을 고정할 수 있다. 화면 점검과 캡처에 쓴다.
const 오늘 = (() => {
  const q = new URLSearchParams(location.search).get("today");
  if (isIso(q)) return q;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

let 사건 = 새사건(오늘);
let 안내 = null;
let 고치는기록 = null;
let 확인만보기 = false;
let 증거용도 = null;
let 넘길안내 = null;

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const 마감띠 = document.getElementById("due");

/* ── 저장 ── */

function 읽어오기() {
  let 글 = null;
  try { 글 = localStorage.getItem(저장열쇠); } catch { /* 저장소를 못 쓰는 브라우저 */ }
  const r = 불러오기(글, 오늘);
  사건 = r.사건;
  안내 = r.문제;
}

function 저장() {
  try {
    localStorage.setItem(저장열쇠, 저장하기(사건));
  } catch {
    안내 = "이 브라우저에서는 기록을 저장할 수 없어, 창을 닫으면 기록이 사라집니다.";
  }
}

function 바꾸기(고침) {
  고침(사건);
  저장();
  그리기();
}

/* ── 공통 조각 ── */

const 약칭 = {
  "전기통신금융사기 피해 방지 및 피해자산 환급에 관한 특별법": "통신사기피해환급법",
  "전기통신금융사기 피해 방지 및 피해자산 환급에 관한 특별법 시행령": "통신사기피해환급법 시행령",
  "소송촉진 등에 관한 특례법": "소송촉진법",
};

function 근거링크(id) {
  const c = 조문[id];
  return h("a", { href: c.주소, target: "_blank", rel: "noopener", title: `${c.법령} ${c.조문}` }, `${약칭[c.법령] ?? c.법령} ${c.조문}`);
}

const 대조표시 = (id) => (조문[id].대조 === "원문" ? null : h("span", { class: "muted" }, " (원문 대조 전)"));

function 근거줄(ids) {
  if (!ids?.length) return null;
  return h("p", { class: "basis" }, "근거 ", ids.map((id, i) => [i ? ", " : null, 근거링크(id), 대조표시(id)]));
}

function 근거풀이(ids) {
  if (!ids?.length) return null;
  return h("dl", { class: "law" }, ids.map((id) => [h("dt", null, 근거링크(id), 대조표시(id)), h("dd", null, 조문[id].요지)]));
}

const 원 = (n) => `${n.toLocaleString("ko-KR")}원`;
const 계좌말 = (a) => (a ? [a.은행, a.번호].filter(Boolean).join(" ") : "");
const 일시말 = (s) => (s.length > 10 ? `${한글날짜(s.slice(0, 10))} ${s.slice(11, 16)}` : 한글날짜(s));
const 항목이름 = (id) => 날짜항목.find((x) => x.id === id)?.이름 ?? id;

function 남은말(k) {
  const n = k.남은날;
  if (k.종류 === "마감") return n > 0 ? `${n}일 남음` : n === 0 ? "오늘까지" : `${-n}일 지남`;
  if (k.종류 === "가능일") return n > 0 ? `${n}일 뒤부터` : "지금 가능";
  return n > 0 ? `${n}일 뒤` : n === 0 ? "오늘" : `${-n}일 전`;
}
const 종류이름 = { 마감: "마감", 가능일: "가능일", 예상: "예상일", 참고: "참고" };

const 제목 = (글) => h("h1", { tabindex: -1 }, 글);
/** 화면 함수가 돌려준 조각에서 빈 자리(null)를 걸러 낸다. */
const 조각 = (목록) => 목록.flat(Infinity).filter((x) => x != null && x !== false);
const 안내줄 = () => (안내 ? h("p", { class: "notice", role: "status" }, 안내) : null);

function 먼저유형(이름) {
  return [
    제목(이름),
    h("p", null, "유형 확인에서 돈을 보낸 까닭과 방법을 먼저 고르면, 그에 맞는 내용이 여기에 나옵니다."),
    h("p", null, h("a", { class: "btn primary", href: "#/type" }, "유형 확인으로 가기")),
  ];
}

function 범위밖(p, 이름) {
  return [
    제목(이름),
    h("p", null, `${p.유형.이름}입니다.`),
    h("ul", null, p.유형.까닭.map((x) => h("li", null, x))),
    h("p", null, h("a", { href: "#/type" }, "답 고치기")),
  ];
}

function 마감띠그리기(p) {
  const 줄 = [];
  if (p.다음) {
    줄.push(h("p", null,
      h("span", { class: "label" }, "다음 마감"),
      h("strong", { class: "amber" }, 한글날짜(p.다음.날짜)),
      h("a", { href: "#/deadlines" }, p.다음.이름),
      h("span", { class: "left" }, 남은말(p.다음))));
  }
  for (const k of p.기한.filter((x) => x.종류 === "마감" && x.날짜 && x.남은날 < 0)) {
    줄.push(h("p", null,
      h("span", { class: "label" }, "지난 마감"),
      h("strong", null, 한글날짜(k.날짜)),
      h("a", { href: "#/deadlines" }, k.이름),
      h("span", { class: "left amber" }, 남은말(k))));
  }
  마감띠.replaceChildren(...줄);
}

/* ── 유형 확인 ── */

function 예시불러오기(종류) {
  const 있음 = 사건.기록.length || Object.keys(사건.날짜).length;
  if (있음 && !window.confirm("지금 사건을 지우고 예시 사건을 불러옵니다.")) return;
  사건 = 예시사건(종류, 오늘);
  저장();
  이동("#/todo", `${사건.이름}을 불러왔습니다. 사람 이름과 계좌번호는 지어낸 것입니다.`);
}

function 결과(유형) {
  if (!유형.유형) return h("section", { class: "result", "aria-live": "polite" }, h("p", { class: "muted" }, "까닭과 방법을 고르면 결과가 여기에 나옵니다."));
  return h("section", { class: "result", "aria-live": "polite" },
    h("h2", null, 유형.이름),
    h("ul", null, 유형.까닭.map((x) => h("li", null, x))),
    근거줄(유형.근거),
    유형.유형 === "범위밖" ? null : h("p", { class: "actions" }, h("a", { class: "btn primary", href: "#/todo" }, "지금 할 일 보기")));
}

function 유형화면(p) {
  return [
    제목("유형 확인"),
    안내줄(),
    h("p", { class: "lead" }, "답을 고르면 그에 맞는 일반 절차와 기한을 보여 드립니다. 개별 사건에 대한 법률 판단은 아닙니다."),
    h("div", { class: "sample" },
      h("p", null, "예시 사건으로 먼저 살펴볼 수도 있습니다."),
      h("p", { class: "sample-links" },
        h("button", { type: "button", class: "link-btn", onclick: () => 예시불러오기("대출") }, "대출 사기 예시"),
        h("button", { type: "button", class: "link-btn", onclick: () => 예시불러오기("중고거래") }, "중고거래 사기 예시"))),
    h("form", { class: "questions", onsubmit: (e) => e.preventDefault() },
      질문.map((q) => h("fieldset", null,
        h("legend", null, q.물음),
        q.선택지.map(([값, 글]) => h("label", { class: "choice" },
          h("input", {
            type: "radio", name: q.id, value: 값, id: `q-${q.id}-${값}`, checked: 사건.답[q.id] === 값,
            onchange: () => 바꾸기((s) => { s.답 = { ...s.답, [q.id]: 값 }; }),
          }),
          h("span", null, 글))))),
      h("div", { class: "field" },
        h("label", { for: "case-name" }, "사건 이름 (적지 않아도 됩니다)"),
        h("input", { type: "text", id: "case-name", maxlength: 40, value: 사건.이름, placeholder: "예: 중고거래 아이패드", onchange: (e) => 바꾸기((s) => { s.이름 = e.target.value.trim(); }) }),
        h("p", { class: "hint" }, "달력 일정의 이름 뒤에 붙습니다."))),
    결과(p.유형),
  ];
}

/* ── 지금 할 일 ── */

function 기한한줄(k) {
  if (!k) return null;
  if (k.날짜) return h("p", { class: k.남은날 >= 0 ? "due-line" : "due-line past" }, `${종류이름[k.종류]} ${한글날짜(k.날짜)}, ${남은말(k)}`);
  if (k.상태 === "입력 필요") return h("p", { class: "muted" }, `기한 화면에 ${k.필요.map(항목이름).join(", ")}을 넣으면 날짜를 계산합니다. `, h("a", { href: "#/deadlines" }, "날짜 넣기"));
  return k.메모[0] ? h("p", { class: "muted" }, k.메모[0]) : null;
}

function 할일화면(p) {
  if (!p.유형.유형) return 먼저유형("지금 할 일");
  if (p.유형.유형 === "범위밖") return 범위밖(p, "지금 할 일");
  const 한일 = new Set(사건.한일);
  const 했음 = p.할일.filter((x) => 한일.has(x.id)).length;
  return [
    제목("지금 할 일"),
    안내줄(),
    h("p", { class: "lead" }, `${p.유형.이름}. 위에서부터 차례로 합니다.`),
    h("p", { class: "count" }, `${p.할일.length}개 가운데 ${했음}개 했음`),
    h("ol", { class: "rows todo" }, p.할일.map((x) => {
      const id = `todo-${x.id}`;
      const 끝 = 한일.has(x.id);
      return h("li", { class: 끝 ? "done" : null },
        h("input", {
          type: "checkbox", id, checked: 끝,
          onchange: (e) => 바꾸기((s) => { s.한일 = e.target.checked ? [...new Set([...s.한일, x.id])] : s.한일.filter((v) => v !== x.id); }),
        }),
        h("div", null,
          h("div", { class: "todo-head" }, h("label", { for: id, class: "todo-title" }, x.제목), h("span", { class: "when" }, 끝 ? "했음" : x.언제)),
          h("p", { class: "todo-text" }, x.설명),
          x.기한 ? 기한한줄(p.기한.find((k) => k.id === x.기한)) : null,
          근거줄(x.근거)));
    })),
  ];
}

/* ── 기한 ── */

const 묶음 = [
  { 이름: "은행", 칸: ["구술신청일", "서면제출일", "추가기한통지일", "공고일"] },
  { 이름: "수사", 칸: ["고소일", "송치통지일", "불송치통지일", "이의신청일", "기소일", "불기소통지일", "항고기각통지일"] },
  { 이름: "그 밖", 칸: ["송금일", "범인안날"] },
];

/** 앞 단계 날짜가 들어와야 다음 단계 칸을 보여 준다. 값이 있는 칸은 늘 보인다. */
function 보이나(id, e, 유형) {
  if (!날짜항목.find((x) => x.id === id)?.유형.includes(유형.유형)) return false;
  if (e[id]) return true;
  switch (id) {
    case "구술신청일": case "공고일": return 유형.지급정지;
    case "서면제출일": case "추가기한통지일": return 유형.지급정지 && Boolean(e.구술신청일);
    case "송치통지일": return Boolean(e.고소일) && !e.불송치통지일;
    case "불송치통지일": return Boolean(e.고소일) && !e.송치통지일;
    case "이의신청일": return Boolean(e.불송치통지일);
    case "기소일": return Boolean(e.송치통지일) && !e.불기소통지일;
    case "불기소통지일": return Boolean(e.송치통지일) && !e.기소일;
    case "항고기각통지일": return Boolean(e.불기소통지일);
    default: return true;
  }
}

let 날짜양식 = null;
let 기한결과 = null;

function 날짜칸(id) {
  const 칸id = `d-${id}`;
  const 입력 = h("input", { type: "date", id: 칸id, min: "2020-01-01", max: 오늘, "aria-describedby": `${칸id}-err`, onchange: (e) => 날짜바꾸기(id, e.target.value, 입력) });
  return h("div", { class: "field date", "data-id": id },
    h("label", { for: 칸id }, 항목이름(id)),
    입력,
    h("button", { type: "button", class: "link-btn", "aria-label": `${항목이름(id)} 지우기`, onclick: () => { 날짜바꾸기(id, "", 입력); 입력.focus(); } }, "지우기"),
    h("p", { class: "err", id: `${칸id}-err` }));
}

/** 날짜 칸을 다시 만들지 않고 고친다. 다시 만들면 입력 중인 칸의 커서가 처음으로 돌아간다. */
function 날짜양식맞추기(p) {
  for (const g of 묶음) {
    const 상자 = 날짜양식.querySelector(`[data-group="${g.이름}"]`);
    const ids = g.칸.filter((id) => 보이나(id, 사건.날짜, p.유형));
    상자.hidden = ids.length === 0;
    const 목록 = 상자.querySelector(".fields");
    for (const 칸 of [...목록.children]) if (!ids.includes(칸.dataset.id)) 칸.remove();
    let 앞 = null;
    for (const id of ids) {
      let 칸 = 목록.querySelector(`[data-id="${id}"]`);
      if (!칸) {
        칸 = 날짜칸(id);
        if (앞) 앞.after(칸); else 목록.prepend(칸);
      }
      const 입력 = 칸.querySelector("input");
      if (document.activeElement !== 입력) 입력.value = 사건.날짜[id] ?? "";
      칸.querySelector("button").hidden = !사건.날짜[id];
      앞 = 칸;
    }
    const 다음안내 = 상자.querySelector(".next-hint");
    if (다음안내) 다음안내.hidden = Boolean(사건.날짜.고소일);
  }
}

function 날짜바꾸기(id, v, 입력) {
  const 오류 = document.getElementById(`d-${id}-err`);
  if (v && (!isIso(v) || v > 오늘)) {
    if (오류) 오류.textContent = "오늘보다 뒤의 날짜는 넣을 수 없습니다.";
    return;
  }
  if (오류) 오류.textContent = "";
  const 다음 = { ...사건.날짜 };
  if (v) 다음[id] = v; else delete 다음[id];
  사건.날짜 = 다음;
  if (!v && 입력) 입력.value = "";
  저장();
  const p = 풀이(사건, 오늘);
  마감띠그리기(p);
  날짜양식맞추기(p);
  기한결과.replaceChildren(...조각(기한결과내용(p)));
}

function 기한줄(k) {
  const 강조 = k.종류 === "마감";
  return h("li", { class: `dl${강조 ? " is-due" : ""}${k.남은날 < 0 ? " is-past" : ""}` },
    h("p", { class: "dl-date" }, 한글날짜(k.날짜)),
    h("div", null,
      h("p", { class: "dl-name" }, k.이름),
      h("p", { class: "dl-meta" }, `${종류이름[k.종류]}, ${남은말(k)}`),
      h("details", null,
        h("summary", null, "계산 과정과 근거"),
        h("ol", { class: "steps" }, k.계산.map((s) => h("li", null, s))),
        k.메모.length ? h("ul", { class: "notes" }, k.메모.map((m) => h("li", null, m))) : null,
        근거풀이(k.근거))));
}

function 달력내려받기() {
  const p = 풀이(사건, 오늘);
  const r = 일정파일(p.기한, { 오늘, 만든시각: new Date(), 사건이름: 사건.이름 });
  내려받기("기한지기-기한.ics", r.내용, "text/calendar;charset=utf-8");
}

function 기한결과내용(p) {
  const 날짜있음 = p.기한.filter((k) => k.날짜);
  const 날짜없음 = p.기한.filter((k) => !k.날짜 && k.상태 === "계산됨");
  const 입력필요 = p.기한.filter((k) => k.상태 === "입력 필요");
  const 확인필요 = p.기한.filter((k) => k.상태 === "확인 필요");
  const 해당없음 = p.기한.filter((k) => k.상태 === "해당 없음");
  const 달력 = 날짜있음.some((k) => k.알림 && k.남은날 >= 0);
  return [
    h("h2", null, "계산한 기한"),
    날짜있음.length
      ? h("ol", { class: "rows deadlines" }, 날짜있음.map(기한줄))
      : h("p", { class: "muted" }, "아직 계산한 기한이 없습니다. 위에 받은 날짜를 넣어 주십시오."),
    달력 ? h("div", { class: "actions" },
      h("button", { type: "button", class: "btn", onclick: 달력내려받기 }, "달력 파일 내려받기 (.ics)"),
      h("p", { class: "hint" }, "남은 마감과 가능일을 종일 일정으로 넣습니다. 마감에는 30일, 7일, 1일 전 알림이 붙습니다.")) : null,
    확인필요.length ? [
      h("h3", null, "확인이 필요한 기한"),
      h("ul", { class: "rows" }, 확인필요.map((k) => h("li", null, h("p", { class: "dl-name" }, k.이름), k.메모.map((m) => h("p", { class: "flag-text" }, m)), 근거줄(k.근거)))),
    ] : null,
    날짜없음.length ? [
      h("h3", null, "날짜로 정해지지 않은 기한"),
      h("ul", { class: "rows" }, 날짜없음.map((k) => h("li", null, h("p", { class: "dl-name" }, k.이름), k.메모.map((m) => h("p", { class: "muted" }, m)), 근거줄(k.근거)))),
    ] : null,
    입력필요.length ? [
      h("h3", null, "날짜를 넣으면 계산하는 기한"),
      h("ul", { class: "rows" }, 입력필요.map((k) => h("li", null, h("p", { class: "dl-name" }, k.이름), h("p", { class: "muted" }, `필요한 날짜: ${k.필요.map(항목이름).join(", ")}`)))),
    ] : null,
    해당없음.length ? h("details", { class: "na" },
      h("summary", null, `해당 없는 기한 ${해당없음.length}건`),
      h("ul", { class: "rows" }, 해당없음.map((k) => h("li", null, h("p", { class: "dl-name" }, k.이름), k.메모[0] ? h("p", { class: "muted" }, k.메모[0]) : null)))) : null,
  ];
}

function 기한화면(p) {
  if (!p.유형.유형) return 먼저유형("기한");
  if (p.유형.유형 === "범위밖") return 범위밖(p, "기한");
  날짜양식 = h("section", { class: "dates" },
    h("h2", null, "받은 날짜"),
    묶음.map((g) => h("div", { class: "group", "data-group": g.이름 },
      h("h3", null, g.이름),
      g.이름 === "수사" ? h("p", { class: "hint next-hint" }, "고소장을 낸 날을 넣으면 다음 통지 칸이 나옵니다.") : null,
      h("div", { class: "fields" }))));
  기한결과 = h("section", { class: "results" });
  날짜양식맞추기(p);
  기한결과.replaceChildren(...조각(기한결과내용(p)));
  return [
    제목("기한"),
    안내줄(),
    h("p", { class: "lead" }, "통지서나 문자로 받은 날짜를 넣으면 기한을 계산합니다. 첫날은 빼고 세며, 끝날이 토요일이나 공휴일이면 다음 날로 넘깁니다."),
    날짜양식,
    기한결과,
  ];
}

/* ── 사건 기록 ── */

const 겹침 = (a, b) => a.일시 === b.일시 && a.내용 === b.내용 && a.출처 === b.출처;

function 기록더하기(새것) {
  const 남김 = 새것.filter((r) => !사건.기록.some((x) => 겹침(x, r)));
  사건.기록 = [...사건.기록, ...남김];
  return { 더함: 남김.length, 겹친: 새것.length - 남김.length };
}

const 거래내역같음 = (이름, 글) => /\.(csv|tsv)$/i.test(이름) || /거래일|출금/.test(글.split(/\r?\n/).slice(0, 5).join(" "));

function 읽은결과(이름, r, 확인) {
  const 겹친 = r.겹친 ? ` 이미 있는 ${r.겹친}건은 뺐습니다.` : "";
  return `${이름}: ${r.더함}건을 가져왔습니다.${확인 ? ` 금액이나 계좌가 보이는 ${확인}건은 확인 필요로 두었습니다.` : ""}${겹친}`;
}

async function 파일가져오기(e) {
  const 결과들 = [];
  for (const f of [...e.target.files]) {
    if (f.type.startsWith("image/")) {
      const d = new Date(f.lastModified);
      const 일시 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const r = 기록더하기([{ ...직접기록({ 일시, 종류: "사진", 내용: `${f.name}. 사진 속 내용은 고치기에서 직접 적습니다.` }), 출처: f.name, 상태: "확인 필요" }]);
      결과들.push(`${f.name}: 사진은 파일 이름과 찍은 시각만 기록했습니다. 사진 속 글자 읽기는 아직 연결하지 않았습니다.${r.겹친 ? " 이미 있는 사진이라 뺐습니다." : ""}`);
      continue;
    }
    const 글 = await 글로읽기(f);
    if (거래내역같음(f.name, 글)) {
      const { 거래, 못읽음 } = 거래내역읽기(글);
      if (못읽음) { 결과들.push(`${f.name}: ${못읽음}`); continue; }
      const 기록 = 거래를기록으로(거래, f.name);
      결과들.push(읽은결과(f.name, 기록더하기(기록), 기록.length));
    } else {
      const 메시지 = 카톡읽기(글);
      if (!메시지.length) { 결과들.push(`${f.name}: 카카오톡 대화 형식을 찾지 못했습니다. 대화방 메뉴의 「대화 내용 내보내기」로 만든 파일인지 확인해 주십시오.`); continue; }
      const 기록 = 대화를기록으로(메시지, f.name);
      결과들.push(읽은결과(f.name, 기록더하기(기록), 기록.filter((r) => r.상태 === "확인 필요").length));
    }
  }
  안내 = 결과들.join(" ");
  저장();
  그리기();
}

function 붙여넣기읽기() {
  const 칸 = document.getElementById("paste");
  const 메시지 = 카톡읽기(칸.value);
  if (!메시지.length) {
    안내 = "대화 형식을 찾지 못했습니다. 「2026년 10월 3일 오후 2:05, 이름 : 내용」처럼 날짜와 이름이 붙은 줄을 붙여 넣어 주십시오.";
    그리기();
    return;
  }
  const 기록 = 대화를기록으로(메시지, "붙여 넣은 대화");
  안내 = 읽은결과("붙여 넣은 대화", 기록더하기(기록), 기록.filter((r) => r.상태 === "확인 필요").length);
  저장();
  그리기();
}

const 숫자만 = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return n > 0 ? n : null;
};
const 계좌값 = (은행, 번호) => (String(번호 ?? "").trim() ? { 은행: String(은행 ?? "").trim() || null, 번호: String(번호).trim() } : null);

function 직접넣기(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const 일시 = String(f.get("일시") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(일시)) return;
  기록더하기([직접기록({ 일시: 일시.slice(0, 16), 종류: String(f.get("종류")), 내용: String(f.get("내용") ?? "").trim(), 금액: 숫자만(f.get("금액")), 계좌: 계좌값(f.get("은행"), f.get("계좌")) })]);
  안내 = "기록을 추가했습니다.";
  저장();
  그리기();
}

function 칸(id, 이름, 입력, 도움) {
  return h("div", { class: "field" }, h("label", { for: id }, 이름), 입력, 도움 ? h("p", { class: "hint" }, 도움) : null);
}

function 고치기양식(r) {
  const 저장하기누름 = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    바꾸기((s) => {
      s.기록 = s.기록.map((x) => (x.id === r.id
        ? { ...x, 내용: String(f.get("내용") ?? "").trim() || x.내용, 금액: 숫자만(f.get("금액")), 계좌: 계좌값(f.get("은행"), f.get("계좌")), 상태: "확정" }
        : x));
      고치는기록 = null;
      안내 = "고친 내용으로 확정했습니다.";
    });
  };
  return h("form", { class: "edit", onsubmit: 저장하기누름 },
    칸(`e-text-${r.id}`, "내용", h("textarea", { id: `e-text-${r.id}`, name: "내용", rows: 3, value: r.내용 })),
    칸(`e-amount-${r.id}`, "금액 (원)", h("input", { type: "text", inputmode: "numeric", id: `e-amount-${r.id}`, name: "금액", value: r.금액 ?? "" })),
    칸(`e-bank-${r.id}`, "은행", h("input", { type: "text", id: `e-bank-${r.id}`, name: "은행", value: r.계좌?.은행 ?? "" })),
    칸(`e-account-${r.id}`, "계좌번호", h("input", { type: "text", id: `e-account-${r.id}`, name: "계좌", value: r.계좌?.번호 ?? "" })),
    h("div", { class: "actions" },
      h("button", { type: "submit", class: "btn primary" }, "고친 내용으로 확정"),
      h("button", { type: "button", class: "btn", onclick: () => { 고치는기록 = null; 그리기(); } }, "취소")));
}

function 기록줄(r) {
  const 확인 = r.상태 === "확인 필요";
  return h("li", { class: `rec${확인 ? " check" : ""}`, id: `rec-${r.id}` },
    h("p", { class: "rec-time" }, 일시말(r.일시)),
    h("div", null,
      h("p", { class: "rec-kind" }, r.종류, r.보낸이 ? `, ${r.보낸이}` : null),
      h("p", { class: "rec-text" }, r.내용),
      r.금액 || r.계좌 ? h("p", { class: "rec-facts" }, r.금액 ? `금액 ${원(r.금액)}` : null, r.금액 && r.계좌 ? ", " : null, r.계좌 ? ["계좌 ", h("span", { class: "nowrap" }, 계좌말(r.계좌))] : null) : null,
      h("p", { class: "rec-src" }, `출처 ${r.출처}`),
      고치는기록 === r.id ? 고치기양식(r) : h("div", { class: "rec-actions" },
        확인 ? h("span", { class: "flag-text" }, "확인 필요") : h("span", { class: "muted" }, "확정함"),
        확인 ? h("button", { type: "button", class: "btn small", id: `ok-${r.id}`, onclick: () => 바꾸기((s) => { s.기록 = s.기록.map((x) => (x.id === r.id ? { ...x, 상태: "확정" } : x)); }) }, "확정") : null,
        h("button", { type: "button", class: "link-btn", id: `fix-${r.id}`, onclick: () => { 고치는기록 = r.id; 그리기(); document.getElementById(`e-text-${r.id}`)?.focus(); } }, "고치기"),
        h("button", { type: "button", class: "link-btn", onclick: () => { if (window.confirm("이 기록을 지웁니다.")) 바꾸기((s) => { s.기록 = s.기록.filter((x) => x.id !== r.id); }); } }, "지우기"))));
}

/** 대화 파일에서 피해자 본인을 가리키는 이름. 증거 목록의 상대방에서 뺀다. */
function 내이름칸() {
  const 이름들 = [...new Set(사건.기록.map((r) => r.보낸이).filter(Boolean))];
  if (이름들.length < 2) return null;
  const 고른것 = 이름들.includes(사건.내이름) ? 사건.내이름 : "";
  return 칸("my-name", "대화에서 내 이름", h("select", { id: "my-name", value: 고른것, onchange: (e) => 바꾸기((s) => { s.내이름 = e.target.value || "나"; }) },
    고른것 ? null : h("option", { value: "" }, "고르지 않음"),
    이름들.map((n) => h("option", { value: n }, n))), "증거 목록의 상대방 대화명에서 이 이름을 뺍니다.");
}

function 기록화면() {
  const 기록 = 시간순(사건.기록);
  const 확인수 = 기록.filter((r) => r.상태 === "확인 필요").length;
  const 보일것 = 확인만보기 && 확인수 ? 기록.filter((r) => r.상태 === "확인 필요") : 기록;
  return [
    제목("사건 기록"),
    안내줄(),
    h("p", { class: "lead" }, "대화와 송금, 통화를 시간순으로 모읍니다. 파일에서 읽은 금액과 계좌는 직접 확인한 뒤 확정하고, 확정한 기록만 증거 목록에 들어갑니다."),
    h("section", null,
      h("h2", null, "가져오기"),
      h("div", { class: "field" },
        h("input", { type: "file", id: "file", class: "file-input", accept: ".txt,.csv,.tsv,image/*", multiple: true, onchange: 파일가져오기, "aria-describedby": "file-hint" }),
        h("label", { for: "file", class: "btn" }, "파일 고르기"),
        h("p", { class: "hint", id: "file-hint" }, "카카오톡 대화 내보내기 파일(.txt)과 은행 거래내역(.csv)을 읽습니다. 사진은 파일 이름과 시각만 기록합니다. 파일은 이 기기 밖으로 나가지 않습니다.")),
      내이름칸(),
      h("details", { class: "more" },
        h("summary", null, "대화 붙여 넣기"),
        칸("paste", "대화 내용", h("textarea", { id: "paste", rows: 6, placeholder: "2026년 10월 3일 오후 2:05, 판매자 : 입금 확인 후 보내드려요" })),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn", onclick: 붙여넣기읽기 }, "읽기"))),
      h("details", { class: "more" },
        h("summary", null, "직접 넣기"),
        h("form", { onsubmit: 직접넣기 },
          칸("m-time", "일시", h("input", { type: "datetime-local", id: "m-time", name: "일시", required: true, max: `${오늘}T23:59` })),
          칸("m-kind", "종류", h("select", { id: "m-kind", name: "종류" }, ["송금", "통화", "문자", "대화", "기타"].map((v) => h("option", { value: v }, v)))),
          칸("m-text", "내용", h("input", { type: "text", id: "m-text", name: "내용", required: true })),
          칸("m-amount", "금액 (원)", h("input", { type: "text", inputmode: "numeric", id: "m-amount", name: "금액" })),
          칸("m-bank", "은행", h("input", { type: "text", id: "m-bank", name: "은행" })),
          칸("m-account", "계좌번호", h("input", { type: "text", id: "m-account", name: "계좌" })),
          h("div", { class: "actions" }, h("button", { type: "submit", class: "btn" }, "기록 추가"))))),
    h("section", null,
      h("h2", null, `기록 ${기록.length}건`),
      확인수 ? h("div", { class: "filter" },
        h("p", { class: "flag-text" }, `확인이 필요한 기록 ${확인수}건`),
        h("label", { class: "check-label" }, h("input", { type: "checkbox", id: "only-check", checked: 확인만보기, onchange: (e) => { 확인만보기 = e.target.checked; 그리기(); } }), "확인이 필요한 기록만 보기")) : null,
      기록.length ? h("ol", { class: "rows records" }, 보일것.map(기록줄)) : h("p", { class: "muted" }, "아직 기록이 없습니다.")),
  ];
}

/* ── 진행 현황 ── */

const 상태부류 = { 완료: "s-done", 지금: "s-now", 예정: "s-later", "해당 없음": "s-later" };

function 단계목록(목록) {
  return h("ol", { class: "rows stages" }, 목록.map((s) => h("li", { class: `stage ${상태부류[s.상태]}`, "aria-current": s.상태 === "지금" ? "step" : null },
    h("span", { class: "stage-state" }, s.상태),
    h("div", null, h("p", { class: "stage-name" }, s.이름), s.설명 ? h("p", { class: "stage-desc" }, s.설명) : null),
    h("span", { class: "stage-date" }, s.날짜 ? 한글날짜(s.날짜) : null))));
}

function 현황화면(p) {
  if (!p.유형.유형) return 먼저유형("진행 현황");
  if (p.유형.유형 === "범위밖") return 범위밖(p, "진행 현황");
  return [
    제목("진행 현황"),
    안내줄(),
    h("p", { class: "lead" }, "기한 화면에 넣은 날짜로 단계를 표시합니다. 기관과 연결되어 있지 않으므로 실제 처리 상황은 해당 기관에 확인합니다."),
    p.은행.length ? h("section", null, h("h2", null, "은행 피해구제"), 단계목록(p.은행)) : null,
    h("section", null, h("h2", null, "수사"), 단계목록(p.수사)),
    h("p", { class: "actions" }, h("a", { class: "btn", href: "#/deadlines" }, "받은 날짜 넣기")),
  ];
}

/* ── 증거 목록 ── */

function 증거글(목록, 용도) {
  const 줄 = [목록.제목, `작성 ${한글날짜(오늘)}`, ""];
  목록.항목.forEach((x, i) => {
    const 금액 = x.금액 ? ((x.송금 ?? true) ? ` 송금 ${원(x.금액)}` : ` 대화 속 금액 ${원(x.금액)}`) : "";
    줄.push(`${i + 1}. ${일시말(x.일시)}${x.종류 ? ` ${x.종류}` : ""}${금액}${x.계좌 ? ` ${계좌말(x.계좌)}` : ""}`);
    if (x.내용) 줄.push(`   ${x.내용.replace(/\n/g, " ")}`);
    if (x.출처) 줄.push(`   출처: ${x.출처}`);
  });
  줄.push("", `송금 합계 ${원(목록.합계)}`);
  if (용도 === "경찰" && 목록.상대방) {
    if (목록.상대방.이름.length) 줄.push(`상대방 대화명: ${목록.상대방.이름.join(", ")}`);
    if (목록.상대방.계좌.length) 줄.push(`상대방 계좌: ${목록.상대방.계좌.join(", ")}`);
  }
  줄.push("", "함께 낼 서류", ...목록.첨부.map((x) => `- ${x}`));
  return 줄.join("\n");
}

function 증거화면(p) {
  if (!p.유형.유형) return 먼저유형("증거 목록");
  if (p.유형.유형 === "범위밖") return 범위밖(p, "증거 목록");
  const 용도들 = p.유형.지급정지 ? ["은행", "경찰"] : ["경찰"];
  const 용도 = 용도들.includes(증거용도) ? 증거용도 : 용도들[0];
  const 목록 = 증거목록(사건.기록, 용도, p.유형.유형, 사건.내이름);
  const 경찰 = 용도 === "경찰";
  return [
    제목("증거 목록"),
    안내줄(),
    h("p", { class: "lead no-print" }, "확정한 기록으로 제출용 목록을 만듭니다. 인쇄하거나 글로 복사해서 기관 서식에 옮깁니다. 원본 파일은 따로 함께 냅니다."),
    용도들.length > 1 ? h("div", { class: "switch no-print", role: "group", "aria-label": "제출하는 곳" },
      용도들.map((u) => h("button", { type: "button", "aria-pressed": String(u === 용도), onclick: () => { 증거용도 = u; 그리기(); } }, `${u} 제출용`))) : null,
    h("article", { class: "doc" },
      h("h2", null, 목록.제목),
      h("p", { class: "meta" }, `작성 ${한글날짜(오늘)}. 기한지기 시제품으로 정리한 목록입니다.`),
      목록.빠진것.map((x) => h("p", { class: "flag-text" }, x)),
      목록.항목.length ? h("div", { class: "table-wrap" },
        h("table", null,
          h("thead", null, h("tr", null,
            h("th", { scope: "col" }, "일시"),
            h("th", { scope: "col" }, 경찰 ? "내용" : "받는 계좌"),
            경찰 ? null : h("th", { scope: "col" }, "내용"),
            h("th", { scope: "col", class: "num" }, "송금액"))),
          h("tbody", null, 목록.항목.map((x) => h("tr", null,
            h("td", { class: "nowrap" }, 일시말(x.일시)),
            경찰
              ? h("td", null, h("span", { class: "cell-kind" }, x.종류), " ", x.내용,
                x.금액 && !x.송금 ? h("span", { class: "cell-sub" }, `대화 속 금액 ${원(x.금액)}`) : null,
                x.계좌 ? h("span", { class: "cell-sub" }, `읽은 계좌 ${계좌말(x.계좌)}`) : null,
                h("span", { class: "cell-sub" }, `출처 ${x.출처}`))
              : h("td", null, 계좌말(x.계좌)),
            경찰 ? null : h("td", null, x.내용),
            h("td", { class: "num" }, x.금액 && (x.송금 ?? true) ? 원(x.금액) : null)))),
          목록.합계 ? h("tfoot", null, h("tr", null, h("td", { colspan: 경찰 ? 2 : 3 }, "송금 합계"), h("td", { class: "num" }, 원(목록.합계)))) : null)) : null,
      경찰 && (목록.상대방.이름.length || 목록.상대방.계좌.length) ? [
        h("h3", null, "상대방 정보"),
        h("dl", { class: "pairs" },
          목록.상대방.이름.length ? [h("dt", null, "대화명"), h("dd", null, 목록.상대방.이름.join(", "))] : null,
          목록.상대방.계좌.length ? [h("dt", null, "계좌"), h("dd", null, 목록.상대방.계좌.join(", "))] : null),
      ] : null,
      h("h3", null, "함께 낼 서류"),
      h("ul", { class: "attach" }, 목록.첨부.map((x) => h("li", null, x)))),
    h("div", { class: "actions no-print" },
      h("button", { type: "button", class: "btn primary", onclick: () => window.print() }, "인쇄"),
      h("button", { type: "button", class: "btn", onclick: async () => { 안내 = (await 복사하기(증거글(목록, 용도))) ? "목록을 글로 복사했습니다." : "이 브라우저에서는 복사할 수 없습니다."; 그리기(); } }, "글로 복사")),
  ];
}

/* ── 화면 전환 ── */

const 화면들 = [
  { id: "type", 짧게: "유형", 이름: "유형 확인", 그림: 유형화면 },
  { id: "todo", 짧게: "할 일", 이름: "지금 할 일", 그림: 할일화면 },
  { id: "deadlines", 짧게: "기한", 이름: "기한", 그림: 기한화면 },
  { id: "record", 짧게: "기록", 이름: "사건 기록", 그림: 기록화면 },
  { id: "status", 짧게: "현황", 이름: "진행 현황", 그림: 현황화면 },
  { id: "evidence", 짧게: "증거", 이름: "증거 목록", 그림: 증거화면 },
];

function 지금화면() {
  const id = location.hash.replace(/^#\/?/, "");
  return 화면들.find((s) => s.id === id) ?? (사건.답.까닭 && 사건.답.방법 ? 화면들[1] : 화면들[0]);
}

function 그리기({ 옮김 = false } = {}) {
  const 화면 = 지금화면();
  const p = 풀이(사건, 오늘);
  const 초점 = 옮김 ? null : document.activeElement?.id;
  document.title = `${화면.이름} | 기한지기`;
  document.body.dataset.page = 화면.id;
  for (const a of nav.querySelectorAll("a")) {
    if (a.dataset.id === 화면.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  마감띠그리기(p);
  main.replaceChildren(...조각(화면.그림(p)));
  if (옮김) {
    window.scrollTo(0, 0);
    main.querySelector("h1")?.focus({ preventScroll: true });
  } else if (초점) {
    document.getElementById(초점)?.focus({ preventScroll: true });
  }
}

/** 다른 화면으로 옮기면서 안내를 넘긴다. 같은 화면이면 hashchange 가 없어 바로 그린다. */
function 이동(주소, 메시지) {
  if (location.hash === 주소) {
    안내 = 메시지;
    고치는기록 = null;
    그리기({ 옮김: true });
  } else {
    넘길안내 = 메시지;
    location.hash = 주소;
  }
}

function 시작() {
  읽어오기();
  // 주소에 화면이 없으면 처음 고른 화면을 적어 둔다. 적지 않으면 답을 고르는 순간 기본 화면이 바뀐다.
  if (!화면들.some((s) => location.hash === `#/${s.id}`)) history.replaceState(null, "", `${location.pathname}${location.search}#/${지금화면().id}`);
  document.getElementById("today").textContent = `${한글날짜(오늘)} 기준`;
  nav.replaceChildren(...화면들.map((s) => h("a", { href: `#/${s.id}`, "data-id": s.id, "aria-label": s.이름 },
    h("span", { class: "short", "aria-hidden": "true" }, s.짧게),
    h("span", { class: "long", "aria-hidden": "true" }, s.이름))));
  document.querySelector(".skip").addEventListener("click", (e) => { e.preventDefault(); main.focus(); });
  document.getElementById("wipe").addEventListener("click", () => {
    if (!window.confirm("이 기기에 저장한 사건과 기록을 모두 지웁니다. 되돌릴 수 없습니다.")) return;
    try { localStorage.removeItem(저장열쇠); } catch { /* 저장소를 못 쓰는 브라우저 */ }
    사건 = 새사건(오늘);
    이동("#/type", "이 기기에 저장한 기록을 모두 지웠습니다.");
  });
  window.addEventListener("hashchange", () => { 안내 = 넘길안내; 넘길안내 = null; 고치는기록 = null; 그리기({ 옮김: true }); });
  그리기();
}

시작();
