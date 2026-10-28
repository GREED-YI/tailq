"use client";

import { useEffect } from "react";
import s from "./landing.module.css";

// 랜딩 동작. 화면에 아무것도 그리지 않는다.
// - 꼬리질문 섹션(#peak)을 페이지의 반대 테마로 둔다. 헤더 토글로 테마가 바뀌면 따라 바꾼다
//   (첫 그림 전에는 page.tsx의 인라인 스크립트가 같은 일을 한다. 앱 안에서 이동해 오면 그 스크립트는 돌지 않는다)
// - 첫 화면 버튼(#try)을 누르면 체험 칸으로 내려가며 고른 분야(radio)에 초점을 준다
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.${s.root}`);
    if (!root) return;
    const html = document.documentElement;

    const peak = document.getElementById("peak");
    const invert = () => {
      if (peak)
        peak.dataset.theme = html.dataset.theme === "light" ? "dark" : "light";
    };
    invert();
    const themeWatch = new MutationObserver(invert);
    themeWatch.observe(html, { attributes: true, attributeFilter: ["data-theme"] });

    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('a[href="#try"]')) return;
      requestAnimationFrame(() =>
        root
          .querySelector<HTMLElement>('#try [role="radio"][aria-checked="true"]')
          ?.focus({ preventScroll: true }),
      );
    };
    root.addEventListener("click", onClick);

    return () => {
      themeWatch.disconnect();
      root.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
