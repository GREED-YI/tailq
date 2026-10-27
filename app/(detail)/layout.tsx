import { Suspense } from "react";
import { AppNavForViewer } from "@/components/AdminMenu";
import { PcTools } from "@/components/AppHeader";
import { NavBar } from "@/components/AppNav";
import { FeedbackFox } from "@/components/FeedbackFox";
import s from "@/components/AppShell.module.css";

// 탭 화면에서 들어가는 하위 화면(기록 상세·프로젝트 등록·프로젝트 질문) 뼈대.
// Figma C안은 모바일·태블릿에 탭바가 없고, PC는 사이드 메뉴를 그대로 둔다(S20·S23·S24).
export default function DetailLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<NavBar pathname="" sub />}>
        <AppNavForViewer sub />
      </Suspense>
      <main className={`${s.main} ${s.mainSub}`}>
        <PcTools />
        {children}
      </main>
      <FeedbackFox />
    </>
  );
}
