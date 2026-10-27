"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FloatingQ } from "@/components/FloatingQ";
import { Icon } from "@/components/icons";
import { LimitNotice, type Notice } from "@/components/LimitNotice";
import { scoreColor } from "@/app/interview/verdict";
import s from "@/app/(app)/projects/projects.module.css";

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

export function ProjectView({
  id,
  name,
  status,
  questions,
  notice,
  canRetry,
}: {
  id: string;
  name: string;
  status: "generating" | "ready" | "failed";
  questions: QuestionRow[];
  // 하루 연습 한도나 월 예산에 닿았으면 안내(S26). 새 연습은 막고 하던 연습만 이어 할 수 있다
  notice: Notice | null;
  canRetry: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<number | "delete" | "retry" | null>(null);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // 만드는 동안 서버 컴포넌트를 다시 그려 프로젝트 행을 읽는다(RLS 읽기 정책 안에서)
  useEffect(() => {
    if (status !== "generating") return;
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [status, router]);

  // 질문을 누르면 그 질문의 세션을 열고(열린 세션이 있으면 이어서) 면접 화면으로
  async function practice(questionId: number) {
    setBusy(questionId);
    setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "project", questionId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (res?.ok) {
      // cacheComponents라 면접으로 갔다가 뒤로 오면 이 화면이 상태를 그대로 들고 다시 보인다.
      // 요청이 끝난 뒤(이동 직전)에 잠금을 풀어야, 요청 중에는 두 번 누를 수 없고 돌아왔을 때는 막혀 있지 않다
      setBusy(null);
      router.push(`/interview?session=${json.session.id}`);
      return;
    }
    setBusy(null);
    setError(json?.error?.message ?? "연습을 시작하지 못했어요.");
  }

  async function retry() {
    setBusy("retry");
    setError("");
    const res = await fetch(`/api/projects/${id}/generations`, {
      method: "POST",
    }).catch(() => null);
    if (res?.ok || res?.status === 409) {
      router.refresh();
      return;
    }
    setBusy(null);
    setError("잠시 뒤에 다시 시도해 주세요.");
  }

  async function remove() {
    setBusy("delete");
    setDeleteError("");
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (res?.ok) {
      router.replace("/projects");
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
        <Link
          href="/projects"
          className="glass press icon-btn"
          aria-label="내 프로젝트로"
        >
          <Icon name="chevronLeft" />
        </Link>
        <h1>{name}</h1>
        <button
          type="button"
          className={`glass press ${s.pill}`}
          onClick={() => {
            setDeleteError("");
            dialogRef.current?.showModal();
          }}
        >
          삭제
        </button>
      </header>

      {status === "ready" ? (
        <>
          <h2 className={`num ${s.title}`}>
            면접관이 물을 법한 질문 {questions.length}개
          </h2>
          <p className={s.desc}>질문을 누르면 바로 연습해요</p>
          {notice && <LimitNotice {...notice} />}
          <ol className={`glass ${s.rows}`}>
            {questions.map((q, i) => {
              // 한도에 닿아 새로 시작할 수 없는 질문. 왜 막혔는지 칸에서도 보이게 자물쇠와 "오늘 한도"를 단다.
              // 비활성 버튼은 브라우저에 따라 마우스 설명을 안 띄워 li에 title을 둔다
              const locked = notice !== null && !q.open;
              return (
                <li
                  key={q.id}
                  title={
                    locked
                      ? "오늘 프로젝트 연습 한도를 모두 썼어요. 내일 다시 할 수 있어요"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={`hover-row ${s.row} ${s.qRow}`}
                    disabled={busy !== null || locked}
                    data-locked={locked ? "" : undefined}
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
        <section className={`glass ${s.state}`} aria-live="polite">
          <FloatingQ size={88} thinking={status === "generating"} />
          {status === "generating" ? (
            <>
              <strong>질문 5개를 만들고 있어요</strong>
              <p>
                1분쯤 걸려요.
                <br />이 화면을 나가도 계속 만들어요.
              </p>
            </>
          ) : (
            <>
              <strong>질문을 만들지 못했어요</strong>
              {canRetry ? (
                <>
                  <p>
                    쓴 README는 그대로 있어요.
                    <br />
                    다시 만들어 볼까요?
                  </p>
                  <button
                    type="button"
                    className="btn btn-md btn-primary press"
                    disabled={busy !== null}
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
      {error && (
        <p className={s.error} role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {/* 삭제 확인(S25). 질문·기록·복습 일정이 함께 지워진다(04 기능 명세 9번) */}
      <dialog
        ref={dialogRef}
        className={`glass-strong ${s.dialog}`}
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">{name} 프로젝트를 지울까요?</h2>
        <p>
          질문 {questions.length || 5}개와 답변 기록, 복습 일정도
          <br />
          함께 지워지고 되돌릴 수 없어요.
        </p>
        {deleteError && (
          <p className={s.error} role="alert">
            {deleteError}
          </p>
        )}
        <div className={s.dialogActions}>
          <button
            type="button"
            className="glass btn btn-md btn-secondary press"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            취소
          </button>
          <button
            type="button"
            className="glass btn btn-md btn-danger press"
            disabled={busy === "delete"}
            onClick={remove}
          >
            삭제
          </button>
        </div>
      </dialog>
    </>
  );
}
