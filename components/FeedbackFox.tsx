"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FEEDBACK_URL } from "@/lib/links";
import { Icon } from "./icons";
import s from "./AppShell.module.css";

// 말풍선을 닫으면 이 기기에서는 다시 먼저 띄우지 않는다(hover·초점에는 보인다)
const TIP_KEY = "tailq-fox-tip";
const noSubscribe = () => () => {};
function tipOpen() {
  try {
    return localStorage.getItem(TIP_KEY) !== "off";
  } catch {
    return false;
  }
}

// 오른쪽 아래에 떠 있는 여우 = 피드백 바로가기(#114). 탭·하위 화면 레이아웃에만 둔다.
// 운영 화면(data-admin)은 피드백을 읽는 곳이라 CSS로 숨긴다
export function FeedbackFox() {
  const fresh = useSyncExternalStore(noSubscribe, tipOpen, () => false);
  const [closed, setClosed] = useState(false);

  // 처음 띄운 말풍선도 8초 뒤엔 접는다(거슬리지 않게)
  useEffect(() => {
    const t = setTimeout(() => setClosed(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(TIP_KEY, "off");
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 닫힌다
    }
  }

  return (
    <div className={`rise ${s.fox} ${fresh && !closed ? s.foxTipOn : ""}`}>
      <p className={`glass-strong ${s.foxTip}`}>
        <span>피드백 사항이 있으면 저에게 알려주세요.</span>
        <button type="button" aria-label="말풍선 닫기" onClick={close}>
          <Icon name="close" size={16} />
        </button>
      </p>
      <Link
        href={FEEDBACK_URL}
        className={`glass press ${s.foxBtn}`}
        aria-label="피드백 보내기"
      >
        <span className={s.foxImg} />
      </Link>
    </div>
  );
}
