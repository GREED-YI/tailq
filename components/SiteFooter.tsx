import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FEEDBACK_URL } from "@/lib/links";

// 공개 화면(랜딩) 맨 아래 푸터(로고 · 약관 · 피드백 · ©). 모양은 쓰는 쪽이 className으로 정한다(landing.module.css .footer).
// 앱 화면에는 붙이지 않는다. 약관·피드백은 MY에 있다(2026-10-28 디자인 리셋)
export function SiteFooter({
  className,
  logoHeight,
  feedback = false,
}: {
  className: string;
  logoHeight: number;
  feedback?: boolean;
}) {
  return (
    <footer className={className}>
      <Logo height={logoHeight} />
      <nav aria-label="약관과 피드백">
        <Link href="/terms" className="press">이용약관</Link>
        <Link href="/privacy" className="press">개인정보처리방침</Link>
        {feedback && <Link href={FEEDBACK_URL} className="press">피드백 보내기</Link>}
      </nav>
      <small>© 2026 TailQ</small>
    </footer>
  );
}
