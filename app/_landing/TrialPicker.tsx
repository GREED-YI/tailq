"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { TrialField } from "@/lib/trial";
import s from "./landing.module.css";
import { openModal, useCloseOnLeave } from "@/lib/dialog";

export type TrialQuestions = Partial<
  Record<TrialField, { tag: string; prompt: string }>
> | null;

const FIELDS: { id: TrialField; label: string }[] = [
  { id: "cs", label: "공통 CS" },
  { id: "backend", label: "백엔드" },
  { id: "frontend", label: "프론트엔드" },
];

// 랜딩 맨 아래 체험(docs/04 10번 7). 분야를 고르면 그 분야의 샘플 질문으로 체험을 시작한다.
// 오늘 체험을 이미 했으면 "체험 횟수 초과" 모달(Figma S33)을 띄운다
export function TrialPicker({ questions }: { questions: TrialQuestions }) {
  const router = useRouter();
  const [field, setField] = useState<TrialField>("backend");
  const [pending, setPending] = useState(false);
  // 요청 중인지. 이동하는 동안에는 잠금을 유지하고(두 번 누르지 않게), 화면이 보관되어 숨겨질 때
  // 요청 중이 아니면 잠금을 푼다. 다시 보일 때도 요청이 끝났으면 푼다(cacheComponents라 상태를 그대로 들고 다시 보인다)
  const inFlight = useRef(false);
  useEffect(() => {
    // 다시 보일 때(숨겨진 동안 요청이 끝났으면) 잠금을 푼다
    if (!inFlight.current) setPending(false);
    return () => {
      if (!inFlight.current) setPending(false);
    };
  }, []);
  const [error, setError] = useState("");
  const limitRef = useRef<HTMLDialogElement>(null);
  // 처리 중에는 버튼이 비활성이라 초점을 잃는다. 대화상자를 닫으면 시작 버튼으로 초점을 돌린다(DESIGN.md dialog)
  const startRef = useRef<HTMLButtonElement>(null);
  useCloseOnLeave(limitRef);
  const label = FIELDS.find((f) => f.id === field)!.label;
  const q = questions?.[field];

  async function start() {
    setPending(true);
    inFlight.current = true;
    setError("");
    try {
      const res = await fetch("/api/trial-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field }),
      });
      inFlight.current = false;
      if (res.ok) {
        router.push("/trial");
        return;
      }
      const json = await res.json().catch(() => null);
      // 서비스 월 예산 소진(BUDGET_EXCEEDED)은 체험 횟수 안내가 아니라 한도 문구를 그대로 보여준다
      if (res.status === 429 && json?.error?.code === "TRIAL_LIMIT") {
        openModal(limitRef.current);
      } else {
        setError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
      }
    } catch {
      setError("잠시 뒤에 다시 시도해 주세요.");
    }
    inFlight.current = false;
    setPending(false);
  }

  // 화살표 키로 분야를 옮긴다(radiogroup 기본 동작)
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const i = FIELDS.findIndex((f) => f.id === field);
    const next = FIELDS[(i + step + FIELDS.length) % FIELDS.length];
    setField(next.id);
    e.currentTarget
      .querySelector<HTMLButtonElement>(`[data-field="${next.id}"]`)
      ?.focus();
  }

  return (
    <div className={s.tryGrid}>
      <div className={s.tryCopy}>
        <h2 id="try-title" className={s.h2}>
          가입 전에 풀어 보는 한 문제
        </h2>
        <p className={s.lead}>
          분야를 하나 고르면 답변, 채점, 꼬리질문 1개까지 그대로 해 볼 수
          있어요. 같은 날 같은 브라우저로 가입하면 이 체험이 첫 기록이 돼요.
        </p>
        <div
          className={s.fields}
          role="radiogroup"
          aria-label="체험할 분야"
          onKeyDown={onKey}
        >
          {FIELDS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              data-field={f.id}
              aria-checked={f.id === field}
              tabIndex={f.id === field ? 0 : -1}
              className="chip press"
              onClick={() => setField(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className={s.tryStart}>
        {q && (
          <div key={field} className={`fade ${s.tryQ}`}>
            <span className={s.tryTag}>
              <span className="tag tag-neutral">체험 질문</span>
              <span className="mono">{q.tag}</span>
            </span>
            <p>{q.prompt}</p>
          </div>
        )}
        <button
          type="button"
          ref={startRef}
          className={`btn btn-primary press ${s.tryBtn}`}
          onClick={start}
          disabled={pending}
          aria-busy={pending}
        >
          {label}로 시작하기
          <Icon name="arrowRight" size={18} bold />
        </button>
        {error && (
          <p className={s.tryError} role="alert">
            {error}
          </p>
        )}
        <p className={s.caption}>
          로그인 없이 하루 1번 체험할 수 있어요 · 답변은 AI 채점을 위해 전송돼요
        </p>
      </div>

      {/* 체험 횟수 초과(Figma S33, dialog confirm) */}
      <dialog
        ref={limitRef}
        className={s.dialog}
        aria-labelledby="limit-title"
        onClose={() => startRef.current?.focus()}
      >
        <h2 id="limit-title">오늘 체험은 끝났어요</h2>
        <p>가입하면 매일 새 질문과 AI 채점을 받을 수 있어요.</p>
        <div className={s.dialogButtons}>
          <button
            type="button"
            className="btn btn-md btn-secondary press"
            onClick={() => limitRef.current?.close()}
          >
            내일 다시
          </button>
          <Link href="/login" className="btn btn-md btn-primary press">
            가입하기
          </Link>
        </div>
      </dialog>
    </div>
  );
}
