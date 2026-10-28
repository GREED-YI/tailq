"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice } from "@/components/LimitNotice";
import {
  CONTENT_MAX,
  CONTENT_MIN,
  NAME_MAX,
  NOTE_CONTENT_MAX,
  NOTE_FILE_ACCEPT,
} from "@/lib/questions";
import s from "@/app/(app)/projects/projects.module.css";

// 프로젝트와 학습 자료(#141)는 같은 등록 화면을 쓰고 API·글·내용 한도만 다르다. 학습 자료는 파일을 불러올 수 있다(#144)
const COPY = {
  project: {
    api: "/api/projects",
    max: CONTENT_MAX,
    title: "프로젝트 등록",
    nameLabel: "프로젝트 이름",
    namePlaceholder: "예: 혜자 - 청년 지원금 매칭",
    contentLabel: "README 또는 설명",
    contentPlaceholder: "README나 프로젝트 설명을 붙여넣어 주세요",
    help: "README를 넣으면 예상 질문 5개를 만들어 줘요",
    back: "프로젝트 목록으로",
    backHref: "/projects",
  },
  note: {
    api: "/api/notes",
    max: NOTE_CONTENT_MAX,
    title: "학습 자료 등록",
    nameLabel: "학습 자료 제목",
    namePlaceholder: "예: 운영체제 - 프로세스와 스레드",
    contentLabel: "학습 자료(마크다운·텍스트)",
    contentPlaceholder:
      "정리한 글을 붙여넣거나 수업 자료 파일(PDF·Word·PPT·한글 등)을 불러와 주세요",
    // 375에서 글자 수와 한 줄에 들어가게 짧게 둔다
    help: "개념 질문 5개를 만들어 줘요",
    back: "학습 자료 목록으로",
    backHref: "/projects/notes",
  },
};

// 이름과 README(학습 자료)를 받아 등록하고, 질문을 만드는 동안 보여줄 질문 목록 화면으로 간다.
// notice가 있으면(오늘 등록 한도·월 예산 소진) 입력칸 대신 안내만 보여준다
export function ProjectForm({
  kind = "project",
  notice,
}: {
  kind?: keyof typeof COPY;
  notice: Notice | null;
}) {
  const c = COPY[kind];
  const router = useRouter();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 파일을 읽지 못했거나 글이 한도를 넘을 때의 안내. 파일 칸에 묶어 보여 주고, 읽지 못했으면 이미 쓴 글은 그대로 둔다
  const [fileError, setFileError] = useState("");
  // 파일을 글로 바꾸는 중(큰 PDF는 몇 초 걸린다)
  const [reading, setReading] = useState(false);
  // 요청 중인지와 등록했는지. 등록하면 이동하는 동안 잠금을 유지하고, 화면이 보관되어 숨겨지거나 다시 보일 때
  // 요청 중이 아니면 잠금을 푼다(cacheComponents라 상태를 그대로 들고 다시 보인다. TrialPicker와 같다).
  // 등록한 뒤라면 칸도 비워 새 등록 화면이 빈 칸으로 열리게 한다
  const inFlight = useRef(false);
  const created = useRef(false);
  useEffect(() => {
    const release = () => {
      if (inFlight.current) return;
      setBusy(false);
      if (created.current) {
        created.current = false;
        setName("");
        setContent("");
      }
    };
    release();
    return release;
  }, []);

  const length = content.trim().length;
  const valid =
    name.trim().length > 0 && length >= CONTENT_MIN && length <= c.max;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy || reading) return;
    setBusy(true);
    inFlight.current = true;
    setError("");
    const res = await fetch(c.api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        kind === "note" ? { title: name, content } : { name, content },
      ),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    inFlight.current = false;
    if (res?.ok) {
      created.current = true;
      router.replace(
        kind === "note"
          ? `/projects/notes/${json.note.id}`
          : `/projects/${json.project.id}`,
      );
      return;
    }
    setBusy(false);
    setError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
  }

  // 파일은 브라우저에서 글로 바꿔 입력칸에 넣는다. 파일 자체는 서버로 보내지도 저장하지도 않는다(#141, #144).
  // 변환 코드와 형식별 라이브러리는 파일을 고를 때 불러온다. 한도를 넘는 글도 넣어 두고 줄이면 등록할 수 있게 한다
  async function load(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 일어나게 비운다
    e.target.value = "";
    if (!file) return;
    setReading(true);
    setFileError("");
    try {
      const { fileToText } = await import("@/lib/note-file");
      const { text, truncated } = await fileToText(file);
      const n = text.trim().length;
      setContent(text);
      if (n > c.max) {
        setFileError(
          `${truncated ? "글이 너무 길어 앞부분만 넣었어요. " : ""}${n.toLocaleString()}자예요. ${c.max.toLocaleString()}자 이하로 줄이면 등록할 수 있어요.`,
        );
      }
    } catch (err) {
      setFileError(
        (err as Error).name === "NoteFileError"
          ? (err as Error).message
          : "파일을 읽지 못했어요. 내용을 복사해 붙여넣어 주세요.",
      );
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <header className={s.top}>
        <Link href={c.backHref} className="press icon-btn" aria-label={c.back}>
          <Icon name="chevronLeft" />
        </Link>
        <h1>{c.title}</h1>
      </header>

      {notice ? (
        <LimitNotice {...notice} />
      ) : (
        <form className={s.form} onSubmit={submit}>
          <label htmlFor="project-name" className={s.label}>
            {c.nameLabel}
          </label>
          <input
            id="project-name"
            className={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder={c.namePlaceholder}
            autoComplete="off"
            required
          />

          <label htmlFor="project-content" className={`${s.label} ${s.gap}`}>
            {c.contentLabel}
          </label>
          <textarea
            id="project-content"
            className={s.textarea}
            data-over={length > c.max || undefined}
            aria-invalid={
              (length > 0 && length < CONTENT_MIN) ||
              length > c.max ||
              undefined
            }
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setFileError("");
            }}
            placeholder={c.contentPlaceholder}
            spellCheck={false}
            aria-describedby="project-help"
            required
          />
          <p
            id="project-help"
            className={s.help}
            data-over={length > c.max || undefined}
          >
            <span className={s.mobileHelp}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : c.help}
            </span>
            <span className={`num ${s.pcHelp}`}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : `최대 ${c.max.toLocaleString()}자까지 붙여넣을 수 있어요`}
            </span>
            <span className="mono" aria-live="polite">
              {length.toLocaleString()} / {c.max.toLocaleString()}
            </span>
          </p>
          {kind === "note" && (
            <div className={s.fileRow}>
              {/* 진짜 파일 칸은 화면에서만 숨기고(키보드·화면 읽기 프로그램은 그대로 쓴다) 버튼 모양 label을 보인다 */}
              <input
                id="project-file"
                type="file"
                className={`sr-only ${s.fileInput}`}
                accept={NOTE_FILE_ACCEPT}
                onChange={load}
                disabled={busy || reading}
                aria-invalid={fileError ? true : undefined}
                aria-describedby={fileError ? "project-file-error" : undefined}
              />
              <label
                htmlFor="project-file"
                className="btn btn-md btn-secondary press"
              >
                {reading ? "파일을 읽고 있어요" : "파일 불러오기"}
              </label>
              {fileError && (
                <p
                  id="project-file-error"
                  className={s.fieldError}
                  role="alert"
                >
                  {fileError}
                </p>
              )}
            </div>
          )}

          <div className={s.bottom}>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary press"
              disabled={!valid || busy || reading}
              aria-busy={busy || undefined}
            >
              {busy ? "등록하고 있어요" : "질문 5개 생성"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
