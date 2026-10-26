"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { z } from "zod";
import {
  FIELDS,
  hourLabel,
  LEVELS,
  type Level,
  type MeUpdate,
} from "@/lib/profile";

type Topic = { id: string; field: string; name: string };
type Body = z.input<typeof MeUpdate>;
type Save = (body: Body) => Promise<boolean>;

const STEPS = [
  {
    title: "약관에 동의해 주세요",
    desc: "TailQ를 쓰려면 아래 항목에 모두 동의해야 해요.",
  },
  {
    title: "무엇을 연습할까요?",
    desc: "분야를 고르면 세부 주제가 모두 선택돼요. 하나씩 뺄 수 있어요.",
  },
  {
    title: "언제 질문을 받을까요?",
    desc: "정한 시각에 오늘의 질문을 알려 드려요. 나중에 MY에서 바꿀 수 있어요.",
  },
];

const card: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const label: CSSProperties = { fontSize: 13, fontWeight: 700 };

export function OnboardingFlow(props: {
  initialStep: number;
  topics: Topic[];
  initialTopics: string[];
  initialLevels: Level[];
  initialHour: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(props.initialStep);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(step);

  // 단계가 바뀌면 화면 읽기 프로그램이 새 제목부터 읽게 한다
  useEffect(() => {
    if (step !== firstStep.current) heading.current?.focus();
  }, [step]);

  const save: Save = async (body) => {
    setFailed(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) setFailed(true);
    return Boolean(res?.ok);
  };

  return (
    <section
      style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div>
        <p
          className="mono"
          style={{ fontSize: 13, color: "var(--accent)" }}
          aria-label={`3단계 중 ${step + 1}단계`}
        >
          0{step + 1} / 03
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          style={{
            marginTop: 8,
            fontSize: 26,
            lineHeight: "34px",
            fontWeight: 700,
            letterSpacing: -0.6,
            outline: "none",
          }}
        >
          {STEPS[step].title}
        </h1>
        <p style={{ marginTop: 8, fontSize: 15, color: "var(--sub)" }}>
          {STEPS[step].desc}
        </p>
      </div>

      {step === 0 && (
        <AgreeStep
          onNext={async () => (await save({ agreed: true })) && setStep(1)}
        />
      )}
      {step === 1 && (
        <RangeStep
          topics={props.topics}
          initialTopics={props.initialTopics}
          initialLevels={props.initialLevels}
          onNext={async (body) => (await save(body)) && setStep(2)}
        />
      )}
      {step === 2 && (
        <NotifyStep
          initialHour={props.initialHour}
          onDone={async (body) => {
            if (await save({ ...body, onboarded: true })) {
              router.replace("/home");
              return true;
            }
            return false;
          }}
        />
      )}

      {failed && (
        <p
          role="alert"
          style={{ fontSize: 14, color: "var(--danger)", textAlign: "center" }}
        >
          저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
}

// 누르는 동안 버튼을 잠그고, 실패하면 다시 누를 수 있게 푼다
function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<boolean | void>) => {
    setBusy(true);
    if (!(await task())) setBusy(false);
  };
  return [busy, run] as const;
}

const AGREEMENTS = [
  { id: "terms", text: "이용약관에 동의해요", href: "/terms" },
  {
    id: "privacy",
    text: "개인정보 수집·이용과 국외 이전에 동의해요",
    note: "답변은 AI 채점을 위해 미국의 AI 서비스(Anthropic)로 전송돼요.",
    href: "/privacy",
  },
  { id: "age", text: "만 14세 이상이에요" },
];

function AgreeStep({ onNext }: { onNext: () => Promise<boolean | void> }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [busy, run] = useBusy();
  const all = checked.length === AGREEMENTS.length;

  return (
    <>
      <div className="glass" style={card}>
        {AGREEMENTS.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 12 }}>
            <input
              id={`agree-${a.id}`}
              type="checkbox"
              checked={checked.includes(a.id)}
              onChange={(e) =>
                setChecked((list) =>
                  e.target.checked
                    ? [...list, a.id]
                    : list.filter((id) => id !== a.id),
                )
              }
              style={{
                width: 20,
                height: 20,
                marginTop: 2,
                flexShrink: 0,
                accentColor: "var(--accent-fill)",
              }}
            />
            <div style={{ flex: 1 }}>
              <label
                htmlFor={`agree-${a.id}`}
                style={{ fontSize: 15, cursor: "pointer" }}
              >
                <span style={{ color: "var(--accent)" }}>[필수]</span> {a.text}
              </label>
              {a.note && (
                <p style={{ marginTop: 4, fontSize: 13, color: "var(--sub)" }}>
                  {a.note}
                </p>
              )}
            </div>
            {a.href && (
              <a
                href={a.href}
                target="_blank"
                rel="noopener"
                style={{ fontSize: 13, color: "var(--sub)", flexShrink: 0 }}
              >
                보기
              </a>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary press"
        disabled={!all || busy}
        onClick={() => run(onNext)}
      >
        동의하고 계속하기
      </button>
    </>
  );
}

const toggle = <T,>(list: T[], id: T) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

function RangeStep(props: {
  topics: Topic[];
  initialTopics: string[];
  initialLevels: Level[];
  onNext: (body: Body) => Promise<boolean | void>;
}) {
  const [topics, setTopics] = useState(props.initialTopics);
  const [levels, setLevels] = useState(props.initialLevels);
  const [busy, run] = useBusy();

  return (
    <>
      {FIELDS.map((field) => {
        const ids = props.topics
          .filter((t) => t.field === field.id)
          .map((t) => t.id);
        const allOn = ids.every((id) => topics.includes(id));
        return (
          <div
            key={field.id}
            role="group"
            aria-label={field.label}
            className="glass"
            style={card}
          >
            <button
              type="button"
              className="chip glass press"
              aria-pressed={allOn}
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                setTopics((list) =>
                  allOn
                    ? list.filter((id) => !ids.includes(id))
                    : [...new Set([...list, ...ids])],
                )
              }
            >
              {field.label} 전체
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {props.topics
                .filter((t) => t.field === field.id)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="chip glass press"
                    aria-pressed={topics.includes(t.id)}
                    onClick={() => setTopics((list) => toggle(list, t.id))}
                  >
                    {t.name}
                  </button>
                ))}
            </div>
          </div>
        );
      })}

      <div
        role="group"
        aria-labelledby="levels-label"
        className="glass"
        style={card}
      >
        <p id="levels-label" style={label}>
          난이도
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className="chip glass press"
              aria-pressed={levels.includes(l.id)}
              onClick={() => setLevels((list) => toggle(list, l.id))}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary press"
        disabled={topics.length === 0 || levels.length === 0 || busy}
        onClick={() => run(() => props.onNext({ topics, levels }))}
      >
        다음
      </button>
      {(topics.length === 0 || levels.length === 0) && (
        <p
          style={{
            marginTop: -12,
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          주제와 난이도를 하나 이상 골라 주세요.
        </p>
      )}
    </>
  );
}

function NotifyStep(props: {
  initialHour: number;
  onDone: (body: Body) => Promise<boolean>;
}) {
  const [hour, setHour] = useState(props.initialHour);
  const [busy, run] = useBusy();

  // 웹 푸시 구독은 알림 발송 작업에서 붙인다. 여기서는 권한을 받고 설정만 저장한다.
  // 거부해도 온보딩은 끝내고, 홈에서 다시 켜도록 안내한다(05 사용자 흐름 "예외 상황").
  const allow = async () => {
    const permission =
      "Notification" in window
        ? await Notification.requestPermission()
        : "denied";
    return props.onDone({
      notifyOn: permission === "granted",
      notifyHour: hour,
    });
  };

  return (
    <>
      <div className="glass" style={card}>
        <label htmlFor="notify-hour" style={label}>
          알림 시각
        </label>
        <select
          id="notify-hour"
          className="glass num"
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          style={{
            height: 52,
            borderRadius: 16,
            padding: "0 16px",
            border: 0,
            font: "inherit",
            fontSize: 16,
            color: "var(--text)",
          }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary press"
          disabled={busy}
          onClick={() => run(allow)}
        >
          알림 받기
        </button>
        <button
          type="button"
          className="btn btn-secondary glass press"
          disabled={busy}
          onClick={() => run(() => props.onDone({}))}
        >
          건너뛰기
        </button>
      </div>
    </>
  );
}
