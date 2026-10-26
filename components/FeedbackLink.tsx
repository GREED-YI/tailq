import { FEEDBACK_URL } from "@/lib/links";
import s from "./AppShell.module.css";

// 모든 화면 하단의 피드백 링크(docs/04 12장)
export function FeedbackLink() {
  return (
    <footer className={s.footer}>
      <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
        피드백 보내기
      </a>
    </footer>
  );
}
