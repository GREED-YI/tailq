"use client";

import Link from "next/link";
import { useState } from "react";
import { Dots } from "../history/marks";
import h from "../history/history.module.css";
import {
  daysUntil,
  dueLabel,
  matchesFilter,
  type ReviewFilter,
  type ReviewItem,
} from "@/lib/review";
import s from "./review.module.css";

type Item = ReviewItem & {
  id: number;
  prompt: string;
  tag: string;
  sessionId?: string;
};

const FILTERS: { key: ReviewFilter; label: string; empty: string }[] = [
  { key: "all", label: "전체", empty: "복습할 질문이 없어요" },
  { key: "today", label: "오늘", empty: "오늘 복습할 질문이 없어요" },
  { key: "week", label: "이번 주", empty: "이번 주 복습할 질문이 없어요" },
  {
    key: "mastered",
    label: "복습 완료",
    empty: "아직 복습 완료한 질문이 없어요",
  },
];

// 칩은 필터. 사용자에게는 칸 번호 대신 다음 복습일과 숙련도 5칸으로 보여준다(04 기능 명세 5번).
// 행(list-row review)은 복습 시기 라벨 · 질문(한 줄)과 번호·주제 · 숙련도. 모바일은 위 줄에 라벨과 숙련도, 아래 줄에 질문(review-stacked)
export function ReviewList({ items, today }: { items: Item[]; today: string }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const shown = items.filter((r) => matchesFilter(r, filter, today));

  return (
    <>
      <div className={s.chips} role="group" aria-label="복습 질문 필터">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip press"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="mono">
              {items.filter((r) => matchesFilter(r, f.key, today)).length}
            </span>
          </button>
        ))}
      </div>

      <ul className={`${h.list} ${s.rows}`}>
        {shown.length === 0 && (
          <li className={h.rowEmpty}>
            {FILTERS.find((f) => f.key === filter)!.empty}
          </li>
        )}
        {shown.map((r) => (
          <li key={r.id}>
            {/* 기록이 있으면 그 질문의 가장 최근 기록 상세로 */}
            {r.sessionId ? (
              <Link
                href={`/history/${r.sessionId}`}
                className={`${h.rowLink} ${s.row}`}
              >
                <Row r={r} today={today} />
              </Link>
            ) : (
              <div className={`${h.rowLink} ${s.row}`}>
                <Row r={r} today={today} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={s.note}>
        <strong>숙련도</strong>
        <p>
          잘 답할수록 다음 복습까지 간격이 길어져요.
          <br />
          숙련도 5칸을 다 채우면 &lsquo;복습 완료&rsquo;로 옮겨져요.
        </p>
      </div>
    </>
  );
}

// 오늘 다시(밀린 것 포함)만 accent 라벨, 나머지와 복습 완료는 테두리 라벨
function Row({ r, today }: { r: Item; today: string }) {
  const days = daysUntil(r.dueDay, today);
  const now = r.box !== null && days <= 0;
  return (
    <>
      <span
        className={`num tag ${now ? "tag-today" : "tag-neutral"} ${h.due} ${s.due}`}
      >
        {r.box === null ? "복습 완료" : dueLabel(days)}
      </span>
      <span className={s.body}>
        <span className={s.prompt}>{r.prompt}</span>
        <span className={`num ${s.meta}`}>{r.tag}</span>
      </span>
      <span className={s.level}>
        <Dots level={r.box ?? 5} />
      </span>
    </>
  );
}
