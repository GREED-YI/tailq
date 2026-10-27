"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { z } from "zod";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import { Icon } from "@/components/icons";
import {
  FIELDS,
  hourLabel,
  LEVELS,
  type Level,
  type MeUpdate,
} from "@/lib/profile";
import { SUBSCRIBE_ERRORS, subscribePush } from "@/lib/push-client";
import s from "./onboarding.module.css";

type Topic = { id: string; field: string; name: string };
type Body = z.input<typeof MeUpdate>;
type Save = (body: Body) => Promise<boolean>;

const STEPS: { title: ReactNode; desc: ReactNode }[] = [
  {
    title: "서비스 이용에 동의해주세요",
    desc: "세 가지 모두 동의하면 시작할 수 있어요",
  },
  {
    title: "연습할 범위를 골라주세요",
    desc: "여러 개 고를 수 있고, 나중에 MY에서 바꿀 수 있어요",
  },
  {
    title: (
      <>
        매일 질문을 알림으로
        <br />
        받을까요?
      </>
    ),
    desc: (
      <>
        정한 시각에 오늘의 질문을 알려드려요.
        <br />
        이미 푼 날은 보내지 않아요.
      </>
    ),
  },
];

export function OnboardingFlow(props: {
  initialStep: number;
  topics: Topic[];
  initialTopics: string[];
  initialLevels: Level[];
  initialHour: number;
  vapidKey: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(props.initialStep);
  const [failed, setFailed] = useState(false);
  const [hour, setHour] = useState(props.initialHour);
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
    <>
      <header className={f.top}>
        {/* 첫 단계는 돌아갈 곳이 없어 자리만 둔다 */}
        {step > 0 && (
          <BackButton className={f.back} onClick={() => setStep(step - 1)} />
        )}
        {/* progress-steps: 지난 단계 text, 지금 accent, 남은 단계 mark-empty 테두리 */}
        <div
          role="img"
          aria-label={`3단계 중 ${step + 1}단계`}
          className={s.steps}
        >
          <span className="mono">{step + 1} / 3</span>
          <span className={s.bars}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                data-state={i < step ? "done" : i === step ? "now" : "next"}
              />
            ))}
          </span>
        </div>
      </header>

      {step === 2 && <NotifyPreview hour={hour} />}

      <h1 ref={heading} tabIndex={-1} className={f.title}>
        {STEPS[step].title}
      </h1>
      <p className={f.sub}>{STEPS[step].desc}</p>

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
          vapidKey={props.vapidKey}
          hour={hour}
          setHour={setHour}
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
        <p role="alert" className={s.alert}>
          저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </>
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

// 체크 상자. 실제 입력은 감춘 checkbox라 행 전체를 눌러도 된다
function Check(props: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className={s.check}>
      <input
        type="checkbox"
        className="sr-only"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className={s.box} aria-hidden>
        <Icon name="check" size={14} bold />
      </span>
      {props.label}
    </label>
  );
}

// 국외 이전은 따로 알려야 해서(03 요구사항 "개인정보") 개인정보처리방침 줄 아래에 적는다
const AGREEMENTS = [
  { id: "terms", text: "이용약관", href: "/terms" },
  {
    id: "privacy",
    text: "개인정보처리방침",
    note: "국외 이전 포함. 답변은 AI 채점을 위해 미국의 AI 서비스(Anthropic)⁠로 전송돼요.",
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
      <div className={s.allRow}>
        <Check
          checked={all}
          onChange={(on) => setChecked(on ? AGREEMENTS.map((a) => a.id) : [])}
          label={<strong>전체 동의</strong>}
        />
      </div>
      <ul className={s.rows}>
        {AGREEMENTS.map((a) => (
          <li key={a.id} className={s.row}>
            <Check
              checked={checked.includes(a.id)}
              onChange={(on) =>
                setChecked((list) =>
                  on ? [...list, a.id] : list.filter((id) => id !== a.id),
                )
              }
              label={
                <span>
                  <span className={s.required}>(필수)</span> {a.text}
                  {a.note && <small className={s.note}>{a.note}</small>}
                </span>
              }
            />
            {a.href && (
              <a
                href={a.href}
                target="_blank"
                rel="noopener"
                className={`btn btn-secondary btn-md press ${s.view}`}
              >
                보기
              </a>
            )}
          </li>
        ))}
      </ul>
      <div className={f.bottom}>
        <button
          type="button"
          className="btn btn-primary press"
          disabled={!all || busy}
          aria-busy={busy}
          onClick={() => run(onNext)}
        >
          다음
        </button>
      </div>
    </>
  );
}

const toggle = <T,>(list: T[], id: T) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

