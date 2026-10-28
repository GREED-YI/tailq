// 학습 자료 파일 → 글(04 기능 명세 9번 "학습 자료", #144). 변환은 모두 브라우저에서 하고 파일은 서버로 보내지 않는다.
// 이 모듈과 형식마다 쓰는 라이브러리는 파일을 고를 때만 import()로 불러와 평소 페이지 크기에 들어가지 않게 한다
import { NOTE_CONTENT_MAX } from "@/lib/questions";

// 변환은 브라우저 메모리에서 하므로 기기가 버티는 선. 서버·AI 비용과는 무관하다
export const NOTE_FILE_MAX_BYTES = 50 * 1024 * 1024;
// 등록 한도를 넘는 글도 입력칸에 넣어 줄이게 하지만, 큰 표·책처럼 수백만 자가 나오면 입력칸이 멈춘다.
// 그래서 한도의 10배에서 자른다
export const NOTE_FILE_TEXT_CAP = NOTE_CONTENT_MAX * 10;

// 사용자에게 그대로 보여줄 안내를 담는다. 화면은 이 모듈을 늦게 불러오므로 instanceof 대신 name으로 가린다
export class NoteFileError extends Error {
  name = "NoteFileError";
}

export const NOTE_FILE_MESSAGES = {
  tooBig:
    "파일이 50MB를 넘어요. 필요한 부분만 나누거나 내보내서 다시 불러와 주세요.",
  unsupported:
    "읽을 수 없는 형식이에요. PDF, Word, PowerPoint, Excel, 한글, EPUB, HTML, 텍스트 파일을 불러와 주세요.",
  legacy: (ext: string, to: string) =>
    `옛 형식(.${ext}) 파일은 읽지 못해요. ${to} 또는 PDF로 저장해서 다시 불러와 주세요.`,
  legacyHwp:
    "한글 97 이전 형식은 읽지 못해요. 한글에서 .hwp(또는 .hwpx)로 다시 저장해서 불러와 주세요.",
  noText:
    "파일에서 글자를 찾지 못했어요. 스캔한 PDF나 그림만 있는 파일은 읽을 수 없어요.",
  encrypted:
    "암호가 걸린 파일은 읽지 못해요. 암호를 풀고 다시 저장해서 불러와 주세요.",
  distribution:
    "배포용 한글 문서는 읽지 못해요. 일반 문서로 저장하거나 PDF로 내보내서 불러와 주세요.",
  broken:
    "파일을 읽지 못했어요. 파일이 손상되지 않았는지 확인하거나 내용을 복사해 붙여넣어 주세요.",
};
const M = NOTE_FILE_MESSAGES;

const LEGACY: Record<string, string> = {
  doc: ".docx",
  ppt: ".pptx",
  xls: ".xlsx",
};

