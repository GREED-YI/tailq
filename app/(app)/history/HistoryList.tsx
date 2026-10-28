import Link from "next/link";
import { Score } from "./marks";
import { MonthJump } from "./MonthJump";
import s from "./history.module.css";

type Item = {
  id: string;
  day: string;
  label: string;
  prompt: string;
  bookmarked: boolean;
  turns: {
    idx: number;
    status: string;
    score: number | null;
    verdict: string | null;
  }[];
};

// 한 달 치 기록. 달 머리(2px 머리선)는 띠 아래에 붙어 지금 보는 달을 알려 주고, 옆 화살표로 다른 달로 간다.
// 행(list-row history)은 날짜 · 메타와 질문 · 점수이고, 누르면 기록 상세로 간다
export function HistoryList({
  month,
  months,
  items,
}: {
  month: string;
  months: string[];
  items: Item[];
}) {
  const head = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
  return (
    <section id={`m-${month}`} className={s.month}>
      <div className={`${s.listHead} ${s.monthHead}`}>
        <div>
          <h2 className="num">{head}</h2>
          {months.length > 1 && <MonthJump month={month} months={months} />}
        </div>
      </div>
      <ul className={s.list}>
        {items.map((r) => {
          const main = r.turns[0];
          const unknown = main.verdict === "unknown";
          const followUps = r.turns.filter(
            (t) => t.idx > 0 && t.status === "graded",
          ).length;
          const meta = [
            unknown && "모르겠어요",
            r.label,
            followUps > 0 && `꼬리질문 ${followUps}개`,
            r.bookmarked && "북마크",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={r.id}>
              <Link href={`/history/${r.id}`} className={s.rowLink}>
                <span className={`mono ${s.rowDate}`}>
                  {r.day.slice(5).replace("-", ".")}
                </span>
                <span className={s.histText}>
                  <span className={`num ${s.meta}`}>{meta}</span>
                  <span className={s.prompt}>{r.prompt}</span>
                </span>
                {/* 모르겠어요는 0점으로 기록되지만 점수 대신 –로 보여준다(S19) */}
                <Score value={unknown ? null : (main.score ?? 0)} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
