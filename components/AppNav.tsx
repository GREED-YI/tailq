"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import s from "./AppShell.module.css";

// where: 어느 폭에서 보이는지. wide는 태블릿·PC 상단 메뉴에만, mobile은 모바일 하단 탭에만
const TABS: {
  href: string;
  label: string;
  icon: IconName;
  where?: "wide" | "mobile";
}[] = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/review", label: "복습", icon: "review" },
  { href: "/history", label: "기록", icon: "history" },
  // 모바일은 MY 메뉴와 홈 링크로 들어간다
  { href: "/report", label: "리포트", icon: "chart", where: "wide" },
  { href: "/projects", label: "프로젝트", icon: "projects" },
  // 태블릿·PC는 오른쪽 위 프로필 원이 MY로 간다
  { href: "/my", label: "MY", icon: "my", where: "mobile" },
];

// 운영자 메뉴(#104). 태블릿·PC 상단 메뉴에만 두고, 모바일은 헤더 오른쪽 아이콘으로 간다
const ADMIN_TAB = {
  href: "/admin",
  label: "운영",
  icon: "shield",
  where: "wide",
} as const;

export type Viewer = {
  admin?: boolean;
  // 꼬리잇기 일수. 못 읽으면 비운다
  streak?: number;
  nickname?: string;
  avatar?: string | null;
};

// 앱 머리 막대(DESIGN.md app-nav).
// 모바일(~767): 위 56px(로고 · 꼬리잇기) + 아래 탭 5개. 태블릿·PC: 위 64px 한 줄(로고 · 메뉴 · 꼬리잇기 · MY).
// 처음엔 모바일·태블릿은 떠 있는 유리 탭바, PC는 왼쪽 유리 사이드 메뉴였다(C안)
// sub: 하위 화면이라 모바일에서는 머리 막대와 탭을 숨긴다(화면이 뒤로 버튼 머리를 그린다)
export function AppNav({ sub, ...viewer }: { sub?: boolean } & Viewer) {
  return <NavBar pathname={usePathname()} sub={sub} {...viewer} />;
}

// 주소를 미리 알 수 없는 화면(기록 상세처럼 [id]가 있는 주소)은 미리 그릴 때 주소를 몰라
// 선택한 탭 없이 그리고, 요청 때 AppNav로 바꾼다(app/(app)/layout.tsx의 Suspense)
export function NavBar({
  pathname,
  sub,
  admin,
  streak,
  nickname = "",
  avatar = null,
}: { pathname: string; sub?: boolean } & Viewer) {
  const on = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header className={`${s.bar} ${sub ? s.barSub : ""}`}>
      <div className={s.barIn}>
        <Link
          href="/home"
          className={`press ${s.barLogo}`}
          aria-label="TailQ 홈"
        >
          <Logo height="var(--logo-h)" />
        </Link>
        {/* 운영 화면임을 알리는 표시(DESIGN.md). 강조색도 남색으로 바뀐다(lib/theme.ts ADMIN_TOKENS) */}
        {on("/admin") && <span className="tag tag-today">운영</span>}
        <nav className={s.nav} aria-label="주요 메뉴">
          <ul className={s.navList}>
            {(admin ? [...TABS, ADMIN_TAB] : TABS).map((t) => (
              <li
                key={t.href}
                className={
                  t.where === "wide"
                    ? s.wideOnly
                    : t.where === "mobile"
                      ? s.mobileOnly
                      : undefined
                }
              >
                <Link
                  href={t.href}
                  className={`press ${s.navItem}`}
                  aria-current={on(t.href) ? "page" : undefined}
                >
                  <Icon name={t.icon} size={22} bold={on(t.href)} />
                  <span>{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={s.tools}>
          {streak !== undefined && (
            <span className={s.streak}>
              꼬리잇기 <b className="mono">{streak}</b>일
            </span>
          )}
          {admin && (
            <Link
              href="/admin"
              className={`press icon-btn ${s.mobileOnly}`}
              aria-label="운영 대시보드"
              aria-current={on("/admin") ? "page" : undefined}
            >
              <Icon name="shield" />
            </Link>
          )}
          <Link
            href="/my"
            className={`press ${s.me} ${s.wideOnly}`}
            aria-label="MY페이지"
            aria-current={on("/my") ? "page" : undefined}
          >
            <Avatar avatar={avatar} nickname={nickname} size={32} />
          </Link>
        </div>
      </div>
    </header>
  );
}
