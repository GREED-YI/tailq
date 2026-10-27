import { FEEDBACK_URL } from "@/lib/links";
import s from "./AppShell.module.css";

// 로그인 전 화면(랜딩·로그인·약관) 하단의 피드백 링크. 탭 화면은 MY의 정보 목록에 있다(docs/04 12장)
export function FeedbackLink() {
  return (
    <footer className={s.footer}>
      <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
        피드백 보내기
      </a>
    </footer>
  );
}
