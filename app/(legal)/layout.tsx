import Link from "next/link";
import { FeedbackLink } from "@/components/FeedbackLink";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import s from "./legal.module.css";

// 이용약관·개인정보처리방침 공통 뼈대. 로그인 없이 본다.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main className={s.main}>
      <header className={s.header}>
        <Link href="/" aria-label="TailQ 처음으로">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <article className={`glass ${s.doc}`}>{children}</article>
      <FeedbackLink />
    </main>
  );
}
