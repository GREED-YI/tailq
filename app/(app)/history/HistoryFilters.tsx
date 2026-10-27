import Link from "next/link";
import s from "./history.module.css";

// 달 칩 이름: 가장 최근 달과 해가 다르면 해를 붙인다
const monthChip = (m: string, newest: string) =>
  `${m.slice(0, 4) === newest.slice(0, 4) ? "" : `${m.slice(0, 4)}년 `}${Number(m.slice(5))}월`;

// 기록의 필터 칩(전체·북마크)과 달 칩(04 기능 명세 "하단 탭 5개").
// 처음엔 기본 select 드롭다운이었으나 다크 테마에서 펼친 목록이 하얗게 떠 글자가 안 보여 칩으로 바꿨다(#117).
// 필터는 주소(?filter)를 바꾸고, 달 칩은 목록의 그 달 머리로 건너뛴다
export function HistoryFilters({
  bookmarkOnly,
  months,
}: {
  bookmarkOnly: boolean;
  months: string[];
}) {
  return (
    <div className={s.filters}>
      <nav className={s.chipGroup} aria-label="기록 거르기">
        <Link
          href="/history"
          className="chip glass press"
          aria-current={bookmarkOnly ? undefined : "page"}
        >
          전체
        </Link>
        <Link
          href="/history?filter=bookmark"
          className="chip glass press"
          aria-current={bookmarkOnly ? "page" : undefined}
        >
          북마크
        </Link>
      </nav>
      {months.length > 1 && (
        <nav className={s.chipGroup} aria-label="달로 건너뛰기">
          {months.map((m) => (
            <a key={m} href={`#m-${m}`} className="chip glass press num">
              {monthChip(m, months[0])}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
