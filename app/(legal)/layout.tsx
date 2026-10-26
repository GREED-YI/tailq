import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { FeedbackLink } from "@/components/FeedbackLink";
import f from "@/components/Flow.module.css";
import { Logo } from "@/components/Logo";
import { LegalTabs } from "./LegalTabs";
import s from "./legal.module.css";

// 이용약관·개인정보처리방침 공통 뼈대(S09). 로그인 없이 본다.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main className={`${f.main} ${s.main}`}>
      <Link href="/" className={f.pcLogo} aria-label="TailQ 처음으로">
        <Logo />
      </Link>
      <header className={f.top}>
        <BackButton className={f.back} />
        <p className={f.topTitle}>약관과 정책</p>
      </header>
      <LegalTabs />
      <article className={s.doc}>{children}</article>
      <FeedbackLink />
    </main>
  );
}
