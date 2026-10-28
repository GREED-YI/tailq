import { Suspense } from "react";
import { AppNavForViewer } from "@/components/AdminMenu";
import { NavBar } from "@/components/AppNav";
import s from "@/components/AppShell.module.css";

// MY 아래 한 줄 화면(프로필·연습 범위·피드백·탈퇴) 뼈대. (detail) 하위 화면과 같다:
// 모바일은 머리 막대·하단 탭 없이 화면이 그린 뒤로 버튼 머리를 쓰고, 태블릿·PC는 상단 메뉴를 그대로 둔다
export default function MySubLayout({ children }: LayoutProps<"/my">) {
  return (
    <div className={s.page}>
      <Suspense fallback={<NavBar pathname="" sub />}>
        <AppNavForViewer sub />
      </Suspense>
      <main className={`${s.main} ${s.mainSub}`}>{children}</main>
    </div>
  );
}
