"use client";

import { useEffect, useRef, useState } from "react";
import s from "./interview.module.css";
import { scoreColor } from "./verdict";

const RING = 2 * Math.PI * 40;

// 점수 링. 링과 숫자는 0에서 shown까지 18ms마다 2씩 차오른다(docs/07 "모션", 동작 줄이기면 바로 최종 값).
// 처음엔 면접 화면만 카운트업한 값을 넘겨 움직였고, 기록 상세·공유·체험 결과는 최종 점수를 넘겨
// 링이 처음부터 꽉 찬 채로 보였다. 링이 스스로 차오르게 바꿔 모든 화면에서 움직인다(#114).
// 면접 화면처럼 카운트업 중인 값을 넘겨도 그 값을 따라가기만 한다.
// value가 없으면(채점 중) 숫자 자리에 ··. 링 색은 점수 구간 색이고, 차오르는 중에 색이 바뀌지 않게 최종 점수(score)로 정한다
export function ScoreRing({
  shown,
  label,
  value,
  score = value,
}: {
  shown: number;
  label: string;
  value?: number;
  score?: number;
}) {
  const n = useCountUp(shown);
  return (
    <div className={s.ring}>
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        role="img"
        aria-label={label}
      >
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="var(--track)"
          strokeWidth="8"
        />
        {/* 0점이면 둥근 끝만 점으로 남으므로 그리지 않는다 */}
        {n > 0 && (
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke={scoreColor(score ?? 0)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${((RING * n) / 100).toFixed(1)} ${RING.toFixed(1)}`}
            transform="rotate(-90 48 48)"
          />
        )}
      </svg>
      <div className={s.ringText} aria-hidden="true">
        <span className="mono">{value === undefined ? "··" : n}</span>
        <span className="mono">/100</span>
      </div>
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
