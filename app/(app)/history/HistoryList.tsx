import Link from "next/link";
import { scoreColor } from "@/app/interview/verdict";
import s from "./history.module.css";

type Item = {
  id: string;
  day: string;
  qid: number;
  prompt: string;
  bookmarked: boolean;
  turns: {
    idx: number;
    status: string;
    score: number | null;
    verdict: string | null;
  }[];
};

// 행을 누르면 기록 상세로 간다(Figma C안 S19는 PC도 한 열)
export function HistoryList({
  items,
  empty,
}: {
  items: Item[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className={`glass ${s.empty}`}>{empty}</p>;
  }

  return (
    <ul className={`glass ${s.rows}`} aria-label="지난 세션">
      {items.map((r) => {
        const main = r.turns[0];
        const unknown = main.verdict === "unknown";
        const followUps = r.turns.filter(
          (t) => t.idx > 0 && t.status === "graded",
        ).length;
        const meta = [
          unknown && "모르겠어요",
          `Q.${String(r.qid).padStart(3, "0")}`,
          followUps > 0 && `꼬리질문 ${followUps}개`,
          r.bookmarked && "북마크",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={r.id}>
            <Link href={`/history/${r.id}`} className={s.row}>
              <span className={`mono ${s.date}`}>
                {r.day.slice(5).replace("-", ".")}
              </span>
              <span className={s.text}>
                <span className={`num ${s.meta}`}>{meta}</span>
                <span className={s.prompt}>{r.prompt}</span>
              </span>
              {/* 모르겠어요는 0점으로 기록되지만 점수 대신 –로 보여준다(S19) */}
              <span
                className={`mono ${s.score}`}
                style={
                  unknown ? undefined : { color: scoreColor(main.score ?? 0) }
                }
              >
                {unknown ? "–" : main.score}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
