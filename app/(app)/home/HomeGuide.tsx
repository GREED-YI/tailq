"use client";

import { useRef } from "react";
import { HOME_GUIDE_KEY } from "@/lib/home";
import s from "./home.module.css";

// 홈 첫 방문 안내(#146). 서버는 늘 그리고, 닫은 브라우저는 app/layout.tsx의 첫 그림 전 스크립트가
// html에 data-home-guide를 달아 CSS로 숨긴다(lib/home.ts homeGuideScript).
// "알겠어요"를 누르면 이 브라우저에 남기고 바로 숨긴다. 저장소를 못 쓰면 이 페이지를 떠나기 전까지만 숨긴다.
// 닫은 뒤에는 오늘의 질문 버튼(없으면 제목)으로 포커스를 옮긴다
export function HomeGuide() {
  const ref = useRef<HTMLElement>(null);

  function close() {
    try {
      localStorage.setItem(HOME_GUIDE_KEY, "1");
    } catch {
      // 저장소를 못 쓰면 다음 방문에 다시 보여준다
    }
    document.documentElement.dataset.homeGuide = "closed";
    const today = ref.current?.parentElement;
    const next =
      today?.querySelector<HTMLElement>("a.btn") ??
      today?.querySelector<HTMLElement>("h1");
    if (next?.tagName === "H1") next.tabIndex = -1;
    next?.focus();
  }

  return (
    <section ref={ref} className={s.guide} aria-labelledby="home-guide-title">
      <strong id="home-guide-title">TailQ는 이렇게 써요</strong>
      <ol>
        <li>
          <span className="mono" aria-hidden="true">
            01
          </span>
          <p>
            <b>오늘의 질문</b>에 답하면 AI가 채점하고 꼬리질문을 이어 가요
          </p>
        </li>
        <li>
          <span className="mono" aria-hidden="true">
            02
          </span>
          <p>
            푼 질문은 <b>Q노트</b>에 모이고, 점수에 맞춰 다시 나와요
          </p>
        </li>
        <li>
          <span className="mono" aria-hidden="true">
            03
          </span>
          <p>
            <b>Q메이커</b>에 README나 학습 자료를 넣으면 내 자료로 질문을
            만들어요
          </p>
        </li>
      </ol>
      <button
        type="button"
        className="press btn btn-md btn-secondary"
        onClick={close}
      >
        알겠어요
      </button>
    </section>
  );
}
