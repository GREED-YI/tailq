"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Icon } from "@/components/icons";
import type { SessionQuestion } from "@/lib/daily";
import type { TurnResult } from "@/lib/turn";
import s from "./interview.module.css";
import { ScoreRing } from "./ScoreRing";
import type { Step } from "./steps";
import { scoreVerdict, VERDICTS } from "./verdict";
import { VerdictMark } from "./VerdictMark";
import { openModal, useCloseOnLeave } from "@/lib/dialog";

export type InterviewStatus = "answering" | "grading" | "graded" | "failed";
type Phase = "answer" | "grading" | "result" | "failed";
type Turn = { id: string; idx: number; prompt: string };

const MIN = 30;
const MAX = 2000;
// 화면이 "다시 채점하기"를 보여주는 시간(08 설계 "시간 기준은 셋이다")
const CLIENT_TIMEOUT_MS = 15_000;
const FAILED = "채점하지 못했어요. 다시 채점해 주세요.";

// 읽기 프로그램에 알리는 지금 상태. 처음엔 3D Q 아래 글자로 보였는데, 마스코트를 걷어 내고
// 채점 중은 제출 버튼의 진행 표시와 점수 자리 표시가 보여 준다(2026-10-28)
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

const stepName = (idx: number) => (idx === 0 ? "본 질문" : `꼬리질문 ${idx}`);

