"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/review", label: "복습", icon: "review" },
  { href: "/history", label: "기록", icon: "history" },
  { href: "/projects", label: "프로젝트", icon: "projects" },
  { href: "/my", label: "MY", icon: "my" },
];

// 모바일·태블릿은 떠 있는 유리 탭바, PC(1024px~)는 왼쪽 유리 사이드 메뉴(docs/07 "PC·태블릿 앱")
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className={`glass ${s.nav}`} aria-label="주요 메뉴">
      <div className={s.navLogo}>
        <Logo />
      </div>
      <ul className={s.navList}>
        {TABS.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`press ${s.navItem}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={t.icon} bold={active} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={s.navTools}>
        <ThemeToggle />
      </div>
    </nav>
  );
}
