"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { TrialField } from "@/lib/trial";
import s from "./landing.module.css";

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
  const [error, setError] = useState("");
  const limitRef = useRef<HTMLDialogElement>(null);
  const label = FIELDS.find((f) => f.id === field)!.label;
  const q = questions?.[field];

  async function start() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/trial-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field }),
      });
      if (res.ok) {
        router.push("/trial");
        return;
      }
      if (res.status === 429) {
        limitRef.current?.showModal();
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "잠시 뒤에 다시 시도해 주세요.");
      }
    } catch {
      setError("잠시 뒤에 다시 시도해 주세요.");
    }
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
        <h2 id="try-title" className={s.tryTitle}>
          지금 바로
          <br />한 문제 풀어보기
        </h2>
        <p className={s.lead}>분야를 고르면 샘플 질문 하나로 체험해요.</p>
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
              className={`press ${s.field}`}
              onClick={() => setField(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className={s.tryStart}>
        {q && (
          <div key={field} className={`glass fade ${s.tryQ}`}>
            <span className={`mono ${s.tag}`}>{q.tag}</span>
            <strong>{q.prompt}</strong>
          </div>
        )}
        <button
          type="button"
          className={`btn btn-primary press ${s.cta} ${s.tryBtn}`}
          onClick={start}
          disabled={pending}
          aria-busy={pending}
        >
          {label}로 시작하기
          <span className={s.arrow}>
            <Icon name="arrowRight" size={18} bold />
          </span>
        </button>
        {error && (
          <p className={s.tryError} role="alert">
            {error}
          </p>
        )}
        <p className={s.tryNote}>
          로그인 없이 하루 1번 체험할 수 있어요 · 답변은 AI 채점을 위해 전송돼요
        </p>
      </div>

      {/* 체험 횟수 초과(Figma S33) */}
      <dialog
        ref={limitRef}
        className={`glass-strong ${s.dialog}`}
        aria-labelledby="limit-title"
      >
        <span className={s.dialogFox} aria-hidden="true" />
        <h2 id="limit-title">오늘 체험은 끝났어요</h2>
        <p>
          가입하면 매일 새 질문과
          <br />
          AI 채점을 받을 수 있어요.
        </p>
        <div className={s.dialogActions}>
          <button
            type="button"
            className="glass btn btn-md btn-secondary press"
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