// 파일을 글(마크다운에 가까운 텍스트)로 바꾼다. 읽을 수 없으면 안내를 담은 NoteFileError를 던진다.
// truncated: NOTE_FILE_TEXT_CAP에서 잘랐는지
export async function fileToText(
  file: File,
): Promise<{ text: string; truncated: boolean }> {
  if (file.size > NOTE_FILE_MAX_BYTES) throw new NoteFileError(M.tooBig);
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (LEGACY[ext]) throw new NoteFileError(M.legacy(ext, LEGACY[ext]));
  const read = READERS[ext];
  if (!read) throw new NoteFileError(M.unsupported);

  let text;
  try {
    text = tidy(await read(new Uint8Array(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof NoteFileError) throw e;
    // pdf.js는 암호가 걸린 PDF에서 PasswordException을 던진다
    if ((e as Error | null)?.name === "PasswordException") {
      throw new NoteFileError(M.encrypted);
    }
    throw new NoteFileError(M.broken);
  }
  if (!text) throw new NoteFileError(M.noText);
  const truncated = text.length > NOTE_FILE_TEXT_CAP;
  return {
    text: truncated ? text.slice(0, NOTE_FILE_TEXT_CAP) : text,
    truncated,
  };
}

type Reader = (data: Uint8Array) => Promise<string>;

const READERS: Record<string, Reader> = {
  txt: async (d) => decodeText(d),
  md: async (d) => decodeText(d),
  markdown: async (d) => decodeText(d),
  csv: async (d) => decodeText(d),
  json: async (d) => decodeText(d),
  html: async (d) => htmlToText(parseHtml(decodeText(d))),
  htm: async (d) => htmlToText(parseHtml(decodeText(d))),
  pdf: readPdf,
  docx: readDocx,
  pptx: readPptx,
  xlsx: readXlsx,
  epub: readEpub,
  hwpx: readHwpx,
  hwp: readHwp,
};

// UTF-8이 아니면 한국어 윈도우의 기본 인코딩(CP949)으로 본다. 엑셀에서 저장한 CSV·메모장 TXT가 흔히 그렇다
function decodeText(d: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(d);
  } catch {
    return new TextDecoder("euc-kr").decode(d);
  }
}

// 줄 끝 공백을 지우고 빈 줄은 하나까지만 남긴다
function tidy(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+$/gm, "")
    .replace(/^ (?=\S)/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- HTML·XML ----

const parseHtml = (s: string) =>
  new DOMParser().parseFromString(s, "text/html");

function parseXml(s: string) {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("xml");
  return doc;
}

const BLOCK = new Set(
  "address article aside blockquote dd div dl dt figcaption figure footer header main nav ol p section table tbody thead tr ul".split(
    " ",
  ),
);
const SKIP = new Set("head script style noscript template svg math".split(" "));

// 제목은 #, 목록은 -, 코드는 ``` 로 남기고 나머지 태그는 글만 둔다
function htmlToText(doc: Document) {
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      out += (n.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).localName;
    if (SKIP.has(tag)) return;
    if (tag === "br") return void (out += "\n");
    if (tag === "pre")
      return void (out += `\n\`\`\`\n${n.textContent}\n\`\`\`\n`);
    const h = /^h([1-6])$/.exec(tag);
    if (h) out += `\n\n${"#".repeat(+h[1])} `;
    else if (tag === "li") out += "\n- ";
    else if (tag === "td" || tag === "th") out += " ";
    else if (BLOCK.has(tag)) out += "\n";
    n.childNodes.forEach(walk);
    if (h || BLOCK.has(tag)) out += "\n";
  };
  walk(doc.body ?? doc.documentElement);
  return out;
}

const byName = (root: Document | Element, name: string) =>
  Array.from(root.getElementsByTagNameNS("*", name));

// 문단(p)마다 그 안의 글(t)을 이어 붙인다(pptx의 a:p·a:t, hwpx의 hp:p·hp:t).
// 표 안의 문단처럼 문단 안에 문단이 있으면 안쪽 글은 안쪽 문단 몫이다
function paragraphs(doc: Document) {
  return byName(doc, "p")
    .map((p) =>
      byName(p, "t")
        .filter((t) => {
          let e = t.parentElement;
          while (e && e.localName !== "p") e = e.parentElement;
          return e === p;
        })
        .map((t) => t.textContent)
        .join(""),
    )
    .join("\n");
}

// ---- ZIP 형식(pptx·xlsx·epub·hwpx) ----

// 암호가 걸린 Office 파일은 zip이 아니라 CFB(옛 Office 컨테이너)에 담겨 있다
const isCfb = (d: Uint8Array) =>
  d[0] === 0xd0 && d[1] === 0xcf && d[2] === 0x11 && d[3] === 0xe0;

async function unzip(d: Uint8Array, want: (name: string) => boolean) {
  if (isCfb(d)) throw new NoteFileError(M.encrypted);
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(d, { filter: (f) => want(f.name) });
  const text = (name: string) => {
    const f = files[name];
    if (!f) throw new Error(`missing ${name}`);
    return strFromU8(f);
  };
  return { names: Object.keys(files), text };
}

// zip 안의 상대 경로 풀기(epub의 ../, %20 같은 것)
const resolvePath = (base: string, href: string) =>
  decodeURIComponent(new URL(href, `file:///${base}`).pathname.slice(1));

// slide10이 slide2 뒤에 오게 숫자로 정렬한다
const byNumber = (re: RegExp) => (a: string, b: string) =>
  Number(a.match(re)?.[1]) - Number(b.match(re)?.[1]);

async function readDocx(d: Uint8Array) {
  if (isCfb(d)) throw new NoteFileError(M.encrypted);
  const mammoth = (await import("mammoth")).default;
  const buf = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
  // 브라우저 빌드는 arrayBuffer, Node(테스트)는 buffer를 읽는다. 그림은 글에 쓰지 않으니 빈 주소로 둔다
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: buf, buffer: buf } as unknown as {
      arrayBuffer: ArrayBuffer;
    },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  return htmlToText(parseHtml(value));
}

