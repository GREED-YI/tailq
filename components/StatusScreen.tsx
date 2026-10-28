import type { ReactNode } from "react";
import s from "./StatusScreen.module.css";

// 없는 주소(not-found)·화면 오류(error.tsx) 안내(DESIGN.md empty-state): 한 줄 제목, 설명, 버튼.
// inShell: 앱 뼈대((app)·(detail)) 안이면 뼈대가 main을 그리므로 div로 둔다
export function StatusScreen({
  title,
  body,
  inShell = false,
  alert = false,
  children,
}: {
  title: string;
  body: string;
  inShell?: boolean;
  alert?: boolean;
  children: ReactNode;
}) {
  const Tag = inShell ? "div" : "main";
  return (
    <Tag
      className={`${s.screen} ${inShell ? "" : s.full}`}
      role={alert ? "alert" : undefined}
    >
      <h1 className={s.title}>{title}</h1>
      <p className={s.body}>{body}</p>
      <div className={s.actions}>{children}</div>
    </Tag>
  );
}
