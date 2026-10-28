"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice } from "@/components/LimitNotice";
import { openModal, useCloseOnLeave } from "@/lib/dialog";
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
    contentLabel: "학습 자료 내용",
    // 받는 형식은 글을 넣으면 사라지는 placeholder가 아니라 파일 버튼 옆 안내에 둔다
    contentPlaceholder: "정리한 글을 붙여넣거나 아래에서 파일을 불러와 주세요",
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
  // 파일 칸 아래 안내 한 칸: 읽는 중 · 읽은 결과(fileNote) · 읽지 못한 이유(fileError).
  // 읽지 못했으면 이미 쓴 글은 그대로 둔다. 한도 초과는 글 상태라 입력칸 아래 도움말 줄이 맡는다
  const [fileError, setFileError] = useState("");
  const [fileNote, setFileNote] = useState<{
    n: number;
    replaced: boolean;
    truncated: boolean;
  } | null>(null);
  const [fileName, setFileName] = useState("");
  // 파일을 글로 바꾸는 중(큰 PDF는 몇 초 걸린다). 그동안 입력칸은 읽기 전용, 등록은 잠근다
  const [reading, setReading] = useState(false);
  // 입력칸에 파일을 끌어 올린 중(PC)
  const [dragging, setDragging] = useState(false);
  // 쓴 글을 바꿀지 묻는 동안 고른 파일
  const pending = useRef<File | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(confirmRef);
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

  // 학습 자료 화면에서는 입력칸 밖에 파일을 떨어뜨려도 브라우저가 그 파일로 이동해 화면을 떠나지 않게 한다.
  // 입력칸이 먼저 받아 처리한 것(defaultPrevented)은 그대로 두고, 나머지는 놓을 수 없다고 표시한다
  const dropGuard = kind === "note" && !notice;
  useEffect(() => {
    if (!dropGuard) return;
    const dragOver = (e: DragEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const drop = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", dragOver);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", dragOver);
      window.removeEventListener("drop", drop);
    };
  }, [dropGuard]);

  const length = content.trim().length;
  const over = length - c.max;
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
  // 고르기 창과 끌어다 놓기가 모두 여기로 온다. 이미 쓴 글이 있으면 읽기 전에 바꿀지 묻는다(큰 PDF를 헛읽지 않게)
  function pick(file: File) {
    if (reading || busy) return;
    if (content.trim()) {
      pending.current = file;
      openModal(confirmRef.current);
      return;
    }
    read(file);
  }

  // 변환 코드와 형식별 라이브러리는 이때 불러온다. 한도를 넘는 글도 넣어 두고 줄이면 등록할 수 있게 한다
  async function read(file: File) {
    const replaced = content.trim().length > 0;
    setReading(true);
    setFileError("");
    setFileNote(null);
    setFileName(file.name);
    try {
      const { fileToText } = await import("@/lib/note-file");
      const { text, truncated } = await fileToText(file);
      setContent(text);
      setFileNote({ n: text.trim().length, replaced, truncated });
    } catch (err) {
      setFileError(
        (err as Error).name === "NoteFileError"
          ? (err as Error).message
          : "파일을 읽지 못했어요. 잠시 뒤에 다시 불러오거나 내용을 붙여넣어 주세요.",
      );
    } finally {
      setReading(false);
    }
  }

  // 끌어다 놓기는 학습 자료에서 파일일 때만 받는다(입력칸 안 글 끌어 옮기기는 그대로)
  const takesFile = (e: React.DragEvent) =>
    kind === "note" && e.dataTransfer.types.includes("Files");

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
          {/* 끌어다 놓기 안내는 입력칸 위에 겹쳐 보인다 */}
          <div className={s.dropZone}>
            <textarea
              id="project-content"
              className={s.textarea}
              data-over={length > c.max || undefined}
              data-drag={dragging || undefined}
              aria-invalid={
                (length > 0 && length < CONTENT_MIN) ||
                length > c.max ||
                undefined
              }
              value={content}
              readOnly={reading}
              onChange={(e) => {
                setContent(e.target.value);
                setFileError("");
                setFileNote(null);
              }}
              onDragOver={(e) => {
                if (!takesFile(e)) return;
                e.preventDefault();
                const ok = !reading && !busy;
                e.dataTransfer.dropEffect = ok ? "copy" : "none";
                setDragging(ok);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                if (!takesFile(e)) return;
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) pick(file);
              }}
              placeholder={c.contentPlaceholder}
              spellCheck={false}
              aria-describedby="project-help"
              required
            />
            {dragging && (
              <span className={s.dropLabel} aria-hidden="true">
                여기에 놓으면 불러와요
              </span>
            )}
          </div>
          <p
            id="project-help"
            className={s.help}
            data-over={over > 0 || undefined}
          >
            {/* 한도를 넘으면 줄일 양을 글자 수에서 매번 계산한다(붙여넣어 넘겨도, 고치는 중에도 맞다) */}
            <span className={s.mobileHelp}>
              {over > 0 ? (
                <>
                  <span className="mono">{over.toLocaleString()}</span>자 줄여
                  주세요
                </>
              ) : length > 0 && length < CONTENT_MIN ? (
                `${CONTENT_MIN}자 이상 써 주세요`
              ) : (
                c.help
              )}
            </span>
            <span className={`num ${s.pcHelp}`}>
              {over > 0 ? (
                <>
                  <span className="mono">{over.toLocaleString()}</span>자 줄이면
                  등록할 수 있어요
                </>
              ) : length > 0 && length < CONTENT_MIN ? (
                `${CONTENT_MIN}자 이상 써 주세요`
              ) : (
                `최대 ${c.max.toLocaleString()}자까지 붙여넣을 수 있어요`
              )}
            </span>
            <span className="mono" aria-live="polite">
              {length.toLocaleString()} / {c.max.toLocaleString()}
            </span>
          </p>
          {kind === "note" && (
            <div className={s.fileRow}>
              {/* 진짜 파일 칸은 화면에서만 숨기고(키보드·화면 읽기 프로그램은 그대로 쓴다) 버튼 모양 label을 보인다.
                  읽는 동안은 disabled 대신 aria-disabled + 고르기 창 막기로 잠근다(비활성화하면 초점이 사라진다) */}
              <input
                id="project-file"
                type="file"
                className={`sr-only ${s.fileInput}`}
                accept={NOTE_FILE_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // 같은 파일을 다시 골라도 change가 일어나게 비운다
                  e.target.value = "";
                  if (file) pick(file);
                }}
                onClick={(e) => reading && e.preventDefault()}
                disabled={busy}
                aria-disabled={reading || undefined}
                aria-invalid={fileError ? true : undefined}
                aria-describedby="project-file-hint project-file-msg"
              />
              <label
                htmlFor="project-file"
                className="btn btn-md btn-secondary press"
                aria-busy={reading || undefined}
              >
                파일 불러오기
              </label>
              <span id="project-file-hint" className={s.fileHint}>
                PDF·Word·PowerPoint·한글 등 · 50MB까지
              </span>
              {/* 비어 있어도 늘 두는 알림 칸(나중에 붙인 live 영역은 첫 알림을 놓칠 수 있다) */}
              <p
                id="project-file-msg"
                className={s.fileMsg}
                data-error={(!reading && !!fileError) || undefined}
                aria-live="polite"
              >
                {reading ? (
                  <>
                    <span className={s.fileName}>{fileName}</span>
                    <span>· 읽고 있어요</span>
                  </>
                ) : fileError ? (
                  fileError
                ) : (
                  fileNote && (
                    <>
                      <span className={s.fileName}>{fileName}</span>
                      <span>
                        {"· "}
                        {fileNote.truncated && "글이 너무 길어 앞부분 "}
                        <span className="mono">
                          {fileNote.n.toLocaleString()}
                        </span>
                        {fileNote.truncated
                          ? "자만 넣었어요"
                          : fileNote.replaced
                            ? "자로 바꿨어요"
                            : "자 넣었어요"}
                      </span>
                    </>
                  )
                )}
              </p>
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

      {/* 쓴 글을 파일 내용으로 바꾸기 전 확인. 기본은 계속 쓰기. 바꾸기는 위험 색을 쓰지 않는다(owner 결정) */}
      {kind === "note" && (
        <dialog
          ref={confirmRef}
          className={s.dialog}
          aria-labelledby="replace-title"
          onClose={() => (pending.current = null)}
        >
          <h2 id="replace-title">작성한 글을 파일 내용으로 바꿀까요?</h2>
          <p>지금 쓴 글은 지워지고 되돌릴 수 없어요.</p>
          <div className={s.dialogActions}>
            <button
              type="button"
              className="btn btn-md btn-secondary press"
              autoFocus
              onClick={() => confirmRef.current?.close()}
            >
              계속 쓰기
            </button>
            <button
              type="button"
              className="btn btn-md btn-primary press"
              onClick={() => {
                const file = pending.current;
                confirmRef.current?.close();
                if (file) read(file);
              }}
            >
              바꾸기
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
