# 기기 안 글자 인식에 쓰는 파일

사진 속 글을 이 기기 안에서 읽는 데 쓴다(`src/ui/ocr.mjs`). 사진과 읽은 글은 기기 밖으로 나가지 않는다. 처음 쓸 때만
이 폴더의 파일을 받고, 다른 주소에서는 아무것도 받지 않는다. 이 폴더의 응답에는 같은 주소만 허용하는 CSP 를 따로
붙인다(`src/_headers`).

| 파일 | 출처 | 판 | 사용권 |
|---|---|---|---|
| `tesseract.min.js`, `worker.min.js` | npm `tesseract.js` 의 `dist/` | 7.0.0 | Apache-2.0 (`LICENSE-tesseract.js.md`) |
| `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js` | npm `tesseract.js-core` | 7.0.0 | Apache-2.0 (`LICENSE-tesseract.js-core.txt`). Tesseract OCR 과 Leptonica 를 WebAssembly 로 옮긴 것이다 |
| `kor.traineddata.gz` | npm `@tesseract.js-data/kor` 의 `4.0.0_best_int/` | 1.0.0 | 꾸러미는 MIT, 모델은 tesseract-ocr/tessdata_best(Apache-2.0) |

판을 올릴 때는 이 표와 `src/ui/ocr.mjs` 의 파일 이름을 함께 고친다.
