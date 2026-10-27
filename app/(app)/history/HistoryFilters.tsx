import Link from "next/link";
import s from "./history.module.css";

// 기록의 필터 칩(전체·북마크, 04 기능 명세 "하단 탭 5개"). 주소(?filter)를 바꾼다.
// 처음엔 기본 select 드롭다운이었으나 다크 테마에서 펼친 목록이 하얗게 떠 글자가 안 보여 칩으로 바꿨다(#117).
// 그다음엔 한 덩어리 세그먼트였는데 켜고 끄는 스위치처럼 보여, 복습 화면과 같은 따로 떨어진 칩 + 개수로 바꿨다(#117, 사용자 요청).
// 달 고르기는 달 머리 옆 화살표(MonthJump)가 맡는다
const FILTERS = [
  { key: "all", label: "전체", href: "/history" },
  { key: "bookmark", label: "북마크", href: "/history?filter=bookmark" },
] as const;

export function HistoryFilters({
  bookmarkOnly,
  counts,
}: {
  bookmarkOnly: boolean;
  counts?: { all: number; bookmark: number };
}) {
  const current = bookmarkOnly ? "bookmark" : "all";
  return (
    <nav className={s.filters} aria-label="기록 거르기">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          className="chip glass press"
          aria-current={current === f.key ? "page" : undefined}
        >
          {f.label}
          {counts && <span className="mono">{counts[f.key]}</span>}
        </Link>
      ))}
    </nav>
  );
}
