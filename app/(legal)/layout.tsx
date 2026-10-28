import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import f from "@/components/Flow.module.css";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import ft from "@/app/_landing/footer.module.css";
import { LegalTabs } from "./LegalTabs";
import s from "./legal.module.css";

// 이용약관·개인정보처리방침 공통 뼈대(S09). 로그인 없이 본다.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${f.main} ${s.main}`}>
      <Link
        href="/"
        className={`${f.pcLogo} ${s.pcLogo}`}
        aria-label="TailQ 처음으로"
      >
        <Logo />
      </Link>
      <header className={f.top}>
        <BackButton className={f.back} />
        <p className={f.topTitle}>약관과 정책</p>
      </header>
      <main>
        <LegalTabs />
        <article className={s.doc}>{children}</article>
      </main>
      <SiteFooter className={ft.footer} logoHeight={22} />
    </div>
  );
}
