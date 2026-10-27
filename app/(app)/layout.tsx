import { Suspense } from "react";
import { AppNavForViewer } from "@/components/AdminMenu";
import { PcTools } from "@/components/AppHeader";
import { NavBar } from "@/components/AppNav";
import { FeedbackFox } from "@/components/FeedbackFox";
import { SiteFooter } from "@/components/SiteFooter";
import s from "@/components/AppShell.module.css";

// 로그인한 사용자의 탭 화면(홈·복습·기록·프로젝트·MY) 공통 뼈대
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<NavBar pathname="" />}>
        <AppNavForViewer />
      </Suspense>
      <main className={s.main}>
        <PcTools />
        {children}
        <SiteFooter className={s.siteFooter} logoHeight={18} />
      </main>
      <FeedbackFox />
    </>
  );
}
