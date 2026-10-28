"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice } from "@/components/LimitNotice";
import { CONTENT_MAX, CONTENT_MIN, NAME_MAX } from "@/lib/questions";
import s from "@/app/(app)/projects/projects.module.css";

// 프로젝트와 학습 자료(#141)는 같은 등록 화면을 쓰고 API·글만 다르다. 학습 자료는 .md 파일을 불러올 수 있다
const COPY = {
  project: {
    api: "/api/projects",
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
    title: "학습 자료 등록",
    nameLabel: "학습 자료 제목",
    namePlaceholder: "예: 운영체제 - 프로세스와 스레드",
    contentLabel: "학습 자료(마크다운·텍스트)",
    contentPlaceholder:
      "정리한 글이나 수업 자료를 붙여넣거나 .md 파일을 불러와 주세요",
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
  // .md 파일을 읽지 못했거나 너무 길 때의 안내. 파일 칸에 묶어 보여 주고, 이미 쓴 글은 그대로 둔다
  const [fileError, setFileError] = useState("");
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
    name.trim().length > 0 && length >= CONTENT_MIN && length <= CONTENT_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
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

  // .md 파일은 브라우저에서 글로 읽어 입력칸에 넣는다. 파일 자체는 서버로 보내지도 저장하지도 않는다(#141)
  async function load(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 일어나게 비운다
    e.target.value = "";
    if (!file) return;
    const text = await file.text().catch(() => null);
    if (text === null) {
      setFileError("파일을 읽지 못했어요. 내용을 복사해 붙여넣어 주세요.");
      return;
    }
    const n = text.trim().length;
    if (n > CONTENT_MAX) {
      setFileError(
        `파일이 ${n.toLocaleString()}자예요. ${CONTENT_MAX.toLocaleString()}자 이하로 줄여서 다시 불러와 주세요.`,
      );
      return;
    }
    setFileError("");
    setContent(text);
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
            data-over={length > CONTENT_MAX || undefined}
            aria-invalid={
              (length > 0 && length < CONTENT_MIN) ||
              length > CONTENT_MAX ||
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
            data-over={length > CONTENT_MAX || undefined}
          >
            <span className={s.mobileHelp}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : c.help}
            </span>
            <span className={`num ${s.pcHelp}`}>
              {length > 0 && length < CONTENT_MIN
                ? `${CONTENT_MIN}자 이상 써 주세요`
                : "최대 10,000자까지 붙여넣을 수 있어요"}
            </span>
            <span className="mono" aria-live="polite">
              {length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}
            </span>
          </p>
          {kind === "note" && (
            <div className={s.fileRow}>
              {/* 진짜 파일 칸은 화면에서만 숨기고(키보드·화면 읽기 프로그램은 그대로 쓴다) 버튼 모양 label을 보인다 */}
              <input
                id="project-file"
                type="file"
                className={`sr-only ${s.fileInput}`}
                accept=".md,.markdown,.txt"
                onChange={load}
                disabled={busy}
                aria-invalid={fileError ? true : undefined}
                aria-describedby={fileError ? "project-file-error" : undefined}
              />
              <label
                htmlFor="project-file"
                className="btn btn-md btn-secondary press"
              >
                .md 파일 불러오기
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
              disabled={!valid || busy}
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
