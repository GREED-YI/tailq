"use client";

import { useEffect } from "react";
import s from "./landing.module.css";

// 랜딩 동작. 화면에 아무것도 그리지 않는다.
// - 꼬리질문 섹션(#peak)을 페이지의 반대 테마로 둔다. 헤더 토글로 테마가 바뀌면 따라 바꾼다
//   (첫 그림 전에는 page.tsx의 인라인 스크립트가 같은 일을 한다. 앱 안에서 이동해 오면 그 스크립트는 돌지 않는다)
// - 첫 화면 버튼(#try)을 누르면 체험 칸으로 내려가며 고른 분야(radio)에 초점을 준다
// - 섹션 글·크롭(.reveal)이 35% 보이면 data-seen을 한 번 건다(CSS가 그때 재생, 다시 숨기지 않는다)
// - §6 녹화는 보일 때만 재생한다. 화면을 벗어나거나, 마우스를 올리거나, "녹화 멈추기"를 켜면 선다.
//   동작 줄이기면 재생하지 않는다(CSS가 녹화 대신 정지 화면을 보인다)
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.${s.root}`);
    if (!root) return;
    const html = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    const peak = document.getElementById("peak");
    const invert = () => {
      if (peak)
        peak.dataset.theme = html.dataset.theme === "light" ? "dark" : "light";
    };
    invert();
    const themeWatch = new MutationObserver(invert);
    themeWatch.observe(html, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const focusTry = () =>
      requestAnimationFrame(() =>
        root
          .querySelector<HTMLElement>(
            '#try [role="radio"][aria-checked="true"]',
          )
          ?.focus({ preventScroll: true }),
      );
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('a[href="#try"]')) focusTry();
    };
    root.addEventListener("click", onClick);
    // 이 스크립트가 붙기 전에 버튼을 눌렀거나 #try로 들어왔으면 붙는 즉시 초점을 준다
    if (location.hash === "#try") focusTry();

    // 들어올 때 한 번만 data-seen을 건다. data-io가 없으면(JS 전·실패) CSS는 완성 상태 그대로다.
    // 같은 섹션에서 앞선(글) 것도 함께 걸어서, 크롭이 먼저 보여도 글이 크롭보다 늦지 않다(순서는 CSS 지연이 정한다).
    // data-io는 IntersectionObserver를 만든 뒤에 건다(없는 브라우저에서 숨긴 채로 남지 않게)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const group = [
            ...(e.target.closest("section") ?? root).querySelectorAll(
              `.${s.reveal}`,
            ),
          ];
          for (const el of group.slice(0, group.indexOf(e.target) + 1)) {
            (el as HTMLElement).dataset.seen = "";
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.35 },
    );
    root.dataset.io = "";
    root.querySelectorAll(`.${s.reveal}`).forEach((el) => io.observe(el));

    // 녹화: 다크·라이트 두 편 중 보이는(display) 쪽만 교차하므로 테마가 바뀌면 저절로 바뀐 쪽이 재생된다
    const videos = [...root.querySelectorAll("video")];
    const stage = videos[0]?.closest<HTMLElement>(`.${s.recording}`);
    const pause = root.querySelector<HTMLInputElement>(`.${s.pause} input`);
    const inView = new Set<Element>();
    let hover = false;
    const sync = () => {
      for (const v of videos) {
        if (inView.has(v) && !hover && !pause?.checked && !reduce.matches) {
          v.muted = true;
          v.play().catch(() => {});
        } else v.pause();
      }
    };
    const vio = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) inView.add(e.target);
          else inView.delete(e.target);
        sync();
      },
      { threshold: 0.25 },
    );
    videos.forEach((v) => vio.observe(v));
    const enter = () => {
      hover = true;
      sync();
    };
    const leave = () => {
      hover = false;
      sync();
    };
    stage?.addEventListener("pointerenter", enter);
    stage?.addEventListener("pointerleave", leave);
    pause?.addEventListener("change", sync);
    reduce.addEventListener("change", sync);

    return () => {
      themeWatch.disconnect();
      io.disconnect();
      vio.disconnect();
      root.removeEventListener("click", onClick);
      stage?.removeEventListener("pointerenter", enter);
      stage?.removeEventListener("pointerleave", leave);
      pause?.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);
  return null;
}
