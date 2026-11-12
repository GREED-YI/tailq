"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import d from "@/components/Dialog.module.css";
import { Icon } from "@/components/icons";
import type { TrialField } from "@/lib/trial";
import s from "./landing.module.css";
import { openModal } from "@/lib/dialog";

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
export function TrialPicker({
  questions,
}: {
  questions: Promise<TrialQuestions>;
}) {
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
  const label = FIELDS.find((f) => f.id === field)!.label;
  // JS가 붙기 전에 바뀐 선택(브라우저가 radio를 바꿔 둔다)을 이어받는다
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v =
      groupRef.current?.querySelector<HTMLInputElement>("input:checked")?.value;
    if (v) setField(v as TrialField);
  }, []);

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

  return (
    <div className={s.tryGrid}>
      <div className={s.tryCopy}>
        <h2 id="try-title" className={s.h2}>
          가입 전 면접 체험
        </h2>
        <p className={s.lead}>
          원하는 분야를 고르면 채점부터 꼬리질문 1개까지 체험해 볼 수 있어요.
          같은 날 이 브라우저에서 이어서 가입하면 체험 기록이 그대로 저장돼요.
        </p>
        {/* 로그인 전 랜딩이라 JS가 붙기 전에 누를 수 있어 공용 radio-group(button radio) 대신 네이티브 radio를 쓴다(#182).
            방향키·Tab 한 번 멈춤도 브라우저가 맡는다 */}
        <div
          ref={groupRef}
          className={s.fields}
          role="radiogroup"
          aria-label="체험할 분야"
        >
          {FIELDS.map((f) => (
            <label key={f.id} className="chip press">
              <input
                type="radio"
                name="trial-field"
                value={f.id}
                className="sr-only"
                defaultChecked={f.id === "backend"}
                onChange={() => setField(f.id)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div className={s.tryStart}>
        <Suspense
          fallback={
            // 질문이 오기 전: .tryQ와 같은 선·여백에 태그 한 줄, 질문 두 줄 자리를 잡아 아래 버튼이 거의 밀리지 않게 한다
            <div className={s.tryQs}>
              <p role="status" className="sr-only">
                질문을 불러오는 중이에요
              </p>
              <div className={`${s.tryQ} ${s.tryWait}`} aria-hidden="true">
                <span className="skeleton" />
                <p>
                  <span className="skeleton" />
                  <span className="skeleton" />
                </p>
              </div>
            </div>
          }
        >
          <TrialPreview questions={questions} field={field} />
        </Suspense>
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
      <Dialog
        ref={limitRef}
        title="오늘 체험은 끝났어요"
        onClose={() => startRef.current?.focus()}
      >
        <p>가입하면 매일 새 질문과 AI 채점을 받을 수 있어요.</p>
        <div className={d.buttons}>
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
      </Dialog>
    </div>
  );
}

// 분야별 체험 질문 미리보기. 질문은 DB에서 늦게 오므로 이 칸만 기다린다
function TrialPreview({
  questions: promise,
  field,
}: {
  questions: Promise<TrialQuestions>;
  field: TrialField;
}) {
  const questions = use(promise);
  if (!questions) return null;
  return (
    // 분야를 바꾸면 바뀐 질문을 읽어 준다. 알림은 늘 남아 있는 이 감싸개에 건다(새로 그려지는 칸에 걸면 알리지 않는다).
    // 세 질문을 같은 칸에 겹쳐 두고 고른 것만 보인다(나머지는 visibility로 숨겨 높이만 잡는다)
    <div className={s.tryQs} aria-live="polite">
      {FIELDS.map(({ id }) => {
        const q = questions[id];
        if (!q) return null;
        const on = id === field;
        return (
          <div
            key={on ? `on-${id}` : id}
            className={on ? `fade ${s.tryQ}` : s.tryQ}
            data-off={on ? undefined : ""}
          >
            <span className={s.tryTag}>
              <span className="tag tag-neutral">체험 질문</span>
              <span className="mono">{q.tag}</span>
            </span>
            <p>{q.prompt}</p>
          </div>
        );
      })}
    </div>
  );
}
