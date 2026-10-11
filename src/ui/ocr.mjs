// 사진 속 글자를 이 기기 안에서 읽는다. Tesseract.js(한국어 LSTM 모델)를 같은 주소의 src/vendor/tesseract 에서만 불러온다.
// 사진은 페이지 안의 canvas 로 다듬어 일꾼(worker)에게 넘기고, 읽은 글은 돌려받기만 한다. 서버로 보내는 것은 없다.
// 페이지의 CSP(connect-src 'none')는 그대로다. 모델 파일을 받는 일꾼에는 src/_headers 가 같은 주소만 허용하는 CSP 를 붙인다.

const 폴더 = new URL("../vendor/tesseract/", import.meta.url).href;

/** WebAssembly SIMD 를 쓸 수 있는지(wasm-feature-detect 의 simd 시험과 같은 바이트) */
const SIMD = (() => {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
})();

let 불러옴 = null;
function 엔진() {
  불러옴 ??= new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = `${폴더}tesseract.min.js`;
    s.onload = () => (globalThis.Tesseract ? ok(globalThis.Tesseract) : no(new Error("Tesseract 없음")));
    s.onerror = () => no(new Error("글자 인식 파일을 불러오지 못했습니다"));
    document.head.append(s);
  });
  return 불러옴;
}

/**
 * 사진을 글자 인식에 맞게 다듬는다. 회색조로 바꾸고 대비를 높인 뒤 흑백으로 가르고, 왼쪽에 여백을 둔다.
 * 말풍선 왼쪽 끝 글자가 잘리던 것을 여백이 막는다(지어낸 화면 실험, 2026-10-11). 어두운 화면은 뒤집는다.
 */
async function 다듬기(파일) {
  const 그림 = await createImageBitmap(파일);
  const 여백 = Math.round(그림.width * 0.05);
  const c = document.createElement("canvas");
  c.width = 그림.width + 여백 * 2;
  c.height = 그림.height;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#fff";
  x.fillRect(0, 0, c.width, c.height);
  x.filter = "grayscale(1) contrast(1.8) brightness(1.15)";
  x.drawImage(그림, 여백, 0);
  그림.close?.();
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  let 합 = 0;
  for (let i = 0; i < p.length; i += 4) 합 += p[i];
  const 어두움 = 합 / (p.length / 4) < 110;
  for (let i = 0; i < p.length; i += 4) {
    const 밝음 = 어두움 ? p[i] > 105 : p[i] >= 150;
    const v = 밝음 === 어두움 ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/**
 * 사진 여러 장의 글을 읽는다.
 * @param {File[]} 파일들
 * @param {(파일: File, 순서: number) => void} [진행] 한 장을 읽기 시작할 때 부른다
 * @returns {Promise<{ 파일: File, 글: string | null, 문제: string | null }[]>}
 */
export async function 사진글읽기(파일들, 진행 = () => {}) {
  const Tesseract = await 엔진();
  const 일꾼 = await Tesseract.createWorker("kor", 1, {
    workerPath: `${폴더}worker.min.js`,
    workerBlobURL: false,
    corePath: `${폴더}${SIMD ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js"}`,
    langPath: 폴더.replace(/\/$/, ""),
    gzip: true,
  });
  const 결과 = [];
  try {
    for (const [i, 파일] of 파일들.entries()) {
      진행(파일, i);
      try {
        const { data } = await 일꾼.recognize(await 다듬기(파일));
        결과.push({ 파일, 글: data.text ?? "", 문제: null });
      } catch (e) {
        결과.push({ 파일, 글: null, 문제: String(e?.message ?? e) });
      }
    }
  } finally {
    await 일꾼.terminate();
  }
  return 결과;
}
