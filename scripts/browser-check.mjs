// 화면 점검. 휴대폰과 PC 크기에서 실제 흐름을 눌러 보고, 가로 넘침, 누르는 자리 크기, axe(WCAG 2.2 AA)를 본다.
//   npm run check:browser [-- 캡처를 남길 폴더]
// 크로미움 위치는 CHROMIUM 환경 변수로 바꿀 수 있다. 기본값은 이 개발 환경에 미리 깔린 크로미움이다.
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { 서버열기 } from "./serve.mjs";

const load = createRequire(import.meta.url);
const { chromium } = load("playwright-core");
const axe경로 = load.resolve("axe-core/axe.min.js");
const 캡처폴더 = process.argv[2] ?? null;

const 서버 = await 서버열기(0);
const 주소 = `${서버.주소}?today=2026-10-09`;

const 문제 = [];
const 확인 = (조건, 말) => { if (!조건) 문제.push(말); };
const 대화 = [
  "판매자님과 카카오톡 대화",
  "저장한 날짜 : 2026-10-09 10:00:00",
  "",
  "2026년 10월 3일 오후 2:05, 판매자 : 아이패드 35만원에 드릴게요",
  "2026년 10월 3일 오후 2:08, 판매자 : 국민 123456-01-234567 홍길동",
  "2026년 10월 3일 오후 2:10, 나 : 350,000원 보냈습니다",
].join("\n");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--lang=ko-KR"] });
if (캡처폴더) await mkdir(캡처폴더, { recursive: true });

async function 점검(page, 이름) {
  const 넘침 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  확인(넘침 <= 0, `${이름}: 가로로 ${넘침}px 넘친다`);
  const 작은것 = await page.evaluate(() => [...document.querySelectorAll("button, input, select, textarea, .btn, nav a, summary")]
    .filter((el) => el.offsetParent !== null && !el.classList.contains("file-input"))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 24 || r.height < 24)
    .map(({ el, r }) => `${el.tagName.toLowerCase()} ${el.textContent.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`));
  확인(작은것.length === 0, `${이름}: 24px 보다 작은 누르는 자리 ${작은것.join(", ")}`);
  await page.addScriptTag({ path: axe경로 });
  const 위반 = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
  확인(위반.length === 0, `${이름}: axe ${위반.join(", ")}`);
  if (캡처폴더) await page.screenshot({ path: join(캡처폴더, `${이름}.png`), fullPage: true });
}

for (const [크기, viewport] of [["m", { width: 390, height: 844 }], ["d", { width: 1280, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 크기 === "m" ? 2 : 1, locale: "ko-KR", acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => 문제.push(`${크기}: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  const 가기 = async (화면) => { await page.goto(`${주소}#/${화면}`); await page.waitForSelector("main h1"); };

  // 처음 연 화면은 유형 확인이다
  await page.goto(주소);
  확인((await page.textContent("main h1")) === "유형 확인", `${크기}: 첫 화면이 유형 확인이 아니다`);
  await 점검(page, `${크기}-type-empty`);

  // 유형 고르기
  await page.getByLabel("물건이나 서비스 값").click(); // 다시 그리면서 칸이 바뀌므로 check() 대신 누른다
  await page.getByLabel("계좌이체").click();
  확인(await page.isChecked("#q-방법-계좌"), `${크기}: 고른 답이 표시되지 않는다`);
  확인((await page.textContent(".result h2")).includes("거래를 가장한 사기"), `${크기}: 거래사기로 나오지 않는다`);
  await 점검(page, `${크기}-type`);

  // 기한: 날짜를 넣으면 다음 칸이 나오고 계산된다. 입력 중인 칸의 초점이 유지되어야 한다.
  await 가기("deadlines");
  await page.fill("#d-고소일", "2026-10-05");
  확인(await page.isVisible("#d-불송치통지일"), `${크기}: 고소일을 넣어도 불송치 칸이 나오지 않는다`);
  확인(await page.evaluate(() => document.activeElement?.id === "d-고소일"), `${크기}: 날짜를 넣은 뒤 초점을 잃었다`);
  await page.fill("#d-불송치통지일", "2026-10-07");
  확인((await page.textContent(".results")).includes("2027.1.7(목)"), `${크기}: 불송치 이의신청 기한이 2027.1.7(목)이 아니다`);
  확인((await page.textContent("#due")).includes("2027.1.7(목)"), `${크기}: 다음 마감 줄에 기한이 없다`);
  await page.fill("#d-송금일", "2026-12-01");
  확인((await page.textContent("#d-송금일-err")).includes("오늘보다 뒤"), `${크기}: 미래 날짜를 막지 않는다`);
  const [내려받음] = await Promise.all([page.waitForEvent("download"), page.click("text=달력 파일 내려받기")]);
  const ics = await readFile(await 내려받음.path(), "utf8");
  확인(ics.includes("DTSTART;VALUE=DATE:20270107") && ics.includes("\r\n"), `${크기}: 달력 파일 내용이 다르다`);
  await page.click("summary:has-text('계산 과정과 근거')");
  await 점검(page, `${크기}-deadlines`);

  // 사건 기록: 대화 파일을 가져오고 하나를 확정한다
  await 가기("record");
  await page.setInputFiles("#file", { name: "대화.txt", mimeType: "text/plain", buffer: Buffer.from(대화) });
  await page.waitForSelector(".notice");
  확인((await page.textContent(".notice")).includes("3건을 가져왔습니다"), `${크기}: 대화 가져오기 안내가 다르다`);
  확인((await page.locator(".records > li").count()) === 3, `${크기}: 기록이 3건이 아니다`);
  await page.locator(".records .btn.small").first().click();
  확인((await page.locator(".records .flag-text").count()) === 2, `${크기}: 확정이 반영되지 않았다`); // 세 건 모두 금액이나 계좌가 있어 확인 필요였다
  await page.setInputFiles("#file", { name: "대화.txt", mimeType: "text/plain", buffer: Buffer.from(대화) });
  await page.waitForFunction(() => document.querySelector(".notice")?.textContent.includes("이미 있는"));
  확인((await page.locator(".records > li").count()) === 3, `${크기}: 같은 파일을 두 번 가져오면 겹친다`);
  await 점검(page, `${크기}-record`);

  // 진행 현황과 증거 목록
  await 가기("status");
  확인((await page.textContent(".stage.s-now")).includes("이의신청"), `${크기}: 지금 단계가 이의신청이 아니다`);
  await 점검(page, `${크기}-status`);
  await 가기("evidence");
  확인((await page.locator(".doc tbody tr").count()) >= 1, `${크기}: 증거 목록이 비었다`);
  await 점검(page, `${크기}-evidence`);
  await 가기("todo");
  await 점검(page, `${크기}-todo`);

  // 예시 사건과 기록 지우기
  await 가기("type");
  await page.click("text=대출 사기 예시");
  await page.waitForFunction(() => location.hash === "#/todo");
  확인((await page.textContent(".notice")).includes("불러왔습니다"), `${크기}: 예시 안내가 사라졌다`);
  await page.click("#wipe");
  await page.waitForFunction(() => location.hash === "#/type");
  확인(await page.evaluate(() => localStorage.getItem("gihanjigi.v1") === null || !JSON.parse(localStorage.getItem("gihanjigi.v1")).기록.length), `${크기}: 기록이 지워지지 않았다`);
  await ctx.close();
}

await browser.close();
서버.닫기();
if (문제.length) {
  console.error(문제.map((x) => `- ${x}`).join("\n"));
  process.exit(1);
}
console.log("화면 점검 통과: 휴대폰 390px, PC 1280px");
