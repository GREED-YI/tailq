"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { FloatingQ } from "@/components/FloatingQ";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { TurnResult } from "@/lib/turn";
import s from "./interview.module.css";
import { ScoreRing } from "./ScoreRing";
import { VERDICTS } from "./verdict";

export type InterviewStatus = "answering" | "grading" | "graded" | "failed";
type Phase = "answer" | "grading" | "result" | "failed";
type Turn = { id: string; idx: number; prompt: string };

const MIN = 30;
const MAX = 2000;
// 화면이 "다시 채점하기"를 보여주는 시간(08 설계 "시간 기준은 셋이다")
const CLIENT_TIMEOUT_MS = 15_000;
const FAILED = "채점하지 못했어요. 다시 채점해 주세요.";

const STATUS_TEXT: Record<Phase, string> = {
  answer: "답변을 기다리고 있어요",
  grading: "채점하고 있어요",
  result: "채점이 끝났어요",
  failed: "채점하지 못했어요",
};

const PHASE_OF: Record<InterviewStatus, Phase> = {
  answering: "answer",
  grading: "grading",
  graded: "result",
  failed: "failed",
};

export function Interview({
  initialTurn,
  question,
  nickname,
  bookmarked,
  initialStatus,
  initialAnswer,
  initialResult,
}: {
  initialTurn: Turn;
  question: { id: number; prompt: string; topicId: string; field: string };
  nickname: string;
  bookmarked: boolean;
  initialStatus: InterviewStatus;
  initialAnswer: string;
  initialResult: TurnResult | null;
}) {
  const router = useRouter();
  const [turn, setTurn] = useState(initialTurn);
  const [phase, setPhase] = useState<Phase>(PHASE_OF[initialStatus]);
  const [answer, setAnswer] = useState(initialAnswer);
  const [streamed, setStreamed] = useState("");
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState("");
  const keyboard = useKeyboardInset();

  // 다른 탭이나 새로고침으로 채점 중인 턴을 열었으면 잠시 뒤 다시 읽는다
  useEffect(() => {
    if (initialStatus !== "grading") return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [initialStatus, router]);

  const length = answer.trim().length;
  const valid = length >= MIN && length <= MAX;

  async function submit(body: { text: string } | { dontKnow: true }) {
    const before = phase;
    setPhase("grading");
    setStreamed("");
    setError("");
    const fail = (message = FAILED) => {
      setPhase("failed");
      setError(message);
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/turns/${turn.id}/answer`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        let done = false;
        await readEvents(res, (event, data) => {
          if (event === "delta") {
            setStreamed((v) => v + (data as { text: string }).text);
          } else if (event === "result") {
            done = true;
            setResult(data as TurnResult);
            setPhase("result");
          } else if (event === "error") {
            done = true;
            fail((data as { message: string }).message);
          }
        });
        if (!done) fail();
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setResult(json as TurnResult);
        setPhase("result");
      } else if (res.status === 409) {
        // 이미 끝났거나 채점 중: 버튼은 그대로 두고 지금 상태를 다시 읽는다
        setPhase(before);
        router.refresh();
      } else {
        setPhase(before);
        setError(json?.error?.message ?? FAILED);
      }
    } catch {
      fail();
    } finally {
      clearTimeout(timer);
    }
  }

  // 다음 꼬리질문으로: 질문이 바뀌며 페이드되고(0.45초) 시트는 답변 입력으로 돌아간다
  function goNext(next: Turn) {
    setTurn(next);
    setPhase("answer");
    setAnswer("");
    setStreamed("");
    setResult(null);
    setError("");
    window.scrollTo(0, 0);
  }

  const tag =
    turn.idx === 0
      ? `Q.${String(question.id).padStart(3, "0")} · ${question.field} / ${question.topicId}`
      : `↳ 꼬리질문 ${turn.idx}`;
  const showResultSheet =
    phase === "result" || (phase === "grading" && streamed);

  return (
    <div className={`${s.screen} fade`}>
      <header className={s.header}>
        <Link
          href="/home"
          className="glass press icon-btn"
          aria-label="면접 나가기"
        >
          <Icon name="close" />
        </Link>
        <div className={s.steps}>
          <span className={`mono ${s.stepLabel}`}>
            {turn.idx === 0 ? "본 질문" : `꼬리질문 ${turn.idx} / 3`}
          </span>
          <div
            className={s.dots}
            role="img"
            aria-label={`4단계 중 ${turn.idx + 1}단계`}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  i === turn.idx ? s.dotOn : i < turn.idx ? s.dotDone : s.dot
                }
              />
            ))}
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className={s.orb}>
        <FloatingQ size={104} thinking={phase === "grading"} />
        <p className={s.status} aria-live="polite">
          {STATUS_TEXT[phase]}
          {phase === "grading" && (
            <span className={s.thinking} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </p>
      </div>

      {/* 별표는 꼬리질문에서도 본 질문을 북마크한다(05 사용자 흐름) */}
      <div className={s.questionRow}>
        <div key={turn.id} className={`fade ${s.question}`}>
          <span className={`mono ${s.tag}`}>{tag}</span>
          <h1 className={s.prompt}>{turn.prompt}</h1>
        </div>
        <BookmarkButton questionId={question.id} initial={bookmarked} />
      </div>

      <section
        className={`glass-strong rise ${s.sheet}`}
        // 답변 입력 시트만 화면 아래에 붙는다. 결과는 길어질 수 있어 질문 아래로 이어 붙인다
        style={
          showResultSheet
            ? undefined
            : {
                position: "sticky",
                bottom: `calc(12px + env(safe-area-inset-bottom) + ${keyboard}px)`,
              }
        }
        aria-label={showResultSheet ? "채점 결과" : "답변 입력"}
      >
        {showResultSheet ? (
          <ResultView
            followUp={turn.idx > 0}
            result={phase === "result" ? result : null}
            streamed={streamed}
            onNext={goNext}
          />
        ) : (
          <>
            <label htmlFor="answer" className={s.label}>
              내 답변
            </label>
            <textarea
              id="answer"
              className={s.input}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`${nickname ? `${nickname}님의` : "내"} 생각을 자유롭게 적어보세요`}
              spellCheck={false}
              autoComplete="off"
              readOnly={phase === "grading"}
              aria-describedby="answer-count"
            />
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <div className={s.row}>
              <button
                type="button"
                className={`glass press ${s.pill}`}
                disabled={phase === "grading"}
                onClick={() => submit({ dontKnow: true })}
              >
                모르겠어요
              </button>
              <span
                id="answer-count"
                className={`num ${s.count}`}
                data-over={length > MAX || undefined}
              >
                {length.toLocaleString()} / 2,000
                {length < MIN
                  ? " · 30자 이상"
                  : length > MAX
                    ? " · 2,000자 이하"
                    : ""}
              </span>
              {phase === "failed" ? (
                <button
                  type="button"
                  className="btn btn-md btn-primary press"
                  disabled={!valid}
                  onClick={() => submit({ text: answer })}
                >
                  다시 채점하기
                </button>
              ) : (
                <button
                  type="button"
                  className={`press ${s.submit}`}
                  disabled={!valid || phase === "grading"}
                  onClick={() => submit({ text: answer })}
                  aria-label="제출하고 채점받기"
                >
                  <Icon name="arrowUp" bold />
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ResultView({
  followUp,
  result,
  streamed,
  onNext,
}: {
  followUp: boolean;
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
}) {
  const shown = useCountUp(result?.score ?? 0, Boolean(result) && !followUp);
  if (followUp) {
    return (
      <FollowUpResult result={result} streamed={streamed} onNext={onNext} />
    );
  }
  if (!result) {
    // 채점 중: 점수는 아직 없고, 피드백 글이 생기는 대로 보인다
    return (
      <div className={s.result}>
        <div className={s.top}>
          <ScoreRing shown={0} label="채점하고 있어요" />
          <p className={s.streaming}>{streamed}</p>
        </div>
      </div>
    );
  }
  const unknown = result.verdict === "unknown";
  return (
    <div className={s.result}>
      <div className={s.top}>
        <ScoreRing
          shown={shown}
          label={`100점 만점에 ${result.score ?? 0}점`}
          value={shown}
        />
        <div className={s.headline}>
          <strong>{unknown ? "모르겠어요" : result.feedback?.summary}</strong>
          {result.feedback?.good.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
      </div>

      {!!result.feedback?.improve.length && (
        <div className={s.block}>
          <span className={s.label}>보완할 점</span>
          <ul className={s.list}>
            {result.feedback.improve.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {result.missingKeywords.length > 0 && (
        <div className={s.chips}>
          <span className={s.label}>보완할 개념</span>
          {result.missingKeywords.map((k) => (
            <span
              key={k}
              className={`glass ${s.chip} ${/[가-힣]/.test(k) ? "" : "mono"}`}
            >
              {k}
            </span>
          ))}
        </div>
      )}

      <div className={s.block}>
        <span className={s.label}>모범 답안</span>
        <p className={s.well}>{result.modelAnswer}</p>
      </div>

      {result.links.length > 0 && (
        <div className={s.block}>
          <span className={s.label}>참고 자료</span>
          <ul className={s.links}>
            {result.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!unknown && <Rating turnId={result.turnId} initial={result.rating} />}

      <NextButton result={result} onNext={onNext} />
    </div>
  );
}

// 꼬리질문 결과: 점수 대신 판정과 한 줄 피드백. "모르겠어요"면 기대 답안을 보여준다(docs/04 C-7)
function FollowUpResult({
  result,
  streamed,
  onNext,
}: {
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
}) {
  if (!result) {
    return (
      <div className={s.result}>
        <p className={s.streaming}>{streamed}</p>
      </div>
    );
  }
  const verdict = VERDICTS[result.verdict ?? ""] ?? VERDICTS.unknown;
  const unknown = result.verdict === "unknown";
  return (
    <div className={s.result}>
      <div className={s.verdict}>
        <span
          className={s.verdictDot}
          style={{ background: verdict.color }}
          aria-hidden="true"
        />
        <strong>{verdict.label}</strong>
      </div>
      {result.feedback?.summary && (
        <p className={s.feedbackLine}>{result.feedback.summary}</p>
      )}
      {unknown && (
        <div className={s.block}>
          <span className={s.label}>기대 답안</span>
          <p className={s.well}>{result.modelAnswer}</p>
        </div>
      )}
      {!unknown && <Rating turnId={result.turnId} initial={result.rating} />}
      <NextButton result={result} onNext={onNext} />
    </div>
  );
}

// 다음 꼬리질문이 있으면 이어서, 없으면(세션이 끝남) 오늘의 결과로
function NextButton({
  result,
  onNext,
}: {
  result: TurnResult;
  onNext: (next: Turn) => void;
}) {
  const next = result.nextTurn;
  return next ? (
    <button
      type="button"
      className="btn btn-primary press"
      onClick={() => onNext(next)}
    >
      꼬리질문 받기 · {next.idx}/3
    </button>
  ) : (
    <Link href="/interview/result" className="btn btn-primary press">
      오늘의 결과 보기
    </Link>
  );
}

function Rating({
  turnId,
  initial,
}: {
  turnId: string;
  initial: number | null;
}) {
  const [rating, setRating] = useState(initial);
  async function rate(value: 1 | -1) {
    const prev = rating;
    setRating(value);
    const res = await fetch(`/api/turns/${turnId}/rating`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: value }),
    }).catch(() => null);
    if (!res?.ok) setRating(prev);
  }
  return (
    <div className={s.rating}>
      <button
        type="button"
        className="glass press icon-btn"
        aria-label="채점이 도움이 됐어요"
        aria-pressed={rating === 1}
        onClick={() => rate(1)}
      >
        <Icon name="thumbUp" size={18} bold={rating === 1} />
      </button>
      <button
        type="button"
        className="glass press icon-btn"
        aria-label="채점이 도움이 안 됐어요"
        aria-pressed={rating === -1}
        onClick={() => rate(-1)}
      >
        <Icon name="thumbDown" size={18} bold={rating === -1} />
      </button>
    </div>
  );
}

// 0에서 점수까지 18ms마다 2씩(docs/07 "모션"). 동작 줄이기면 바로 최종 값
function useCountUp(target: number, run: boolean) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setShown(target), 0);
      return () => clearTimeout(t);
    }
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(target, v + 2);
      setShown(v);
      if (v >= target) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [target, run]);
  return shown;
}

// 키보드가 올라오면 시트도 그 위로(docs/07 "iOS 대응", visualViewport 기준)
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setInset(
        Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
      );
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

// SSE 응답을 이벤트 단위로 읽는다(event: 이름 / data: JSON / 빈 줄)
async function readEvents(
  res: Response,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}
