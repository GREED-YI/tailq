"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import s from "./history.module.css";

const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

// 기록의 필터와 월 선택 드롭다운(04 기능 명세 "하단 탭 5개"). 고르면 주소(?filter, ?month)를 바꾼다.
// 필터를 바꾸면 월은 그 필터의 가장 최근 달로 돌아간다
export function HistoryFilters({
  bookmarkOnly,
  month,
  months,
}: {
  bookmarkOnly: boolean;
  month: string | undefined;
  months: string[];
}) {
  const router = useRouter();
  const go = (bookmark: boolean, m?: string) => {
    const q = new URLSearchParams();
    if (bookmark) q.set("filter", "bookmark");
    if (m) q.set("month", m);
    router.push(q.size ? `/history?${q}` : "/history");
  };

  return (
    <div className={s.filters}>
      <label className={`glass ${s.select}`}>
        <span className="sr-only">기록 거르기</span>
        <select
          value={bookmarkOnly ? "bookmark" : "all"}
          onChange={(e) => go(e.target.value === "bookmark")}
        >
          <option value="all">전체</option>
          <option value="bookmark">북마크</option>
        </select>
        <Icon name="chevronDown" size={16} />
      </label>
      {month && (
        <label className={`glass ${s.select}`}>
          <span className="sr-only">달 고르기</span>
          <select
            className="num"
            value={month}
            onChange={(e) => go(bookmarkOnly, e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <Icon name="chevronDown" size={16} />
        </label>
      )}
    </div>
  );
}
