import s from "./interview.module.css";
import { scoreVerdict } from "./verdict";
import { VerdictMark } from "./VerdictMark";

export type TurnRow = {
  idx: number;
  status: string;
  score: number | null;
  verdict: string | null;
  follow_up_prompt: string | null;
};

// 단계별 결과(본 질문은 점수, 꼬리질문은 판정). 모양 점은 판정과 같은 규칙(점수는 구간으로 읽는다)
export function TurnRows({
  turns,
  prompt,
}: {
  turns: TurnRow[];
  prompt: string;
}) {
  return (
    <section className={s.steplist} aria-labelledby="steps-title">
      <h2 id="steps-title">단계별 결과</h2>
      <ol>
        {turns.map((t) => (
          <li
            key={t.idx}
            className={s.stepRow}
            data-main={t.idx === 0 || undefined}
          >
            <span className={s.stepRowLabel}>
              {t.idx === 0 ? "본 질문" : `꼬리질문 ${t.idx}`}
            </span>
            {t.verdict ? (
              <VerdictMark verdict={t.verdict} className={s.stepRowResult} />
            ) : t.status === "graded" ? (
              <VerdictMark
                verdict={scoreVerdict(t.score ?? 0)}
                className={s.stepRowResult}
              >
                <span className="mono">{t.score}</span>
                <span className="sr-only">점</span>
              </VerdictMark>
            ) : (
              // 날짜를 넘겨 닫힌 꼬리질문
              <span className={s.stepRowSkip}>건너뜀</span>
            )}
            <p className={s.stepRowPrompt}>{t.follow_up_prompt ?? prompt}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
