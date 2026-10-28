"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./legal.module.css";

const DOCS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
];

// 문서 선택(밑줄 탭). 각 문서는 자기 주소가 있어 링크로 옮긴다
export function LegalTabs() {
  const pathname = usePathname();
  return (
    <nav className={s.tabs} aria-label="문서 선택">
      {DOCS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          replace
          aria-current={pathname === d.href ? "page" : undefined}
        >
          {d.label}
        </Link>
      ))}
    </nav>
  );
}
