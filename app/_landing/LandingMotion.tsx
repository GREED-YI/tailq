"use client";

import { useEffect } from "react";
import s from "./landing.module.css";

// 랜딩 스크롤 모션(docs/07 "모션"). 화면에 아무것도 그리지 않는다.
// - 차례 등장: data-reveal 요소가 화면에 들어올 때마다 data-shown을 붙이고(IntersectionObserver),
//   화면 밖으로 완전히 나가면 떼어 다시 숨긴다. 나간 쪽을 data-from(top|bottom)에 적어 두면
//   다시 들어올 때 그쪽에서 들어온다(위로 스크롤하면 위에서, 아래로 스크롤하면 아래에서)
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

    // 나타나기는 화면 위아래 10% 안쪽에 들어왔을 때, 숨기기는 화면 밖으로 완전히 나갔을 때.
    // 숨긴 요소는 화면 바깥쪽으로 밀려나므로 경계에서 나타났다 숨었다를 되풀이하지 않는다
    const show = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) e.target.setAttribute("data-shown", "");
      },
      { rootMargin: "-10% 0px" },
    );
    const hide = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) continue;
        e.target.removeAttribute("data-shown");
        const above = e.boundingClientRect.top < 0;
        e.target.setAttribute("data-from", above ? "top" : "bottom");
      }
    });

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
        show.disconnect();
        hide.disconnect();
      } else {
        root.setAttribute("data-motion", "");
        items.forEach((el) => {
          show.observe(el);
          hide.observe(el);
        });
      }
      onScroll();
    };
    apply();
    calm.addEventListener("change", apply);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      show.disconnect();
      hide.disconnect();
      cancelAnimationFrame(frame);
      calm.removeEventListener("change", apply);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return null;
}
