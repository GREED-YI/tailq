// @vitest-environment jsdom
import * as CFB from "cfb";
import { deflateSync, strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  NOTE_FILE_MAX_BYTES,
  NOTE_FILE_MESSAGES as M,
  NOTE_FILE_TEXT_CAP,
  fileToText,
} from "@/lib/note-file";
import { NOTE_FILE_ACCEPT } from "@/lib/questions";

// 픽스처 파일은 저장소에 두지 않고 형식마다 가장 작은 모양을 여기서 만든다
const file = (name: string, data: Uint8Array | string) =>
  new File(
    [(typeof data === "string" ? strToU8(data) : data) as BlobPart],
    name,
  );
const zip = (files: Record<string, string>) =>
  zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
  );
const text = async (f: File) => (await fileToText(f)).text;

describe("학습 자료 파일 → 글(#144)", () => {
  it("파일 고르기 창의 형식은 모두 읽거나 안내한다", async () => {
    for (const ext of NOTE_FILE_ACCEPT.split(",")) {
      await expect(fileToText(file(`a${ext}`, ""))).rejects.not.toThrow(
        M.unsupported,
      );
    }
  });

  it("50MB를 넘으면 읽기 전에 막는다", async () => {
    const big = { name: "big.pdf", size: NOTE_FILE_MAX_BYTES + 1 } as File;
    await expect(fileToText(big)).rejects.toThrow(M.tooBig);
  });

  it("옛 형식은 새 형식으로 저장하라고 안내한다", async () => {
    await expect(fileToText(file("a.doc", "x"))).rejects.toThrow(
      M.legacy("doc", ".docx"),
    );
    await expect(fileToText(file("a.PPT", "x"))).rejects.toThrow(
      M.legacy("ppt", ".pptx"),
    );
    await expect(fileToText(file("a.xls", "x"))).rejects.toThrow(
      M.legacy("xls", ".xlsx"),
    );
  });

  it("받지 않는 형식과 손상된 파일", async () => {
    await expect(fileToText(file("a.png", "x"))).rejects.toThrow(M.unsupported);
    await expect(fileToText(file("noext", "x"))).rejects.toThrow(M.unsupported);
    await expect(fileToText(file("a.pptx", "not a zip"))).rejects.toThrow(
      M.broken,
    );
    await expect(fileToText(file("a.hwp", "not a cfb"))).rejects.toThrow(
      M.broken,
    );
  });

  it("텍스트 파일은 UTF-8, 아니면 CP949로 읽는다", async () => {
    expect(await text(file("a.md", "# 제목\r\n\r\n\r\n\r\n본문  "))).toBe(
      "# 제목\n\n본문",
    );
    const cp949 = new Uint8Array([0xbe, 0xc8, 0xb3, 0xe7]);
    expect(await text(file("a.csv", cp949))).toBe("안녕");
  });

  it("빈 파일은 글자가 없다고 안내한다", async () => {
    await expect(fileToText(file("a.txt", "  \n "))).rejects.toThrow(M.noText);
  });

  it("너무 긴 글은 잘라서 알려준다", async () => {
    const r = await fileToText(
      file("a.txt", "가".repeat(NOTE_FILE_TEXT_CAP + 5)),
    );
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(NOTE_FILE_TEXT_CAP);
  });

  it("HTML은 제목·목록을 남기고 스크립트는 뺀다", async () => {
    const html = `<html><head><title>t</title><style>p{}</style></head><body>
      <h1>프로세스</h1><p>실행 중인   프로그램</p><script>alert(1)</script>
      <ul><li>코드</li><li>데이터</li></ul><pre>a\n  b</pre></body></html>`;
    expect(await text(file("a.html", html))).toBe(
      "# 프로세스\n\n실행 중인 프로그램\n\n- 코드\n- 데이터\n\n```\na\n  b\n```",
    );
  });

  it("docx", async () => {
    const data = zip({
      "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/_rels/document.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "word/styles.xml": `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
      "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>스레드</w:t></w:r></w:p>
        <w:p><w:r><w:t xml:space="preserve">자원을 </w:t></w:r><w:r><w:t>공유한다</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    expect(await text(file("a.docx", data))).toBe(
      "# 스레드\n\n자원을 공유한다",
    );
  });

  it("pptx는 슬라이드 번호 순서로 나눈다", async () => {
    const slide = (...ps: string[]) =>
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${ps
        .map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
        .join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const data = zip({
      "ppt/slides/slide10.xml": slide("열 번째"),
      "ppt/slides/slide2.xml": slide("둘째", "줄"),
      "ppt/slides/slide1.xml": slide("첫째"),
    });
    expect(await text(file("a.pptx", data))).toBe(
      "## 슬라이드 1\n\n첫째\n\n## 슬라이드 2\n\n둘째\n줄\n\n## 슬라이드 3\n\n열 번째",
    );
  });

  it("xlsx는 시트마다 행을 | 로 잇는다", async () => {
    const ns = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`;
    const data = zip({
      "xl/workbook.xml": `<workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="정리" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="x"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst ${ns}><si><t>용어</t></si><si><r><t>설</t></r><r><t>명</t></r></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet ${ns}><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="inlineStr"><is><t>TCP</t></is></c><c><v>3</v></c></row></sheetData></worksheet>`,
    });
    expect(await text(file("a.xlsx", data))).toBe(
      "## 시트: 정리\n\n용어 | 설명\nTCP | 3",
    );
  });

  it("epub은 spine 순서로 읽고, 본문이 암호화됐으면 안내한다", async () => {
    const files = {
      "META-INF/container.xml": `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
      "OEBPS/content.opf": `<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="c1" href="text/ch%201.xhtml"/><item id="c2" href="text/ch2.xhtml"/></manifest><spine><itemref idref="c2"/><itemref idref="c1"/></spine></package>`,
      "OEBPS/text/ch 1.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>둘째 장</p></body></html>`,
      "OEBPS/text/ch2.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><body><h2>첫 장</h2><p>내용</p></body></html>`,
    };
    expect(await text(file("a.epub", zip(files)))).toBe(
      "## 첫 장\n\n내용\n\n둘째 장",
    );
    const drm = {
      ...files,
      "META-INF/encryption.xml": `<encryption><EncryptedData><CipherData><CipherReference URI="OEBPS/text/ch2.xhtml"/></CipherData></EncryptedData></encryption>`,
    };
    await expect(fileToText(file("a.epub", zip(drm)))).rejects.toThrow(
      M.encrypted,
    );
  });

  it("hwpx는 문단마다 줄을 나누고 표 안 문단도 읽는다", async () => {
    const data = zip({
      "Contents/section0.xml": `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
        <hp:p><hp:run><hp:t>운영체제</hp:t></hp:run></hp:p>
        <hp:p><hp:run><hp:t>표 앞</hp:t><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>칸</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>
      </hs:sec>`,
      "Contents/section1.xml": `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run><hp:t>둘째 구역</hp:t></hp:run></hp:p></hs:sec>`,
    });
    expect(await text(file("a.hwpx", data))).toBe(
      "운영체제\n표 앞\n칸\n\n둘째 구역",
    );
  });

  it("암호가 걸린 Office 파일(zip 대신 CFB)은 암호 안내", async () => {
    const c = CFB.utils.cfb_new();
    CFB.utils.cfb_add(c, "/EncryptionInfo", strToU8("x"));
    const data = CFB.write(c, { type: "buffer" }) as Uint8Array;
    await expect(fileToText(file("a.docx", data))).rejects.toThrow(M.encrypted);
    await expect(fileToText(file("a.xlsx", data))).rejects.toThrow(M.encrypted);
  });
});

// ---- 한글 5.0 ----

function record(tag: number, data: Uint8Array) {
  const h = new Uint8Array(4);
  new DataView(h.buffer).setUint32(0, tag | (data.length << 20), true);
  return [h, data];
}
const utf16 = (codes: number[]) =>
  new Uint8Array(new Uint16Array(codes).buffer);
const chars = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function hwp(flags: number) {
  const header = new Uint8Array(256);
  header.set(strToU8("HWP Document File"));
  new DataView(header.buffer).setUint32(36, flags, true);
  // 표(확장 컨트롤 11)는 8글자를 차지하고, 탭(9)은 "\t", 13은 문단 끝이다
  const tbl = [11, 0x6274, 0x206c, 0, 0, 0, 0, 11];
  const tab = [9, 0, 0, 0, 0, 0, 0, 9];
  const parts = [
    ...record(66, new Uint8Array(22)),
    ...record(
      67,
      utf16([...chars("프로세스"), ...tbl, ...tab, ...chars("상태"), 13]),
    ),
    ...record(67, utf16([...chars("둘째 문단"), 13])),
  ];
  let body: Uint8Array = new Uint8Array(
    parts.reduce((n, p) => n + p.length, 0),
  );
  parts.reduce((o, p) => (body.set(p, o), o + p.length), 0);
  if (flags & 1) body = deflateSync(body);
  const c = CFB.utils.cfb_new();
  CFB.utils.cfb_add(c, "/FileHeader", header);
  CFB.utils.cfb_add(c, "/BodyText/Section0", body);
  return file("a.hwp", CFB.write(c, { type: "buffer" }) as Uint8Array);
}

describe("한글 5.0(.hwp)", () => {
  it("압축한 본문과 압축하지 않은 본문의 문단 글을 읽고 컨트롤 문자는 건너뛴다", async () => {
    expect(await text(hwp(1))).toBe("프로세스\t상태\n둘째 문단");
    expect(await text(hwp(0))).toBe("프로세스\t상태\n둘째 문단");
  });

  it("배포용·암호 문서와 한글 97 이전 형식은 안내한다", async () => {
    await expect(fileToText(hwp(0b101))).rejects.toThrow(M.distribution);
    await expect(fileToText(hwp(0b011))).rejects.toThrow(M.encrypted);
    await expect(
      fileToText(file("a.hwp", "HWP Document File V3.00 \x1a\x01\x02")),
    ).rejects.toThrow(M.legacyHwp);
  });
});

// ---- PDF ----

// 가장 작은 PDF. 오프셋 표(xref)를 계산해 붙인다
function pdf(
  content: string,
  extra = { trailer: "", objects: [] as string[] },
) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...extra.objects,
  ];
  let s = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => {
    const at = s.length;
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = s.length;
  s += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  s += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  s += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${extra.trailer}>>\nstartxref\n${xref}\n%%EOF\n`;
  return file("a.pdf", s);
}

describe("PDF", () => {
  it("글자 층의 글을 뽑는다", async () => {
    expect(
      await text(pdf("BT /F1 12 Tf 20 100 Td (Process and thread) Tj ET")),
    ).toBe("Process and thread");
  });

  it("글자가 없는 PDF(스캔본)는 읽을 수 없다고 안내한다", async () => {
    await expect(fileToText(pdf(""))).rejects.toThrow(M.noText);
  });

  it("암호가 걸린 PDF는 암호 안내", async () => {
    const hex = "<" + "ab".repeat(32) + ">";
    const encrypted = pdf("BT /F1 12 Tf (secret) Tj ET", {
      objects: [`<< /Filter /Standard /V 1 /R 2 /O ${hex} /U ${hex} /P -4 >>`],
      trailer: `/Encrypt 6 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>] `,
    });
    await expect(fileToText(encrypted)).rejects.toThrow(M.encrypted);
  });
});
