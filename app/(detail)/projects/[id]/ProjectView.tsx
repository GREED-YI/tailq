"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice, UsageLine } from "@/components/LimitNotice";
import { scoreColor } from "@/app/interview/verdict";
import s from "@/app/(app)/projects/projects.module.css";
import { openModal, useCloseOnLeave } from "@/lib/dialog";
import { DAILY_SESSIONS } from "@/lib/questions";

// state: 최근 점수("72점"·"모르겠어요"), 연습 중("doing"), 아직 안 함(null). score는 점수 색을 고를 때 쓴다
// open: 열린 세션이 있으면 한도와 상관없이 이어 할 수 있다(점수가 있어도 꼬리질문 중일 수 있다)
export type QuestionRow = {
  id: number;
  prompt: string;
  state: string | null;
  score: number | null;
  open: boolean;
};

// 월 예산에 닿으면 다시 만들기 대신 보여준다(04 기능 명세 12장. 서버 전용 모듈이라 문구만 둔다)
const LIMIT_MESSAGE = "오늘은 사용 한도를 모두 썼어요. 내일 다시 만나요";

// 생성 상태를 다시 읽는 간격(08 설계 "내 프로젝트 질문 생성": 2초마다)
const POLL_MS = 2000;

// 프로젝트와 학습 자료(#141)는 같은 화면을 쓰고 API 주소와 글만 다르다
const COPY = {
  project: {
    api: "/api/projects",
    noun: "프로젝트",
    nameLabel: "프로젝트 이름",
    source: "쓴 README",
    back: "프로젝트 목록으로",
    backHref: "/projects",
  },
  note: {
    api: "/api/notes",
    noun: "학습 자료",
    nameLabel: "학습 자료 제목",
    source: "넣은 학습 자료",
    back: "학습 자료 목록으로",
    backHref: "/projects/notes",
  },
};