// 연습 범위 고르기. MY의 연습 범위 바꾸기(/my/range)도 같은 화면을 쓴다
export function RangeStep(props: {
  topics: Topic[];
  initialTopics: string[];
  initialLevels: Level[];
  onNext: (body: Body) => Promise<boolean | void>;
  label?: string;
}) {
  const [topics, setTopics] = useState(props.initialTopics);
  const [levels, setLevels] = useState(props.initialLevels);
  const [busy, run] = useBusy();
  const empty = topics.length === 0 || levels.length === 0;

  return (
    <>
      {FIELDS.map((field) => {
        const ids = props.topics
          .filter((t) => t.field === field.id)
          .map((t) => t.id);
        const allOn = ids.every((id) => topics.includes(id));
        return (
          <section
            key={field.id}
            role="group"
            aria-labelledby={`field-${field.id}`}
            className={s.field}
          >
            <div className={s.fieldHead}>
              <h2 id={`field-${field.id}`}>{field.label}</h2>
              {/* 칩과 헷갈리지 않게 선택 상태 대신 문구가 바뀌는 글자 버튼 */}
              <button
                type="button"
                className={`btn btn-ghost press ${s.all}`}
                aria-label={`${field.label} ${allOn ? "전체 해제" : "전체 선택"}`}
                onClick={() =>
                  setTopics((list) =>
                    allOn
                      ? list.filter((id) => !ids.includes(id))
                      : [...new Set([...list, ...ids])],
                  )
                }
              >
                <Icon name={allOn ? "close" : "check"} size={14} bold />
                {allOn ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className={s.chips}>
              {props.topics
                .filter((t) => t.field === field.id)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="chip press"
                    aria-pressed={topics.includes(t.id)}
                    onClick={() => setTopics((list) => toggle(list, t.id))}
                  >
                    {t.name}
                  </button>
                ))}
            </div>
          </section>
        );
      })}

      <section role="group" aria-labelledby="levels-label" className={s.field}>
        <h2 id="levels-label">난이도</h2>
        <div className={s.chips}>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className="chip press"
              aria-pressed={levels.includes(l.id)}
              onClick={() => setLevels((list) => toggle(list, l.id))}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <div className={f.bottom}>
        <button
          type="button"
          className="btn btn-primary press"
          disabled={empty || busy}
          aria-busy={busy}
          onClick={() => run(() => props.onNext({ topics, levels }))}
        >
          {props.label ?? "다음"} (주제 {topics.length}개 · 난이도{" "}
          {levels.length}개)
        </button>
        {empty && (
          <p className={s.hint}>주제와 난이도를 하나 이상 골라 주세요.</p>
        )}
      </div>
    </>
  );
}

// 받게 될 알림 모양(S08). 시각은 고른 값을 따라간다.
// 실제 알림(lib/push.ts)과 같은 문구다. 잠금 화면에 보이므로 닉네임은 넣지 않는다
function NotifyPreview({ hour }: { hour: number }) {
  return (
    <div className={s.previewWrap} aria-hidden>
      <div className={s.preview}>
        <span className={s.symbol} />
        <div className={s.previewText}>
          <p className={s.previewHead}>
            <strong>TailQ</strong>
            <span className="num">{hourLabel(hour)}</span>
          </p>
          <strong>오늘의 질문이 도착했어요</strong>
          <p>오늘도 한 문제 풀어볼까요?</p>
        </div>
      </div>
    </div>
  );
}

// 아이폰은 홈 화면에 추가해야 알림을 받을 수 있다(03 요구사항 B-8, iOS 16.4 이상)
const GUIDES = [
  {
    title: "아이폰 알림 설정 방법 보기",
    body: "Safari에서 공유 버튼 → '홈 화면에 추가'를 누르고, 홈 화면의 TailQ로 들어와 알림을 켜 주세요. iOS 16.4 이상에서 돼요.",
  },
  {
    title: "안드로이드 알림 설정 방법 보기",
    body: "'알림 켜기'를 누른 뒤 브라우저 창에서 '허용'을 눌러 주세요. 막아 두었다면 주소창 왼쪽 아이콘 → 권한 → 알림에서 허용으로 바꿔요.",
  },
];

function NotifyStep(props: {
  vapidKey: string;
  hour: number;
  setHour: (hour: number) => void;
  onDone: (body: Body) => Promise<boolean>;
}) {
  const [busy, run] = useBusy();
  // 어느 버튼이 처리 중인지(로딩 표시용)
  const [later, setLater] = useState(false);
  const [notice, setNotice] = useState("");

  // 권한을 받고 이 기기를 구독한 뒤 설정을 저장한다. 거부했거나 이 브라우저가 못 받으면
  // 알림을 끈 채로 온보딩을 끝내고 MY에서 다시 켜게 한다(05 사용자 흐름 "예외 상황").
  // 홈 화면에 추가하지 않은 아이폰과 저장 실패는 이 단계에 남아 안내한다.
  const allow = async () => {
    setNotice("");
    const result = await subscribePush(props.vapidKey);
    if (result === "install" || result === "failed") {
      setNotice(SUBSCRIBE_ERRORS[result]);
      return false;
    }
    return props.onDone({
      notifyOn: result === "ok",
      notifyHour: props.hour,
    });
  };

  return (
    <>
      {/* 화면엔 글자로 보이고, 누르면 기기의 선택 창이 열린다 */}
      <label className={s.hourRow}>
        <span className={s.hourLabel}>알림 시각</span>
        <span className="num">{hourLabel(props.hour)}</span>
        <Icon name="chevronRight" size={18} />
        <select
          aria-label="알림 시각"
          value={props.hour}
          onChange={(e) => props.setHour(Number(e.target.value))}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </label>

      <div className={s.guides}>
        {GUIDES.map((g) => (
          <details key={g.title}>
            <summary>
              <strong>{g.title}</strong>
              <Icon name="chevronRight" size={18} />
            </summary>
            <p>{g.body}</p>
          </details>
        ))}
      </div>

      {notice && (
        <p role="alert" className={s.alert}>
          {notice}
        </p>
      )}

      <div className={f.bottom}>
        <button
          type="button"
          className="btn btn-primary press"
          disabled={busy}
          aria-busy={busy && !later}
          onClick={() => {
            setLater(false);
            run(allow);
          }}
        >
          알림 켜기
        </button>
        <button
          type="button"
          className="btn btn-secondary press"
          disabled={busy}
          aria-busy={busy && later}
          onClick={() => {
            setLater(true);
            run(() => props.onDone({}));
          }}
        >
          나중에 할게요
        </button>
      </div>
    </>
  );
}
