import s from "./AppShell.module.css";

// 탭 화면 제목 줄(모바일·태블릿). 로고·메뉴·테마 토글은 머리 막대(AppNav.tsx)로 옮겼다.
// PC(1024px~)는 이 줄을 숨기고 화면 안의 큰 h1이 제목을 맡는다. 제목이 없는 화면(홈 등)은 그리지 않는다
export function AppHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <header className={s.header}>
      <h1 className={s.headerTitle}>{title}</h1>
    </header>
  );
}