export function ProjectView({
  kind = "project",
  id,
  name,
  status,
  questions,
  notice,
  sessionsLeft,
  canRetry,
}: {
  kind?: keyof typeof COPY;
  id: string;
  name: string;
  status: "generating" | "ready" | "failed";
  questions: QuestionRow[];
  // 하루 연습 한도나 월 예산에 닿았으면 안내(S26). 새 연습은 막고 하던 연습만 이어 할 수 있다
  notice: Notice | null;
  // 오늘 남은 면접 연습 횟수. 월 예산이 다 찼으면 null(숨긴다)
  sessionsLeft: number | null;
  canRetry: boolean;
}) {
  const c = COPY[kind];
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useCloseOnLeave(dialogRef);
  const [busy, setBusy] = useState<number | "delete" | "retry" | null>(null);
  // 요청 중인지. 이동하는 동안에는 잠금을 유지하고(두 번 누르지 않게), 화면이 보관되어 숨겨질 때
  // 요청 중이 아니면 잠금을 푼다. 다시 보일 때도 요청이 끝났으면 푼다(cacheComponents라 상태를 그대로 들고 다시 보인다)
  const inFlight = useRef(false);
  useEffect(() => {
    // 다시 보일 때(숨겨진 동안 요청이 끝났으면) 잠금을 푼다
    if (!inFlight.current) setBusy(null);
    return () => {
      if (!inFlight.current) setBusy(null);
    };
  }, []);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  // 삭제 확인 창에 다시 쓴 프로젝트 이름(학습 자료 제목). 똑같이 써야 삭제 버튼이 켜진다(#118, 사용자 요청)
  const [typedName, setTypedName] = useState("");
  const nameMatches = typedName.trim() === name.trim();

  // 만드는 동안 서버 컴포넌트를 다시 그려 프로젝트 행을 읽는다(RLS 읽기 정책 안에서)
  useEffect(() => {
    if (status !== "generating") return;
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [status, router]);

  // 질문을 누르면 그 질문의 세션을 열고(열린 세션이 있으면 이어서) 면접 화면으로
  async function practice(questionId: number) {
    setBusy(questionId);
    inFlight.current = true;
    setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "project", questionId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    inFlight.current = false;
    if (res?.ok) {
      router.push(`/interview?session=${json.session.id}`);
      return;
    }
    setBusy(null);
    setError(json?.error?.message ?? "연습을 시작하지 못했어요.");
  }

  async function retry() {
    setBusy("retry");
    setError("");
    const res = await fetch(`${c.api}/${id}/generations`, {
      method: "POST",
    }).catch(() => null);
    if (res?.ok || res?.status === 409) {
      router.refresh();
      return;
    }
    // 페이지를 연 뒤 월 예산이 바닥났으면(429) 서버 문구로 알린다
    const json = await res?.json().catch(() => null);
    setBusy(null);
    setError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
  }

  async function remove() {
    setBusy("delete");
    setDeleteError("");
    const res = await fetch(`${c.api}/${id}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (res?.ok) {
      router.replace(c.backHref);
      router.refresh();
      return;
    }
    const json = await res?.json().catch(() => null);
    setBusy(null);
    setDeleteError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
  }

  return (
    <>
      <header className={s.top}>
        <Link href={c.backHref} className="press icon-btn" aria-label={c.back}>
          <Icon name="chevronLeft" />
        </Link>
        <h1>{name}</h1>
      </header>

      {status === "ready" ? (
        <>
          <h2 className={`num ${s.title}`}>
            면접관이 물을 법한 질문 {questions.length}개
          </h2>
          <p className={s.desc}>질문을 누르면 바로 연습할 수 있어요</p>
          {sessionsLeft !== null && (
            <UsageLine items={[["면접 연습", sessionsLeft, DAILY_SESSIONS]]} />
          )}
          {notice && <LimitNotice {...notice} />}
          <ol className={`${s.rows} ${s.qRows}`}>
            {questions.map((q, i) => {
              // 한도에 닿아 새로 시작할 수 없는 질문. 왜 막혔는지 칸에서도 보이게 자물쇠와 "오늘 한도"를 단다.
              // 비활성 버튼은 브라우저에 따라 마우스 설명을 안 띄워 li에 title을 둔다
              const locked = notice !== null && !q.open;
              return (
                <li
                  key={q.id}
                  title={
                    locked
                      ? "오늘 연습 한도를 모두 썼어요. 내일 다시 할 수 있어요"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={`hover-row ${s.row} ${s.qRow}`}
                    disabled={busy !== null || locked}
                    data-locked={locked ? "" : undefined}
                    aria-busy={busy === q.id || undefined}
                    onClick={() => practice(q.id)}
                  >
                    <span className={`mono ${s.qNo}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className={s.qPrompt}>{q.prompt}</span>
                      <span className={`num ${s.qState}`}>
                        {q.state === null ? (
                          "아직 안 함"
                        ) : q.state === "doing" ? (
                          "연습 중"
                        ) : (
                          <>
                            <span className={s.done}>연습함</span> ·{" "}
                            <span
                              style={
                                q.score === null
                                  ? undefined
                                  : { color: scoreColor(q.score) }
                              }
                            >
                              {q.state}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    {locked ? (
                      <span className={s.lockTag}>
                        <Icon name="lock" size={14} />
                        오늘 한도
                      </span>
                    ) : busy === q.id ? (
                      // 누른 행만 화살표 자리에 진행 표시(list-row loading)
                      <span className={s.qSpin} aria-hidden="true" />
                    ) : (
                      <Icon name="chevronRight" size={18} />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <section className={s.state} aria-live="polite">
          {status === "generating" ? (
            <>
              <strong>질문 5개를 만들고 있어요</strong>
              <p>
                1분쯤 걸려요.
                <br />
                다른 화면으로 가도 계속 만들고 있을게요.
              </p>
            </>
          ) : (
            <>
              <strong>질문을 만들지 못했어요</strong>
              {canRetry ? (
                <>
                  <p>
                    {c.source}는 그대로 남아 있어요.
                    <br />
                    다시 만들어도 오늘 한도는 그대로예요.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary press"
                    disabled={busy !== null}
                    aria-busy={busy === "retry" || undefined}
                    onClick={retry}
                  >
                    다시 만들기
                  </button>
                </>
              ) : (
                <p>{LIMIT_MESSAGE}</p>
              )}
            </>
          )}
        </section>
      )}
      {/* 만드는 동안 질문 5줄 자리. 다 만들어지면 같은 자리에 질문 목록이 들어온다 */}
      {status === "generating" && (
        <ol className={`${s.rows} ${s.qRows}`} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className={s.skeleton}>
              <i />
              <span>
                <i />
                <i />
              </span>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p className={s.error} role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {/* 처음엔 머리 오른쪽 알약이었는데, 실수로 누르기 쉬운 자리라 목록 맨 아래로 내렸다(#118, 사용자 요청).
          확인 창으로 들어가는 길이라 작은 글자 링크(danger-ghost), 실행 버튼은 확인 창 안의 "삭제" */}
      <div className={s.deleteBottom}>
        <button
          type="button"
          className="btn-danger-ghost press"
          disabled={busy === "delete"}
          onClick={() => {
            setDeleteError("");
            setTypedName("");
            openModal(dialogRef.current);
          }}
        >
          {c.noun} 삭제하기
        </button>
      </div>

      {/* 삭제 확인(S25). 질문·기록·복습 일정이 함께 지워진다(04 기능 명세 9번) */}
      <dialog
        ref={dialogRef}
        className={s.dialog}
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">
          {name} {c.noun}를 지울까요?
        </h2>
        <p>
          질문 {questions.length || 5}개와 답변 기록, 복습 일정까지
          <br />
          함께 지워지고 되돌릴 수 없어요.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameMatches && busy !== "delete") remove();
          }}
        >
          <label htmlFor="delete-name" className={s.dialogLabel}>
            삭제하려면 {c.nameLabel}을 똑같이 입력해 주세요
          </label>
          <input
            id="delete-name"
            className={s.input}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {deleteError && (
            <p className={s.error} role="alert">
              {deleteError}
            </p>
          )}
          <div className={s.dialogActions}>
            <button
              type="button"
              className="btn btn-md btn-secondary press"
              onClick={() => dialogRef.current?.close()}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-md btn-danger press"
              disabled={!nameMatches || busy === "delete"}
              aria-busy={busy === "delete" || undefined}
            >
              삭제
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
