import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FEEDBACK_URL } from "@/lib/links";

// 랜딩 맨 아래 푸터(로고 · 약관 · 피드백 · ©). 앱 화면 내용 끝에도 같은 걸 붙인다(#114, 사용자 요청).
// 모양은 쓰는 쪽이 className으로 정한다(랜딩 landing.module.css .footer, 앱 AppShell.module.css .siteFooter — 레이아웃이 main 밖에 둬 폭 가득 그린다).
// "피드백 보내기"는 랜딩만 켠다(feedback). 앱 화면은 여우 버튼과 MY가 같은 일을 해서 뺐다(#114, 사용자 요청)
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
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        {feedback && <Link href={FEEDBACK_URL}>피드백 보내기</Link>}
      </nav>
      <small>© 2026 TailQ</small>
    </footer>
  );
}
