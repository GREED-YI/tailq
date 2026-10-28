import { Suspense } from "react";
import { AppNavForViewer } from "@/components/AdminMenu";
import { NavBar } from "@/components/AppNav";
import s from "@/components/AppShell.module.css";

// 로그인한 사용자의 탭 화면(홈·Q노트·리포트·Q메이커·MY) 공통 뼈대: 머리 막대 · 내용
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={s.page}>
      <Suspense fallback={<NavBar pathname="" />}>
        <AppNavForViewer />
      </Suspense>
      <main className={s.main}>{children}</main>
    </div>
  );
}
