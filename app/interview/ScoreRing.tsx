import s from "./interview.module.css";
import { scoreColor } from "./verdict";

const RING = 2 * Math.PI * 40;

// 점수 링. 면접 화면은 카운트업 중인 값을, 기록 상세는 최종 점수를 넘긴다.
// 링 색은 점수 구간 색. 카운트업 중에 색이 바뀌지 않게 최종 점수(score)로 정한다
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
        {shown > 0 && (
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke={scoreColor(score ?? 0)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${((RING * shown) / 100).toFixed(1)} ${RING.toFixed(1)}`}
            transform="rotate(-90 48 48)"
          />
        )}
      </svg>
      <div className={s.ringText} aria-hidden="true">
        <span className="mono">{value ?? "··"}</span>
        <span className="mono">/100</span>
      </div>
    </div>
  );
}
