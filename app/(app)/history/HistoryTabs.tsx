import Link from "next/link";
import s from "./history.module.css";

// 기록 탭 안의 "기록 / 리포트" 나눔 막대(04 기능 명세 "하단 탭 5개", Figma S19·S21)
export function HistoryTabs({ current }: { current: "list" | "report" }) {
  return (
    <nav className={`glass ${s.tabs}`} aria-label="기록 보기">
      <Link
        href="/history"
        className="press"
        aria-current={current === "list" ? "page" : undefined}
      >
        기록
      </Link>
      <Link
        href="/history/report"
        className="press"
        aria-current={current === "report" ? "page" : undefined}
      >
        리포트
      </Link>
    </nav>
  );
}