async function readPptx(d: Uint8Array) {
  const slide = /^ppt\/slides\/slide(\d+)\.xml$/;
  const { names, text } = await unzip(d, (n) => slide.test(n));
  return names
    .sort(byNumber(slide))
    .map((n, i) => `## 슬라이드 ${i + 1}\n\n${paragraphs(parseXml(text(n)))}`)
    .join("\n\n");
}

async function readXlsx(d: Uint8Array) {
  // 그림 같은 다른 파일은 풀지 않는다
  const { text } = await unzip(d, (n) =>
    /^xl\/(?:[^/]+\.xml|_rels\/[^/]+\.rels|worksheets\/[^/]+\.xml)$/.test(n),
  );
  const shared = (() => {
    try {
      return byName(parseXml(text("xl/sharedStrings.xml")), "si").map((si) =>
        byName(si, "t")
          .map((t) => t.textContent)
          .join(""),
      );
    } catch {
      return []; // 글 칸이 없는 통합 문서에는 sharedStrings가 없다
    }
  })();
  const rels = new Map(
    byName(parseXml(text("xl/_rels/workbook.xml.rels")), "Relationship").map(
      (r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""],
    ),
  );
  // ponytail: 날짜도 엑셀 일련번호 그대로 나온다. 서식(styles.xml)까지 읽어야 날짜로 바꿀 수 있다
  return byName(parseXml(text("xl/workbook.xml")), "sheet")
    .map((sheet) => {
      const path = resolvePath(
        "xl/workbook.xml",
        rels.get(sheet.getAttribute("r:id")) ?? "",
      );
      const rows = byName(parseXml(text(path)), "row").map((row) =>
        byName(row, "c")
          .map((c) => {
            const type = c.getAttribute("t");
            if (type === "inlineStr") return c.textContent ?? "";
            const v = byName(c, "v")[0]?.textContent ?? "";
            return type === "s" ? (shared[+v] ?? "") : v;
          })
          .join(" | "),
      );
      return `## 시트: ${sheet.getAttribute("name")}\n\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

async function readEpub(d: Uint8Array) {
  const { text } = await unzip(d, (n) => /\.(?:x?html?|xml|opf)$/i.test(n));
  // DRM으로 본문을 암호화한 책은 encryption.xml에 본문 파일이 적혀 있다(글꼴만 감춘 책은 읽을 수 있다)
  try {
    if (/URI="[^"]+\.x?html?"/i.test(text("META-INF/encryption.xml"))) {
      throw new NoteFileError(M.encrypted);
    }
  } catch (e) {
    if (e instanceof NoteFileError) throw e;
  }
  const opfPath =
    byName(
      parseXml(text("META-INF/container.xml")),
      "rootfile",
    )[0]?.getAttribute("full-path") ?? "";
  const opf = parseXml(text(opfPath));
  const hrefs = new Map(
    byName(opf, "item").map((i) => [
      i.getAttribute("id"),
      i.getAttribute("href") ?? "",
    ]),
  );
  return byName(opf, "itemref")
    .map((ref) => {
      const href = hrefs.get(ref.getAttribute("idref"));
      if (!href) return "";
      const html = text(resolvePath(opfPath, href));
      const doc = new DOMParser().parseFromString(
        html,
        "application/xhtml+xml",
      );
      return htmlToText(
        doc.getElementsByTagName("parsererror").length ? parseHtml(html) : doc,
      );
    })
    .join("\n\n");
}

async function readHwpx(d: Uint8Array) {
  const section = /^Contents\/section(\d+)\.xml$/;
  const { names, text } = await unzip(
    d,
    (n) => section.test(n) || n === "META-INF/manifest.xml",
  );
  if (names.includes("META-INF/manifest.xml")) {
    if (/encryption-data/.test(text("META-INF/manifest.xml"))) {
      throw new NoteFileError(M.encrypted);
    }
  }
  const sections = names.filter((n) => section.test(n));
  if (!sections.length) throw new Error("no section");
  return sections
    .sort(byNumber(section))
    .map((n) => paragraphs(parseXml(text(n))))
    .join("\n\n");
}

// ---- 한글 5.0(.hwp) ----
// 공개된 "한글 문서 파일 형식 5.0" 문서를 따른다. CFB 안의 FileHeader에서 압축·암호·배포용 여부를 보고,
// BodyText/Section0, 1, …을 (압축이면 raw deflate를 풀어) 레코드로 나눈 뒤 문단 글(HWPTAG_PARA_TEXT)만 읽는다

const HWPTAG_PARA_TEXT = 0x10 + 51;

async function readHwp(d: Uint8Array) {
  const head = new TextDecoder("latin1").decode(d.subarray(0, 32));
  if (head.startsWith("HWP Document File V3")) {
    throw new NoteFileError(M.legacyHwp);
  }
  const CFB = await import("cfb");
  const { inflateSync } = await import("fflate");
  const cfb = CFB.read(d, { type: "array" });
  const bytes = (path: string) => {
    const c = CFB.find(cfb, path)?.content;
    return c ? Uint8Array.from(c as ArrayLike<number>) : null;
  };

  const header = bytes("/FileHeader");
  if (
    !header ||
    new TextDecoder("latin1").decode(header.subarray(0, 17)) !==
      "HWP Document File"
  ) {
    throw new Error("not hwp");
  }
  const flags = new DataView(header.buffer).getUint32(36, true);
  if (flags & 0b100) throw new NoteFileError(M.distribution);
  if (flags & 0b10) throw new NoteFileError(M.encrypted);

  const out: string[] = [];
  for (let i = 0; ; i++) {
    const raw = bytes(`/BodyText/Section${i}`);
    if (!raw) break;
    const body = flags & 1 ? inflateSync(raw) : raw;
    out.push(hwpSectionText(body));
  }
  if (!out.length) throw new Error("no section");
  return out.join("\n\n");
}

// 레코드 머리(4바이트): 태그 10비트, 수준 10비트, 크기 12비트. 크기가 0xFFF면 다음 4바이트가 크기다
function hwpSectionText(d: Uint8Array) {
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const paras: string[] = [];
  for (let i = 0; i + 4 <= d.length;) {
    const h = view.getUint32(i, true);
    i += 4;
    let size = h >>> 20;
    if (size === 0xfff) {
      size = view.getUint32(i, true);
      i += 4;
    }
    if ((h & 0x3ff) === HWPTAG_PARA_TEXT) {
      paras.push(hwpParaText(d.subarray(i, i + size)));
    }
    i += size;
  }
  return paras.join("\n");
}

// 문단 글은 UTF-16LE. 0~31은 제어 문자다: 문자 컨트롤(0, 10, 13, 24~31)은 1글자,
// 인라인·확장 컨트롤(1~9, 11, 12, 14~23)은 컨트롤 정보까지 8글자(16바이트)를 차지한다
function hwpParaText(b: Uint8Array) {
  let s = "";
  for (let j = 0; j + 1 < b.length;) {
    const c = b[j] | (b[j + 1] << 8);
    if (c >= 32) {
      s += String.fromCharCode(c);
      j += 2;
      continue;
    }
    if (c === 9) s += "\t";
    else if (c === 10) s += "\n";
    else if (c === 24) s += "-";
    else if (c === 30 || c === 31) s += " ";
    // 13은 문단 끝. 문단은 줄로 나눠 잇는다
    j += c >= 1 && c <= 23 && c !== 10 && c !== 13 ? 16 : 2;
  }
  return s;
}

// ---- PDF ----

async function readPdf(d: Uint8Array) {
  // legacy 빌드는 최신 기능이 없는 휴대폰 브라우저에서도 돈다
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node(테스트)에서는 pdf.js가 미리 채운다. 브라우저에서는 번들러가 이 파일을 따로 내보낸 주소를 쓴다
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const task = pdfjs.getDocument({
    data: d,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    let length = 0;
    for (let i = 1; i <= doc.numPages && length <= NOTE_FILE_TEXT_CAP; i++) {
      const page = await doc.getPage(i);
      const { items } = await page.getTextContent();
      const text = items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : ""))
        .join("");
      page.cleanup();
      pages.push(text);
      length += text.length;
    }
    // 글자 층이 없는 스캔 PDF는 비거나 쪽 번호 정도만 나온다(쪽마다 평균 10자 미만)
    if (pages.join("").replace(/\s/g, "").length < pages.length * 10) {
      throw new NoteFileError(M.noText);
    }
    return pages.join("\n\n");
  } finally {
    void task.destroy();
  }
}
