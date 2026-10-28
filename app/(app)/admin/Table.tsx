import type { ReactNode } from "react";
import { categoryLabel } from "@/lib/feedback";
import s from "./admin.module.css";

// 열 이름이 있는 표. 좁은 화면에서는 상자 안에서만 가로로 스크롤한다(키보드로도 움직이게 tabIndex)
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

// 피드백 표(분류 · 내용 · 받은 날). 대시보드는 최근 3개를 두 줄까지만(clamp), 목록 화면은 전체 글
export function FeedbackTable({
  rows,
  date,
  clamp = false,
}: {
  rows: { id: number; body: string; category: string; created_at: string }[];
  date: (iso: string) => string;
  clamp?: boolean;
}) {
  return (
    <Table label="피드백 목록">
      <thead>
        <tr>
          <th scope="col">분류</th>
          <th scope="col">내용</th>
          <th scope="col" className={s.numCol}>
            받은 날
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id}>
            <td>
              <span
                className={`tag tag-neutral ${s.kind}`}
                data-kind={v.category}
              >
                {categoryLabel(v.category)}
              </span>
            </td>
            <td className={s.body}>
              {clamp ? <span className={s.clamp}>{v.body}</span> : v.body}
            </td>
            <td className={`num ${s.numCol} ${s.when}`}>
              <time dateTime={v.created_at}>{date(v.created_at)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
