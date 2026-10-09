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
};

/** @param {number} 포트 0 이면 빈 포트를 고른다. @returns {Promise<{ 주소: string, 닫기: () => void }>} */
export async function 서버열기(포트 = 0) {
  const 서버 = createServer(async (req, res) => {
    const 길 = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)).replace(/^([/\\])+/, "");
    const 파일 = join(뿌리, 길 || "index.html");
    if (파일 !== 뿌리 && !파일.startsWith(뿌리 + sep)) { res.writeHead(403).end(); return; }
    try {
      const 내용 = await readFile(파일);
      res.writeHead(200, { "content-type": 형식[extname(파일)] ?? "application/octet-stream" }).end(내용);
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
