"use client";

import { useEffect } from "react";
import s from "./landing.module.css";

// 랜딩 스크롤 모션(docs/07 "모션"). 화면에 아무것도 그리지 않는다.
// - 차례 등장: data-reveal 요소가 화면에 들어오면 data-shown을 붙인다(IntersectionObserver)
// - 패럴랙스: 배경 빛은 스크롤의 0.12~0.32배(--sy), 여우는 화면 안 위치에 따라 ±60px(--fy)
// 768px 이하·동작 줄이기에서는 둘 다 끈다(CSS가 data-motion이 있을 때만 숨기고 움직인다)
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.${s.root}`);
    if (!root) return;
    const calm = matchMedia(
      "(max-width: 768px), (prefers-reduced-motion: reduce)",
    );
    const items = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const fox = root.querySelector<HTMLElement>(`.${s.fox}`);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    let frame = 0;
    const paint = () => {
      frame = 0;
      const y = calm.matches ? 0 : window.scrollY;
      root.style.setProperty("--sy", String(Math.round(y)));
      if (fox) {
        const r = fox.getBoundingClientRect();
        const p = (r.top + r.height / 2) / window.innerHeight - 0.5;
        const fy = calm.matches ? 0 : Math.max(-60, Math.min(60, p * 120));
        root.style.setProperty("--fy", `${Math.round(fy)}px`);
      }
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(paint);
    };

    const apply = () => {
      if (calm.matches) {
        root.removeAttribute("data-motion");
        io.disconnect();
      } else {
        root.setAttribute("data-motion", "");
        items.forEach((el) => !el.hasAttribute("data-shown") && io.observe(el));
      }
      onScroll();
    };
    apply();
    calm.addEventListener("change", apply);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      calm.removeEventListener("change", apply);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return null;
}
