// 화면 조각을 만드는 도구. 가져온 대화 글이 HTML 로 해석되지 않도록 글은 모두 텍스트 노드로 넣는다.

/**
 * @param {string} tag
 * @param {Record<string, unknown> | null} props
 * @param {...unknown} children
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let 값 = null;
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "value") 값 = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === "") continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  // select 는 option 이 붙은 뒤에 값을 정해야 한다
  if (값 != null) el.value = String(값);
  return el;
}

/** 글을 파일로 내려받게 한다. */
export function 내려받기(이름, 내용, 형식) {
  const 주소 = URL.createObjectURL(new Blob([내용], { type: 형식 }));
  const a = h("a", { href: 주소, download: 이름 });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(주소), 1000);
}

export async function 복사하기(글) {
  try {
    await navigator.clipboard.writeText(글);
    return true;
  } catch {
    return false;
  }
}

/** 파일을 글로 읽는다. 은행 CSV 는 EUC-KR 인 경우가 많아, UTF-8 로 읽히지 않으면 EUC-KR 로 다시 읽는다. */
export async function 글로읽기(file) {
  const 바이트 = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(바이트);
  } catch {
    return new TextDecoder("euc-kr").decode(바이트);
  }
}
