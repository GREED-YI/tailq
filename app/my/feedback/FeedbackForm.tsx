"use client";

import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  FeedbackBody,
  feedbackLength,
} from "@/lib/feedback";
import s from "../my.module.css";

export function FeedbackForm() {
  const [category, setCategory] = useState<string>("etc");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const length = feedbackLength(body);
  const valid = FeedbackBody.safeParse(body).success;

  async function send() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, category }),
    }).catch(() => null);
    if (res?.ok) {
      setSent(true);
      return;
    }
    const data = await res?.json().catch(() => null);
    setError(
      data?.error?.message ?? "보내지 못했어요. 잠시 뒤 다시 해 주세요.",
    );
    setBusy(false);
  }

  if (sent)
    return (
      <>
        <header className={f.top}>
          <BackButton className={f.back} />
        </header>
        <h1 className={f.title}>보내 주셔서 고마워요</h1>
        <p className={f.sub}>
          운영자가 하나하나 읽고 서비스를 고치는 데 쓸게요.
        </p>
        <div className={f.bottom}>
          <button
            type="button"
            className="btn btn-secondary press"
            onClick={() => {
              setBody("");
              setCategory("etc");
              setSent(false);
              setBusy(false);
            }}
          >
            하나 더 보내기
          </button>
        </div>
      </>
    );

  return (
    <>
      <header className={f.top}>
        <BackButton className={f.back} />
        <h1 className={f.topTitle}>피드백 보내기</h1>
      </header>

      <p className={f.sub}>
        불편했던 점, 바라는 기능, 채점이 이상했던 질문까지 무엇이든 좋아요.
      </p>

      <p id="feedback-category" className={`${s.label} ${s.gap}`}>
        분류
      </p>
      <div
        role="radiogroup"
        aria-labelledby="feedback-category"
        className={s.categories}
      >
        {FEEDBACK_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            className="chip press"
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label htmlFor="feedback" className={`${s.label} ${s.gap}`}>
        의견
      </label>
      <textarea
        id="feedback"
        className={`${s.input} ${s.textarea}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="예) 복습 알림을 저녁에도 받고 싶어요"
        aria-describedby="feedback-help"
      />
      <p
        className={s.helpRow}
        data-invalid={length > FEEDBACK_MAX || undefined}
      >
        <span id="feedback-help">운영자만 읽어요. 답장은 드리지 못해요.</span>
        <span className="mono" aria-hidden="true">
          {length} / {FEEDBACK_MAX}
        </span>
      </p>
      {error && (
        <p className={s.alert} role="alert">
          {error}
        </p>
      )}

      <div className={f.bottom}>
        <button
          type="button"
          className="btn btn-primary press"
          disabled={!valid || busy}
          aria-busy={busy || undefined}
          onClick={send}
          title={valid ? undefined : `${FEEDBACK_MIN}자 이상 적어 주세요`}
        >
          {busy ? "보내는 중…" : "보내기"}
        </button>
      </div>
    </>
  );
}
