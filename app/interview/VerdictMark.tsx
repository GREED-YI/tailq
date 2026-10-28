import type { ReactNode } from "react";
import s from "./interview.module.css";
import { VERDICTS } from "./verdict";

// 판정 표시(DESIGN.md verdict-mark): 모양 점 + 판정 글자. 점은 그림일 뿐이고 뜻은 글자가 전한다.
// children을 주면 판정 글자 대신 그것을 쓴다(단계별 결과의 본 질문 점수처럼)
export function VerdictMark({
  verdict,
  children,
  className = "",
}: {
  verdict: string;
  children?: ReactNode;
  className?: string;
}) {
  const v = VERDICTS[verdict] ?? VERDICTS.unknown;
  return (
    <span
      className={`${s.verdictMark} ${className}`}
      data-shape={v.shape}
      style={{ color: v.color }}
    >
      {children ?? v.label}
    </span>
  );
}
