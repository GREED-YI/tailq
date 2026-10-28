"use client";

import { useEffect } from "react";
import s from "./landing.module.css";

// 랜딩 동작. 화면에 아무것도 그리지 않는다.
// - 꼬리질문 섹션(#peak)을 페이지의 반대 테마로 둔다. 헤더 토글로 테마가 바뀌면 따라 바꾼다
//   (첫 그림 전에는 page.tsx의 인라인 스크립트가 같은 일을 한다. 앱 안에서 이동해 오면 그 스크립트는 돌지 않는다)
// - 등장: data-reveal 요소가 화면 아래 12% 선을 넘으면 data-shown을 붙이고 다시 떼지 않는다.
//   rootMargin의 %는 위아래도 화면 "너비" 기준이라 창 높이로 px를 계산하고, 높이가 바뀌면 다시 만든다.
//   이미 화면 안에 있는 요소는 숨기지 않고 바로 보인 것으로 둔다. 동작 줄이기에서는 숨기지 않는다
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

    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const items = root.querySelectorAll<HTMLElement>("[data-reveal]");
    let io: IntersectionObserver | null = null;
    let height = window.innerHeight;
    const start = () => {
      io?.disconnect();
      height = window.innerHeight;
      if (reduce.matches) {
        root.removeAttribute("data-motion");
        return;
      }
      const line = Math.round(height * 0.12);
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.setAttribute("data-shown", "");
            io?.unobserve(e.target);
          }
        },
        { rootMargin: `0px 0px -${line}px 0px` },
      );
      for (const el of items) {
        if (el.hasAttribute("data-shown")) continue;
        if (el.getBoundingClientRect().top < height - line)
          el.setAttribute("data-shown", "");
        else io.observe(el);
      }
      root.setAttribute("data-motion", "");
    };
    const onResize = () => {
      if (window.innerHeight !== height) start();
    };
    start();
    reduce.addEventListener("change", start);
    window.addEventListener("resize", onResize);

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
      io?.disconnect();
      reduce.removeEventListener("change", start);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