export function Interview({
  initialTurn,
  initialSteps,
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
  initialSteps: Step[];
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
  const [steps, setSteps] = useState(initialSteps);
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
  useCloseOnLeave(exitRef);
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

  // 다음 꼬리질문으로: 끝낸 단계를 흐름에 더하고, 질문이 바뀌며 페이드되고 답변 입력으로 돌아간다
  function goNext(next: Turn) {
    if (result) {
      setSteps((v) => [
        ...v,
        {
          idx: turn.idx,
          prompt: turn.prompt,
          score: result.score,
          verdict: result.verdict,
        },
      ]);
    }
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
      : stepName(turn.idx);
  const showResult =
    phase === "result" || (phase === "grading" && Boolean(streamed));
  const grading = phase === "grading";

  return (
    <div className={`${s.screen} fade`}>
      <header className={s.header}>
        <div className={s.headerIn}>
          <button
            type="button"
            className="press icon-btn"
            aria-label="면접 나가기"
            onClick={() => openModal(exitRef.current)}
          >
            <Icon name="close" />
          </button>
          <div className={s.steps}>
            <span className={s.stepLabel}>
              {turn.idx === 0 ? (
                "본 질문"
              ) : (
                <>
                  꼬리질문{" "}
                  <span className="mono">
                    {turn.idx} / {followUps}
                  </span>
                </>
              )}
            </span>
            <div
              className={s.stepBars}
              role="img"
              aria-label={`${followUps + 1}단계 중 ${turn.idx + 1}단계`}
            >
              {Array.from({ length: followUps + 1 }, (_, i) => (
                <span
                  key={i}
                  data-state={
                    i === turn.idx ? "current" : i < turn.idx ? "done" : "next"
                  }
                />
              ))}
            </div>
          </div>
          {/* 별표는 꼬리질문에서도 본 질문을 북마크한다(05 사용자 흐름) */}
          <div className={s.headerEnd}>
            {!trial && (
              <BookmarkButton
                questionId={question.id}
                initial={bookmarked}
                toastTop
              />
            )}
          </div>
        </div>
      </header>

      <main className={s.main}>
        {/* 지금까지의 흐름(DESIGN.md thread). 데스크톱 왼쪽 4칸에만 보인다. 좁은 폭은 머리의 단계 표시가 맡는다 */}
        <aside className={s.thread} aria-label="지금까지의 흐름">
          <span className={s.threadTitle}>지금까지</span>
          <ol>
            {steps.map((st) => {
              const v =
                st.idx === 0 && st.verdict !== "unknown"
                  ? scoreVerdict(st.score ?? 0)
                  : (st.verdict ?? "unknown");
              return (
                <li key={st.idx}>
                  <span
                    className={s.threadDot}
                    data-shape={VERDICTS[v]?.shape}
                    style={{ color: VERDICTS[v]?.color }}
                    aria-hidden="true"
                  />
                  <span className={s.threadHead}>
                    <span>{stepName(st.idx)}</span>
                    {st.idx === 0 && st.verdict !== "unknown" ? (
                      <b className="mono" style={{ color: VERDICTS[v]?.color }}>
                        {st.score}
                      </b>
                    ) : (
                      <b style={{ color: VERDICTS[v]?.color }}>
                        {VERDICTS[v]?.label}
                      </b>
                    )}
                  </span>
                  <p>{st.prompt}</p>
                </li>
              );
            })}
            <li aria-current="step">
              <span className={s.threadDot} data-current aria-hidden="true" />
              <span className={s.threadNow}>{stepName(turn.idx)} · 지금</span>
            </li>
          </ol>
        </aside>

        <section className={s.stage}>
          <p className="sr-only" aria-live="polite">
            {STATUS_TEXT[phase]}
          </p>
          <div
            key={turn.id}
            className={`fade ${s.question}`}
            data-compact={showResult || undefined}
          >
            <span
              className={`${turn.idx === 0 && !question.projectId ? "mono" : ""} ${s.tag}`}
            >
              {tag}
            </span>
            <h1 className={s.prompt}>{turn.prompt}</h1>
          </div>

          {phase === "failed" && (
            <div className={s.fail} role="alert">
              <strong>채점이 늦어지고 있어요</strong>
              <p>
                {error && error !== FAILED
                  ? error
                  : "쓴 답변은 그대로 있어요. 잠시 후 다시 시도해 주세요."}
              </p>
            </div>
          )}

          {showResult ? (
            <ResultView
              trial={trial}
              questionId={question.id}
              followUp={turn.idx > 0}
              resultHref={resultHref}
              result={phase === "result" ? result : null}
              streamed={streamed}
              onNext={goNext}
            />
          ) : (
            <section
              className={s.answer}
              aria-label="답변 입력"
              // 키보드가 올라온 답변 입력만 화면 아래에 붙는다. 늘 붙여 두면 화면 높이가 낮을 때 질문을 덮는다
              style={
                keyboard === 0
                  ? undefined
                  : {
                      position: "sticky",
                      bottom: `calc(12px + env(safe-area-inset-bottom) + ${keyboard}px)`,
                    }
              }
              data-typing={keyboard > 0 || undefined}
            >
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
                readOnly={grading}
                aria-describedby="answer-count"
                data-error={length > MAX || undefined}
              />
              {error && phase !== "failed" && (
                <p className={s.error} role="alert">
                  {error}
                </p>
              )}
              <div className={s.row}>
                {/* 한글이 섞이면 본문 글꼴, 숫자만이면 mono(globals.css 규칙) */}
                <span
                  id="answer-count"
                  className={`${hint ? "num" : "mono"} ${s.count}`}
                  data-over={length > MAX || undefined}
                >
                  {hint}
                  {length.toLocaleString()} / 2,000
                </span>
                {phase !== "failed" && (
                  <button
                    type="button"
                    className="btn btn-md btn-secondary press"
                    disabled={grading}
                    onClick={() => submit({ dontKnow: true })}
                  >
                    모르겠어요
                  </button>
                )}
                {phase === "failed" ? (
                  <button
                    type="button"
                    className={`btn btn-primary press ${s.submit}`}
                    disabled={!lastDontKnow && !valid}
                    onClick={() =>
                      submit(
                        lastDontKnow ? { dontKnow: true } : { text: answer },
                      )
                    }
                  >
                    다시 채점하기
                  </button>
                ) : (
                  // 채점 중에는 글자 대신 진행 표시를 보이고 폭은 그대로 둔다(DESIGN.md button loading)
                  <button
                    type="button"
                    className={`btn btn-primary press ${s.submit}`}
                    disabled={!valid || grading}
                    data-loading={grading || undefined}
                    aria-busy={grading}
                    onClick={() => submit({ text: answer })}
                  >
                    <span className={s.submitLabel}>
                      제출하기
                      <Icon name="arrowRight" size={18} bold />
                    </span>
                    {grading && (
                      <span className={s.loader} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </button>
                )}
              </div>
            </section>
          )}
        </section>
      </main>

      {/* 세션 나가기(S31). 턴마다 저장하므로 다시 들어오면 이어간다. 쓰던 답변은 이 기기에 남긴다 */}
      <dialog ref={exitRef} className={s.dialog} aria-labelledby="exit-title">
        <h2 id="exit-title">지금 나가도 현재 시점까지 저장돼요</h2>
        <p>다음에 이어서 할 수 있어요.</p>
        <div className={s.dialogActions}>
          <Link
            href={exitHref}
            className="btn btn-md btn-secondary press"
            onClick={() => {
              saveDraft();
              // 열린 채로 떠나면 돌아왔을 때 창이 반쯤 열린 상태로 남는다
              exitRef.current?.close();
            }}
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
  questionId,
  followUp,
  resultHref,
  result,
  streamed,
  onNext,
}: {
  trial: boolean;
  questionId: number;
  followUp: boolean;
  resultHref: string;
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
}) {
  if (followUp) {
    return (
      <FollowUpResult
        trial={trial}
        questionId={questionId}
        result={result}
        streamed={streamed}
        onNext={onNext}
        resultHref={resultHref}
      />
    );
  }
  if (!result) {
    // 채점 중: 끝난 화면과 같은 자리에 점수 자리 표시(··와 빈 막대)를 두고, 피드백 글이 생기는 대로 보인다
    return (
      <div className={s.result}>
        <section className={s.panel} aria-label="채점 결과">
          <ScoreRing
            shown={0}
            label="채점하고 있어요"
            aside={<span className={s.pending}>채점하고 있어요</span>}
          />
          <p className={s.streaming}>{streamed}</p>
        </section>
      </div>
    );
  }
  const unknown = result.verdict === "unknown";
  const score = result.score ?? 0;
  return (
    <div className={s.result}>
      <section className={s.panel} aria-label="채점 결과">
        {/* 0에서 점수까지 차오르는 것은 ScoreRing이 맡는다 */}
        <ScoreRing
          shown={score}
          label={`100점 만점에 ${score}점`}
          value={score}
          aside={
            <VerdictMark verdict={unknown ? "unknown" : scoreVerdict(score)} />
          }
        />
        {!unknown && result.feedback?.summary && (
          <p className={s.summary}>{result.feedback.summary}</p>
        )}
      </section>

      {/* 잘한 점을 먼저, 보완할 점을 다음에(DESIGN.md Voice). 펼친 채로 둔다 */}
      {!unknown && !!result.feedback?.good.length && (
        <div className={s.block}>
          <span className={s.label}>잘한 점</span>
          <ul className={s.list}>
            {result.feedback.good.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {!unknown && !!result.feedback?.improve.length && (
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
        <div className={s.block}>
          <span className={s.label}>보완할 개념</span>
          <div className={s.chips}>
            {result.missingKeywords.map((k) => (
              <span
                key={k}
                className={`tag tag-concept ${/[가-힣]/.test(k) ? "" : "mono"}`}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 모범 답안·참고 자료만 접어 둔다. 모르겠어요는 모범 답안이 전부라 펼친 채로 */}
      <details className={s.more} open={unknown}>
        <summary>
          모범 답안과 참고 자료
          <Icon name="chevronDown" size={18} />
        </summary>
        <div className={s.moreBody}>
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
        </div>
      </details>

      {/* 평가는 주 버튼 바로 위. 모르겠어요·체험은 평가가 없고, 체험은 신고도 없다(피드백은 로그인해야 보낸다) */}
      {!unknown && !trial && (
        <Rating turnId={result.turnId} initial={result.rating} />
      )}
      <NextButton
        result={result}
        onNext={onNext}
        resultHref={resultHref}
        followUps={trial ? 1 : 3}
      />
      {!trial && <ReportLink questionId={questionId} />}
    </div>
  );
}

// 꼬리질문 결과: 점수 없이 판정과 한 줄 피드백, 기대 답안(docs/04 C-7).
// 잘 답했으면 기대 답안을 접어 두고, 부족·틀림·모르겠어요면 펼쳐 둔다
function FollowUpResult({
  trial,
  questionId,
  result,
  streamed,
  onNext,
  resultHref,
}: {
  trial: boolean;
  questionId: number;
  result: TurnResult | null;
  streamed: string;
  onNext: (next: Turn) => void;
  resultHref: string;
}) {
  if (!result) {
    return (
      <div className={s.result}>
        <section className={s.panel} aria-label="채점 결과">
          <span className={`${s.verdictLine} ${s.pending}`}>
            채점하고 있어요
          </span>
          <p className={s.streaming}>{streamed}</p>
        </section>
      </div>
    );
  }
  const unknown = result.verdict === "unknown";
  return (
    <div className={s.result}>
      <section className={s.panel} aria-label="채점 결과">
        <VerdictMark verdict={result.verdict ?? ""} className={s.verdictLine} />
        {result.feedback?.summary && (
          <p className={s.summary}>{result.feedback.summary}</p>
        )}
      </section>
      {result.modelAnswer &&
        (result.verdict === "good" ? (
          <details className={s.more}>
            <summary>
              기대 답안 보기
              <Icon name="chevronDown" size={18} />
            </summary>
            <div className={s.moreBody}>
              <p className={s.well}>{result.modelAnswer}</p>
            </div>
          </details>
        ) : (
          <div className={s.block}>
            <span className={s.label}>기대 답안</span>
            <p className={s.well}>{result.modelAnswer}</p>
          </div>
        ))}
      {!unknown && !trial && (
        <Rating turnId={result.turnId} initial={result.rating} />
      )}
      <NextButton
        result={result}
        onNext={onNext}
        resultHref={resultHref}
        followUps={trial ? 1 : 3}
      />
      {!trial && <ReportLink questionId={questionId} />}
    </div>
  );
}

// 질문·채점 신고(#134). 피드백 화면이 분류 "신고"와 질문 번호를 미리 채운다. 꼬리질문도 본 질문 번호로 보낸다
function ReportLink({ questionId }: { questionId: number }) {
  return (
    <Link
      className={s.report}
      href={`/my/feedback?category=report&q=${questionId}`}
    >
      질문·채점이 이상해요
    </Link>
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
      className={`btn btn-primary press ${s.next}`}
      onClick={() => onNext(next)}
    >
      꼬리질문 받기
      <span className="mono">
        {next.idx}/{followUps}
      </span>
      <Icon name="arrowRight" size={18} bold />
    </button>
  ) : (
    <Link href={resultHref} className={`btn btn-primary press ${s.next}`}>
      {/* 프로젝트 질문 세션(?session=)과 체험은 오늘의 결과가 아니다 */}
      {resultHref === "/interview/result" ? "오늘의 결과 보기" : "결과 보기"}
      <Icon name="arrowRight" size={18} bold />
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
      <span className={s.ratingText}>이 채점이 도움이 됐나요?</span>
      <button
        type="button"
        className="press icon-btn"
        aria-label="채점이 도움이 됐어요"
        aria-pressed={rating === 1}
        onClick={() => rate(1)}
      >
        <Icon name="thumbUp" size={18} bold={rating === 1} />
      </button>
      <button
        type="button"
        className="press icon-btn"
        aria-label="채점이 도움이 안 됐어요"
        aria-pressed={rating === -1}
        onClick={() => rate(-1)}
      >
        <Icon name="thumbDown" size={18} bold={rating === -1} />
      </button>
    </div>
  );
}

// 키보드가 올라오면 답변 입력도 그 위로(docs/07 "iOS 대응", visualViewport 기준).
// 주소창이 다시 보이거나 확대해도 visualViewport가 줄어드니, 입력 칸에 초점이 있고
// 확대하지 않았고 줄어든 높이가 키보드만큼(120px 이상)일 때만 키보드로 본다
const KEYBOARD_MIN = 120;
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
      const shrunk = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      setInset(
        typing && vv.scale <= 1.01 && shrunk >= KEYBOARD_MIN ? shrunk : 0,
      );
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    // 초점이 빠지면(키보드 닫힘) 바로 원래대로. focusout 중에는 activeElement가 아직 바뀌기 전일 수 있다
    const later = () => setTimeout(update, 0);
    document.addEventListener("focusout", later);
    document.addEventListener("focusin", later);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusout", later);
      document.removeEventListener("focusin", later);
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
