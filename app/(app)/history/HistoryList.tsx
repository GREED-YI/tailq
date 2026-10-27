import Link from "next/link";
import { scoreColor } from "@/app/interview/verdict";
import { Icon } from "@/components/icons";
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

// 한 달 치 기록. 달 머리는 띠 아래에 붙어 지금 보는 달을 알려 주고, 옆 화살표로 다른 달로 간다.
// 행을 누르면 기록 상세로 간다(Figma C안 S19는 PC도 한 열). 다른 목록처럼 점수 옆 화살표로 누를 수 있는 행임을 보인다.
// 날짜·메타·점수는 한 행에서 같은 글꼴로 보이게 모두 본문 글꼴 + 고정폭 숫자(.num)다.
// 처음엔 날짜만 고정폭 글꼴(.mono)이라 옆 메타와 글꼴이 달라 보여 맞췄다(#117, 사용자 요청)
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
      <div className={s.monthHead}>
        <h2 className="num">{head}</h2>
        {months.length > 1 && <MonthJump month={month} months={months} />}
      </div>
      <ul className={`glass ${s.rows}`}>
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
              <Link
                href={`/history/${r.id}`}
                className={`hover-row ${s.row} ${s.listRow}`}
              >
                <span className={`num ${s.date}`}>
                  {r.day.slice(5).replace("-", ".")}
                </span>
                <span className={s.text}>
                  <span className={`num ${s.meta}`}>{meta}</span>
                  <span className={s.prompt}>{r.prompt}</span>
                </span>
                {/* 모르겠어요는 0점으로 기록되지만 점수 대신 –로 보여준다(S19) */}
                <span
                  className={`num ${s.score}`}
                  style={
                    unknown ? undefined : { color: scoreColor(main.score ?? 0) }
                  }
                >
                  {unknown ? "–" : main.score}
                </span>
                <Icon name="chevronRight" size={18} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
