import { AppNav } from "@/components/AppNav";
import { FeedbackLink } from "@/components/FeedbackLink";
import s from "@/components/AppShell.module.css";

// 로그인한 사용자의 탭 화면(홈·복습·기록·프로젝트·MY) 공통 뼈대
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppNav />
      <main className={s.main}>
        {children}
        <FeedbackLink />
      </main>
    </>
  );
}
