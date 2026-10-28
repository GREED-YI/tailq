import Link from "next/link";
import { Icon } from "@/components/icons";
import type { QuestionFilter } from "@/lib/review";
import s from "./questions.module.css";

// 내 질문 필터 칩 5개(C5). 주소(?filter)를 바꾼다. 옛 기록 화면 HistoryFilters를 옮겨 고쳤다(그 화면은 #132까지 원본을 쓴다).
// 북마크 칩에는 별표 버튼과 같은 별 아이콘을 글자 앞에 둔다
const FILTERS: { key: QuestionFilter; label: string }[] = [
  { key: "today", label: "오늘 복습" },
  { key: "week", label: "이번 주" },
  { key: "bookmark", label: "북마크" },
  { key: "mastered", label: "복습 완료" },
  { key: "all", label: "전체" },
];

export function QuestionFilters({
  current,
  counts,
}: {
  current: QuestionFilter;
  counts: Record<QuestionFilter, number>;
}) {
  return (
    <nav className={s.chips} aria-label="내 질문 필터">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={`/questions?filter=${f.key}`}
          className="chip press"
          aria-current={current === f.key ? "page" : undefined}
        >
          {f.key === "bookmark" && (
            <Icon name="star" size={16} bold={current === f.key} />
          )}
          {f.label}
          <span className="mono">{counts[f.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
