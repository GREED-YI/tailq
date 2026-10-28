import { Suspense } from "react";
import { AppNavForViewer } from "@/components/AdminMenu";
import { NavBar } from "@/components/AppNav";
import s from "@/components/AppShell.module.css";

// 탭 화면에서 들어가는 하위 화면(질문 상세·기록 상세·프로젝트 등록·프로젝트 질문) 뼈대.
// 모바일은 머리 막대·하단 탭 없이 화면이 그린 뒤로 버튼 머리를 쓰고, 태블릿·PC는 상단 메뉴를 그대로 둔다
export default function DetailLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={s.page}>
      <Suspense fallback={<NavBar pathname="" sub />}>
        <AppNavForViewer sub />
      </Suspense>
      <main className={`${s.main} ${s.mainSub}`}>{children}</main>
    </div>
  );
}
