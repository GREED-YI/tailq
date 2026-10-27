import Link from "next/link";
import { FEEDBACK_URL } from "@/lib/links";
import s from "./AppShell.module.css";

// 로그인 전 화면(랜딩·로그인·약관) 하단의 피드백 링크. 탭 화면은 MY의 정보 목록에 있다(docs/04 12장).
// 피드백 화면은 로그인해야 열려서, 누르면 로그인 뒤 그 화면으로 온다
export function FeedbackLink() {
  return (
    <footer className={s.footer}>
      <Link href={FEEDBACK_URL}>피드백 보내기</Link>
    </footer>
  );
}
