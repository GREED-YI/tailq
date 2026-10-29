"use client";

import { useRef } from "react";
import { InstallButton } from "@/components/InstallButton";
import { HOME_GUIDE_KEY } from "@/lib/home";
import s from "./home.module.css";

// 홈 첫 방문 안내(#146). 서버는 늘 그리고, 닫은 브라우저는 app/layout.tsx의 첫 그림 전 스크립트가
// html에 data-home-guide를 달아 CSS로 숨긴다(lib/home.ts homeGuideScript).
// "알겠어요"를 누르면 이 브라우저에 남기고 바로 숨긴다. 저장소를 못 쓰면 이 페이지를 떠나기 전까지만 숨긴다.
// 닫은 뒤에는 오늘의 질문 버튼으로, 버튼이 없는 예산 소진 날은 보이는 한도 안내 제목으로 포커스를 옮긴다
export function HomeGuide() {
  const ref = useRef<HTMLDivElement>(null);

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
      today?.querySelector<HTMLElement>("strong");
    if (next?.tagName === "STRONG") next.tabIndex = -1;
    next?.focus();
  }

  return (
    <div
      ref={ref}
      className={s.guide}
      role="note"
      aria-labelledby="home-guide-title"
    >
      <strong id="home-guide-title">TailQ는 이렇게 써요</strong>
      <ol role="list">
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
            <b>Q메이커</b>에 프로젝트 README나 학습 자료를 넣으면 내 자료로
            질문을 만들어요
          </p>
        </li>
      </ol>
      {/* 앱 설치(#150)는 "알겠어요" 옆 같은 줄이라 늦게 나타나도 카드 높이가 변하지 않는다 */}
      <div className={s.guideActions}>
        <button
          type="button"
          className="press btn btn-md btn-secondary"
          onClick={close}
        >
          알겠어요
        </button>
        <InstallButton variant="ghost" />
      </div>
    </div>
  );
}
