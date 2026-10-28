import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import s from "./my.module.css";

// MY 아래 한 줄 화면을 불러오는 동안: 머리(뒤로 · 제목)는 그대로, 아래는 화면마다 같은 크기의 빈 칸(레이아웃이 밀리지 않게)
export function MyLoading({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={f.loading} aria-busy="true">
      <header className={`${f.top} ${s.top}`}>
        <BackButton className={`${f.back} ${s.back}`} />
        <h1 className={f.topTitle}>{title}</h1>
      </header>
      {children}
    </div>
  );
}
