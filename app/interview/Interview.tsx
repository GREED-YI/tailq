"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { FloatingQ } from "@/components/FloatingQ";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { SessionQuestion } from "@/lib/daily";
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
  failed: "",
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
  exitHref,
  resultHref,
  nickname,
  bookmarked,
  initialStatus,
  initialAnswer,
  initialResult,
  trial = false,
}: {
  initialTurn: Turn;
  question: SessionQuestion;
  // 나가기와 끝난 뒤 결과 화면. 프로젝트 질문 세션은 프로젝트 질문 목록으로 돌아간다
  exitHref: string;
  resultHref: string;
  nickname: string;
  bookmarked: boolean;
  initialStatus: InterviewStatus;
  initialAnswer: string;
  initialResult: TurnResult | null;
  // 로그인 없는 체험: 꼬리질문 1개까지, 북마크·평가 없음(04 기능 명세 10번)
  trial?: boolean;
}) {
  const router = useRouter();
  const followUps = trial ? 1 : 3;
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
  const hint =
    length < MIN ? "30자 이상 · " : length > MAX ? "2,000자 이하 · " : "";
  const exitRef = useRef<HTMLDialogElement>(null);
  const draftKey = `tailq-draft:${turn.id}`;

  // 나가기 전에 쓰던 답변을 되살린다(서버에 저장된 답변이 있으면 그쪽이 먼저)
  useEffect(() => {
    if (initialAnswer) return;
    let draft: string | null = null;
    try {
      draft = localStorage.getItem(draftKey);
    } catch {
      // 저장소를 못 읽으면 빈 칸에서 시작한다
    }
    if (!draft) return;
    const t = setTimeout(() => setAnswer(draft), 0);
    return () => clearTimeout(t);
  }, [draftKey, initialAnswer]);

  // 실패한 뒤 "다시 채점하기"는 실패한 요청과 같은 종류로 다시 보낸다(모르겠어요 포함)
  const [lastDontKnow, setLastDontKnow] = useState(false);

  function saveDraft() {
    try {
      if (phase !== "answer" && phase !== "failed") return;
      // 답변을 다 지우고 나가면 전에 남긴 초안도 지운다
      if (answer.trim()) localStorage.setItem(draftKey, answer);
      else localStorage.removeItem(draftKey);
    } catch {
      // 저장소를 못 쓰면 쓰던 답변은 남지 않는다
    }
  }

  async function submit(body: { text: string } | { dontKnow: true }) {
    const before = phase;
    setLastDontKnow("dontKnow" in body);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // 지우지 못해도 서버에 저장된 답변이 먼저다
    }
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
      ? `${question.label} · ${question.topic}`
      : `↳ 꼬리질문 ${turn.idx}`;
  const showResultSheet =
    phase === "result" || (phase === "grading" && streamed);

  return (
    <div className={`${s.screen} fade`}>
      <header className={s.header}>
        <button
          type="button"
          className="glass press icon-btn"
          aria-label="면접 나가기"
          onClick={() => exitRef.current?.showModal()}
        >
          <Icon name="close" />
        </button>
        <div className={s.steps}>
          <span className={`num ${s.stepLabel}`}>
            {turn.idx === 0 ? "본 질문" : `꼬리질문 ${turn.idx} / ${followUps}`}
          </span>
          <div
            className={s.dots}
            role="img"
            aria-label={`${followUps + 1}단계 중 ${turn.idx + 1}단계`}
          >
            {Array.from({ length: followUps + 1 }, (_, i) => (
              <span
                key={i}
                className={
                  i === turn.idx ? s.dotOn : i < turn.idx ? s.dotDone : s.dot
                }
              />
            ))}
          </div>
        </div>
        {/* 별표는 꼬리질문에서도 본 질문을 북마크한다(05 사용자 흐름). Figma 화면에는 자리가 없어 머리 오른쪽에 둔다 */}
        <div className={s.headerEnd}>
          {!trial && (
            <BookmarkButton
              questionId={question.id}
              initial={bookmarked}
              toastTop
            />
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className={s.orb}>
        <FloatingQ size={120} thinking={phase === "grading"} />
        {/* 채점 실패는 아래 여우 안내가 대신하므로 줄만 비워 둔다(Figma S17) */}
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

      <div key={turn.id} className={`fade ${s.question}`}>
        <span
          className={`${turn.idx === 0 && !question.projectId ? "mono" : ""} ${s.tag}`}
        >
          {tag}
        </span>
        <h1 className={s.prompt}>{turn.prompt}</h1>
      </div>

      {phase === "failed" && (
        <div className={s.fail} role="alert">
          <span className={s.fox} aria-hidden="true" />
          <strong>채점이 늦어지고 있어요</strong>
          <p>
            {error && error !== FAILED ? (
              error
            ) : (
              <>
                쓴 답변은 그대로 있어요.
                <br />
                잠시 후 다시 시도해 주세요.
              </>
            )}
          </p>
        </div>
      )}

      <section
        className={`glass-strong rise ${s.sheet}`}
        // 키보드가 올라온 답변 입력 시트만 화면 아래에 붙는다. 늘 붙여 두면 화면 높이가 낮을 때
        // 시트가 질문을 덮는다. 결과는 길어질 수 있어 질문 아래로 이어 붙인다
        style={
          showResultSheet || keyboard === 0
            ? undefined
            : {
                position: "sticky",
                bottom: `calc(12px + env(safe-area-inset-bottom) + ${keyboard}px)`,
              }
        }
        aria-label={showResultSheet ? "채점 결과" : "답변 입력"}
        data-result={showResultSheet || undefined}
        data-typing={keyboard > 0 || undefined}
      >
        {showResultSheet ? (
          <ResultView
            trial={trial}
            followUp={turn.idx > 0}
            resultHref={resultHref}
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
            {error && phase !== "failed" && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <div className={s.row}>
              {phase !== "failed" && (
                <button
                  type="button"
                  className={`glass press ${s.pill}`}
                  disabled={phase === "grading"}
                  onClick={() => submit({ dontKnow: true })}
                >
                  모르겠어요
                </button>
              )}
              {/* 한글이 섞이면 본문 글꼴, 숫자만이면 mono(globals.css 규칙) */}
              <span
                id="answer-count"
                className={`${hint ? "num" : "mono"} ${s.count}`}
                data-over={length > MAX || undefined}
              >
                {hint}
                {length.toLocaleString()} / 2,000
              </span>
              {phase === "failed" ? (
                <button
                  type="button"
                  className="btn btn-md btn-primary press"
                  disabled={!lastDontKnow && !valid}
                  onClick={() =>
                    submit(lastDontKnow ? { dontKnow: true } : { text: answer })
                  }
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

      {/* 세션 나가기(S31). 턴마다 저장하므로 다시 들어오면 이어간다. 쓰던 답변은 이 기기에 남긴다 */}
      <dialog
        ref={exitRef}
        className={`glass-strong ${s.dialog}`}
        aria-labelledby="exit-title"
      >
        <h2 id="exit-title">지금 나가도 현재 시점까지 저장돼요</h2>
        <p>다음에 이어서 할 수 있어요.</p>
        <div className={s.dialogActions}>
          <Link
            href={exitHref}
            className="glass btn btn-md btn-secondary press"
            onClick={saveDraft}
          >
            나가기
          </Link>
          <button
            type="button"
            className="btn btn-md btn-primary press"
            autoFocus
            onClick={() => exitRef.current?.close()}
          >
            계속 쓰기
          </button>
        </div>
      </dialog>
    </div>
  );
}

function ResultView({
  trial,
  followUp,
  resultHref,
  result,
  streamed,
  onNext,
}: {
  trial: boolean;
  followUp: boolean;
  resultHref: string;
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
}) {
  const shown = useCountUp(result?.score ?? 0, Boolean(result) && !followUp);
  if (followUp) {
    return (
      <FollowUpResult
        trial={trial}
        result={result}
        streamed={streamed}
        onNext={onNext}
        resultHref={resultHref}
      />
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
          score={result.score ?? 0}
        />
        <div className={s.headline}>
          <strong>{unknown ? "모르겠어요" : result.feedback?.summary}</strong>
          {result.feedback?.good.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
      </div>

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

      {/* Figma S14는 점수·한 줄·보완할 개념만 보인다. 모범 답안·보완할 점·참고 자료·평가(04 기능 명세)는
          기록 상세(S20)처럼 접어 둔다. 모르겠어요는 모범 답안이 전부라 펼친 채로 */}
      <details className={s.more} open={unknown}>
        <summary>모범 답안과 피드백 자세히 보기</summary>
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

        {!unknown && !trial && (
          <Rating turnId={result.turnId} initial={result.rating} />
        )}
      </details>

      <NextButton
        result={result}
        onNext={onNext}
        resultHref={resultHref}
        followUps={trial ? 1 : 3}
      />
    </div>
  );
}

// 꼬리질문 결과: 점수 대신 판정과 한 줄 피드백. "모르겠어요"면 기대 답안을 보여준다(docs/04 C-7)
function FollowUpResult({
  trial,
  result,
  streamed,
  onNext,
  resultHref,
}: {
  trial: boolean;
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
  resultHref: string;
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
      {!unknown && !trial && (
        <Rating turnId={result.turnId} initial={result.rating} />
      )}
      <NextButton
        result={result}
        onNext={onNext}
        resultHref={resultHref}
        followUps={trial ? 1 : 3}
      />
    </div>
  );
}

// 다음 꼬리질문이 있으면 이어서, 없으면(세션이 끝남) 결과 화면으로
function NextButton({
  result,
  onNext,
  resultHref,
  followUps,
}: {
  result: TurnResult;
  onNext: (next: Turn) => void;
  resultHref: string;
  followUps: number;
}) {
  const next = result.nextTurn;
  return next ? (
    <button
      type="button"
      className="btn btn-primary press"
      onClick={() => onNext(next)}
    >
      꼬리질문 받기 · {next.idx}/{followUps}
    </button>
  ) : (
    <Link href={resultHref} className="btn btn-primary press">
      {/* 프로젝트 질문 세션(?session=)과 체험은 오늘의 결과가 아니다 */}
      {resultHref === "/interview/result" ? "오늘의 결과 보기" : "결과 보기"}
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
