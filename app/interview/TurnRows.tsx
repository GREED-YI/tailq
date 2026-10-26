import s from "./interview.module.css";
import { scoreColor, VERDICTS } from "./verdict";

export type TurnRow = {
  idx: number;
  status: string;
  score: number | null;
  verdict: string | null;
  follow_up_prompt: string | null;
};

// 단계별 결과(본 질문은 점수, 꼬리질문은 판정 점). 오늘의 결과와 기록 요약이 같이 쓴다
export function TurnRows({
  turns,
  prompt,
}: {
  turns: TurnRow[];
  prompt: string;
}) {
  return (
    <ol className={`glass ${s.rows}`} aria-label="단계별 결과">
      {turns.map((t) => {
        // 본 질문은 점수, 꼬리질문은 판정. 날짜를 넘겨 닫힌 꼬리질문은 건너뜀
        const v = t.verdict ? VERDICTS[t.verdict] : null;
        const color = v
          ? v.color
          : t.status === "graded"
            ? scoreColor(t.score ?? 0)
            : "var(--dot-off)";
        return (
          <li key={t.idx} className={s.rowItem}>
            <span
              className={s.verdictDot}
              style={{ background: color }}
              aria-hidden="true"
            />
            <div className={s.rowText}>
              <span className="num">
                {t.idx === 0 ? "본 질문" : `꼬리질문 ${t.idx}`}
              </span>
              <p>{t.follow_up_prompt ?? prompt}</p>
            </div>
            {v ? (
              // 모르겠어요의 점 색(--dot-off)은 글자로 읽기 어려워 글자는 보조색으로 둔다
              <span
                className={s.rowVerdict}
                style={t.verdict === "unknown" ? undefined : { color }}
              >
                {v.label}
              </span>
            ) : t.status === "graded" ? (
              <span className={`mono ${s.rowScore}`} style={{ color }}>
                {t.score}
              </span>
            ) : (
              <span className={s.rowVerdict}>건너뜀</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
