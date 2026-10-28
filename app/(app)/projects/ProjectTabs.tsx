"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./projects.module.css";

const SECTIONS = [
  { href: "/projects", label: "프로젝트" },
  { href: "/projects/notes", label: "학습 자료" },
];

// Q메이커 안의 구획 선택(DESIGN.md app-nav section-tabs, 약관의 LegalTabs와 같은 밑줄 탭).
// 각 구획은 자기 주소가 있어 링크로 옮긴다. 데이터 없이 바로 그려 불러오는 동안에도 자리가 그대로다
export function ProjectTabs() {
  const pathname = usePathname();
  return (
    <nav className={s.tabs} aria-label="자료 선택">
      {SECTIONS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          replace
          aria-current={pathname === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
