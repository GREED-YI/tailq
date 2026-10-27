"use client";

import { useEffect, useRef, useState } from "react";
import { FloatingQ } from "@/components/FloatingQ";
import s from "./landing.module.css";

type Demo = "idle" | "grading" | "done" | "leaving";

const STATUS: Record<Demo, string> = {
  idle: "답변을 기다리고 있어요",
  grading: "채점하고 있어요",
  done: "꼬리질문이 이어져요",
  leaving: "꼬리질문이 이어져요",
};

// 히어로의 채점 데모(docs/07 "히어로 데모"). 실제 채점이 아니라 정해 둔 연출이다:
// 채점해 보기 → 1.5초 분석 → 점수 0→72 카운트업(1.4초) → 꼬리질문 카드가 떠오름 → 다시 보기.
// 결과 영역 높이는 52 ↔ 216으로 부드럽게 바뀌고, 버튼·채점 중·결과 세 층은 겹쳐서 크로스페이드한다
export function HeroDemo() {
  const [demo, setDemo] = useState<Demo>("idle");
  const [score, setScore] = useState(0);
  const [tail, setTail] = useState(false);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const doneButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(raf.current);
  };
  const later = (fn: () => void, ms: number) =>
    timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => clear, []);

  function run() {
    if (demo !== "idle") return;
    clear();
    setDemo("grading");
    setScore(0);
    setTail(false);
    later(() => {
      setDemo("done");
      // 동작 줄이기면 점수는 바로 최종 값(docs/07 "모션 줄이기")
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setScore(72);
        setTail(true);
        later(() => doneButton.current?.focus(), 0);
        return;
      }
      later(() => {
        let start = 0;
        const step = (ts: number) => {
          start ||= ts;
          const p = Math.min((ts - start) / 1400, 1);
          setScore(Math.round(72 * (1 - (1 - p) ** 3)));
          if (p < 1) raf.current = requestAnimationFrame(step);
          else later(() => setTail(true), 250);
        };
        raf.current = requestAnimationFrame(step);
      }, 350);
      later(() => doneButton.current?.focus(), 700);
    }, 1500);
  }

  function reset() {
    if (demo !== "done") return;
    clear();
    // 결과를 먼저 흐리게 지운 뒤 높이를 줄이고 버튼을 다시 보인다
    setDemo("leaving");
    later(() => {
      setDemo("idle");
      setScore(0);
      setTail(false);
      later(() => startButton.current?.focus(), 0);
    }, 420);
  }

  const open = demo === "done" || demo === "leaving";
  return (
    <div className={`glass ${s.demo}`}>
      <div className={s.demoOrb}>
        <FloatingQ size={120} thinking={demo === "grading"} />
        <p className={s.demoStatus} aria-live="polite">
          {STATUS[demo]}
          {demo === "grading" && (
            <span className={s.dots} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </p>
      </div>
      <span className={`mono ${s.tag}`}>Q.042 · backend / jpa</span>
      <p className={s.demoQ}>JPA에서 N+1 문제가 무엇이고, 어떻게 해결하나요?</p>
      <div className={s.demoAnswer}>
        <span>내 답변</span>
        목록 조회 1번 뒤에 지연 로딩된 연관 엔티티마다 쿼리가 N번 더 나가는
        문제예요. fetch join으로 해결할 수 있어요.
      </div>

      <div className={s.demoRegion} data-open={open || undefined}>
        <div className={s.layer} data-show={demo === "idle" || undefined}>
          <button
            ref={startButton}
            type="button"
            className={`btn btn-primary press ${s.demoBtn}`}
            onClick={run}
            tabIndex={demo === "idle" ? 0 : -1}
            aria-hidden={demo !== "idle"}
          >
            이 답변으로 채점해 보기
          </button>
        </div>
        <div
          className={s.layer}
          data-show={demo === "grading" || undefined}
          data-from="below"
          aria-hidden={demo !== "grading"}
        >
          <div className={s.demoGrading}>
            채점하고 있어요
            <span className={s.dots} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
        <div
          className={`${s.layer} ${s.doneLayer}`}
          data-show={demo === "done" || undefined}
          data-leaving={demo === "leaving" || undefined}
          data-from="below"
          aria-hidden={demo !== "done"}
        >
          <div className={s.demoScore}>
            <span
              className={`mono ${s.demoNum}`}
              role="img"
              aria-label={`100점 만점에 ${score}점`}
            >
              {score}
              <small>/100</small>
            </span>
            <div className={s.demoVerdict}>
              <strong>원인은 정확히 짚었어요</strong>
              <span>
                보완할 개념 · <span className="mono">batch size</span>
              </span>
            </div>
          </div>
          <div className={`glass ${s.demoTail}`} data-show={tail || undefined}>
            <span>↳ 꼬리질문 1 / 3</span>
            <strong>그럼 페이징이랑 같이 쓰면 어떤 문제가 생기나요?</strong>
          </div>
          <button
            ref={doneButton}
            type="button"
            className={`glass btn btn-secondary press ${s.demoAgain}`}
            onClick={reset}
            tabIndex={demo === "done" ? 0 : -1}
          >
            다시 보기
          </button>
        </div>
      </div>
    </div>
  );
}
