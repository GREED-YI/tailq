import type { ReactNode } from "react";
import { numericDate } from "@/lib/admin";
import { categoryLabel, FEEDBACK_CATEGORIES } from "@/lib/feedback";
import type { createAdminClient } from "@/lib/supabase/admin";
import s from "./admin.module.css";

// 열 이름이 있는 표. 넘치면 상자 안에서만 가로로 스크롤한다(키보드로도 움직이게 tabIndex)
export function Table({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={s.tableBox} role="region" aria-label={label} tabIndex={0}>
      <table className={s.table}>{children}</table>
    </div>
  );
}

// 피드백 목록(list-row feedback): 위 줄 분류 라벨 · 받은 날, 아래 줄 글 전체. 대시보드는 두 줄까지만(clamp).
// 어느 폭에서도 가로로 밀리지 않는다
export function FeedbackList({
  rows,
  clamp = false,
}: {
  rows: { id: number; body: string; category: string; created_at: string }[];
  clamp?: boolean;
}) {
  return (
    <ul className={s.feedback} aria-label="피드백 목록">
      {rows.map((v) => (
        <li key={v.id}>
          <div className={s.feedbackTop}>
            <span className="tag tag-neutral">{categoryLabel(v.category)}</span>
            <time className="mono" dateTime={v.created_at}>
              {numericDate(v.created_at)}
            </time>
          </div>
          <p className={clamp ? `${s.body} ${s.clamp}` : s.body}>{v.body}</p>
        </li>
      ))}
    </ul>
  );
}

// 분류별 피드백 개수. 행을 내려받지 않고 DB에서 센다(분류마다 head 개수 조회). 대시보드와 목록 칩이 같이 쓴다
export async function countFeedback(db: ReturnType<typeof createAdminClient>) {
  const counts = await Promise.all(
    FEEDBACK_CATEGORIES.map((c) =>
      db
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("category", c.id)
        .throwOnError()
        .then((r) => r.count ?? 0),
    ),
  );
  return Object.fromEntries(
    FEEDBACK_CATEGORIES.map((c, i) => [c.id, counts[i]]),
  ) as Record<string, number>;
}
