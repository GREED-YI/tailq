"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./interview.module.css";
import { scoreColor } from "./verdict";

// 본 질문 점수(DESIGN.md score hero): 큰 숫자 + /100 + 20칸 점수 막대.
// 처음엔 원형 링이라 이름이 ScoreRing이다. 기록 상세·공유·체험 결과가 같은 이름으로 불러 이름은 그대로 둔다.
// 숫자와 막대는 0에서 shown까지 18ms마다 2씩 차오른다(docs/07 "모션", 동작 줄이기면 바로 최종 값, #114).
// value가 없으면 숫자 자리에 empty(채점 중 ··, 모르겠어요 –), 막대는 빈 칸. 숫자 색은 점수 구간 색이고, 차오르는 중에 바뀌지 않게
// 최종 점수(score)로 정한다. aside는 숫자 줄 오른쪽(판정 표시 등)
export function ScoreRing({
  shown,
  label,
  value,
  score = value,
  empty = "··",
  aside,
}: {
  shown: number;
  label: string;
  value?: number;
  score?: number;
  empty?: string;
  aside?: ReactNode;
}) {
  const n = useCountUp(shown);
  return (
    <div className={s.score}>
      <div className={s.scoreRow}>
        <p className={s.scoreNum} role="img" aria-label={label}>
          <span
            className="mono"
            style={{
              color: value === undefined ? undefined : scoreColor(score ?? 0),
            }}
          >
            {value === undefined ? empty : n}
          </span>
          <span className="mono">/100</span>
        </p>
        {aside}
      </div>
      <ScoreBar value={n} />
    </div>
  );
}

// 점수 막대(DESIGN.md score-bar). 5점마다 한 칸, 채운 칸은 글자색, 빈 칸은 mark-empty 테두리
export function ScoreBar({
  value,
  small = false,
}: {
  value: number;
  small?: boolean;
}) {
  const on = Math.round(value / 5);
  return (
    <div
      className={s.bar}
      data-small={small || undefined}
      role="img"
      aria-label={`점수 막대 ${value}%`}
    >
      {Array.from({ length: 20 }, (_, i) => (
        <span key={i} data-on={i < on || undefined} />
      ))}
    </div>
  );
}

function useCountUp(target: number) {
  const [n, setN] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => {
      const v = cur.current;
      cur.current = reduce || v > target ? target : Math.min(target, v + 2);
      setN(cur.current);
      if (cur.current === target) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [target]);
  return n;
}
