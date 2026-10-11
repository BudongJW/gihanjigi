// src/ 를 그대로 내보내는 정적 파일 서버. 시제품을 열어 볼 때와 화면 점검에 쓴다.
//   node scripts/serve.mjs [포트]     기본 4310
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const 형식 = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".gz": "application/gzip",
  ".md": "text/markdown; charset=utf-8",
};

/**
 * src/_headers 를 Cloudflare Pages 처럼 읽는다. 들여 쓰지 않은 줄은 주소 꼴(* 는 아무 글자), 들여 쓴 줄은 「이름: 값」이다.
 * 같은 이름이 여러 꼴에 걸리면 쉼표로 잇는다. 화면 점검이 배포와 같은 헤더(일꾼의 CSP 포함)로 돌게 하려는 것이다.
 */
async function 헤더규칙() {
  const 규칙 = [];
  let 지금 = null;
  for (const 줄 of (await readFile(join(뿌리, "_headers"), "utf8")).split(/\r?\n/)) {
    if (!줄.trim() || 줄.trim().startsWith("#")) continue;
    if (!/^\s/.test(줄)) {
      지금 = { 꼴: new RegExp(`^${줄.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`), 헤더: [] };
      규칙.push(지금);
    } else if (지금) {
      const i = 줄.indexOf(":");
      지금.헤더.push([줄.slice(0, i).trim().toLowerCase(), 줄.slice(i + 1).trim()]);
    }
  }
  return (길) => {
    const 모음 = {};
    for (const { 꼴, 헤더 } of 규칙) if (꼴.test(길)) for (const [k, v] of 헤더) 모음[k] = 모음[k] ? `${모음[k]}, ${v}` : v;
    return 모음;
  };
}

/** @param {number} 포트 0 이면 빈 포트를 고른다. @returns {Promise<{ 주소: string, 닫기: () => void }>} */
export async function 서버열기(포트 = 0) {
  const 헤더 = await 헤더규칙();
  const 서버 = createServer(async (req, res) => {
    const 주소길 = new URL(req.url ?? "/", "http://x").pathname;
    const 길 = normalize(decodeURIComponent(주소길)).replace(/^([/\\])+/, "");
    const 파일 = join(뿌리, 길 || "index.html");
    if (파일 !== 뿌리 && !파일.startsWith(뿌리 + sep)) { res.writeHead(403).end(); return; }
    if (길 === "_headers") { res.writeHead(404).end(); return; } // Pages 도 이 파일은 내보내지 않는다
    try {
      const 내용 = await readFile(파일);
      res.writeHead(200, { ...헤더(주소길), "content-type": 형식[extname(파일)] ?? "application/octet-stream" }).end(내용);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => 서버.listen(포트, "127.0.0.1", () => r(undefined)));
  const 주소 = 서버.address();
  return { 주소: `http://127.0.0.1:${typeof 주소 === "object" && 주소 ? 주소.port : 포트}/`, 닫기: () => 서버.close() };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { 주소 } = await 서버열기(Number(process.argv[2] ?? 4310));
  console.log(`기한지기 시제품: ${주소}`);
}
