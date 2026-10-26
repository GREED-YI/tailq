"use client";

import { useState } from "react";
import {
  daysUntil,
  dueLabel,
  matchesFilter,
  type ReviewFilter,
  type ReviewItem,
} from "@/lib/review";
import s from "./review.module.css";

type Item = ReviewItem & { id: number; prompt: string; tag: string };

const FILTERS: { key: ReviewFilter; label: string; empty: string }[] = [
  { key: "all", label: "전체", empty: "복습할 질문이 없어요" },
  { key: "today", label: "오늘", empty: "오늘 복습할 질문이 없어요" },
  { key: "week", label: "이번 주", empty: "이번 주 복습할 질문이 없어요" },
  { key: "mastered", label: "익힌 질문", empty: "아직 익힌 질문이 없어요" },
];

// 칩은 필터. 사용자에게는 칸 번호 대신 다음 복습일과 숙련도 점 5개로 보여준다(04 기능 명세 5번)
export function ReviewList({ items, today }: { items: Item[]; today: string }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const shown = items.filter((r) => matchesFilter(r, filter, today));

  return (
    <>
      <div className={s.chips} role="group" aria-label="복습 질문 거르기">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip glass press num"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}{" "}
            {items.filter((r) => matchesFilter(r, f.key, today)).length}
          </button>
        ))}
      </div>

      <ul className={`glass ${s.rows}`}>
        {shown.length === 0 && (
          <li className={s.empty}>
            {FILTERS.find((f) => f.key === filter)!.empty}
          </li>
        )}
        {shown.map((r) => {
          const level = r.box ?? 5;
          return (
            <li key={r.id} className={s.row}>
              <span className={`mono ${s.meta}`}>
                Q.{String(r.id).padStart(3, "0")} · {r.tag}
              </span>
              <p className={s.prompt}>{r.prompt}</p>
              <span className={`num ${s.due}`}>
                {r.box === null ? "익힘" : dueLabel(daysUntil(r.dueDay, today))}{" "}
                · 숙련도
                <span
                  className={s.dots}
                  role="img"
                  aria-label={`5칸 중 ${level}칸`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= level ? s.on : undefined} />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className={s.note}>
        숙련도: 잘 답할수록 다음 복습까지 간격이 길어져요.
        <br />점 5개를 다 채우면 익힌 질문이 돼요.
      </p>
    </>
  );
}
