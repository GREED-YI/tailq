"use client";

import { THEME_STORAGE_KEY, type ThemeName } from "@/lib/theme";

// 지금 테마의 반대로 바꾸고 기억한다. 아이콘은 CSS(.only-dark/.only-light)로 골라서
// 서버에서 그린 화면과 첫 그림이 같다.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next: ThemeName = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 바뀐다
    }
  }

  return (
    <button type="button" className="glass press icon-btn" onClick={toggle}>
      <span className="only-dark">
        <SunIcon />
        <span className="sr-only">라이트 모드로 바꾸기</span>
      </span>
      <span className="only-light">
        <MoonIcon />
        <span className="sr-only">다크 모드로 바꾸기</span>
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
