"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FEEDBACK_URL } from "@/lib/links";
import { Icon } from "./icons";
import s from "./AppShell.module.css";

// X는 처음 저절로 뜨는 안내만 닫고, 이 기기에서는 다시 저절로 띄우지 않는다. hover·키보드 초점에는 늘 뜬다.
// 처음엔 X를 누르면 hover·초점에도 다시 안 뜨게 했는데, 한 번 닫으면 여우에 올려도 아무 말이 없어 되돌렸다.
// X를 누른 순간 마우스가 아직 여우 위에 있어도 닫히도록, 그 hover·초점이 끝날 때까지만 숨긴다(#114)
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
// PC(1024px~)에만 보이고, 운영 화면(data-admin)은 피드백을 읽는 곳이라 CSS로 숨긴다
export function FeedbackFox() {
  const fresh = useSyncExternalStore(noSubscribe, tipOpen, () => false);
  const [closed, setClosed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hush, setHush] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  // 처음 띄운 말풍선도 8초 뒤엔 접는다(거슬리지 않게)
  useEffect(() => {
    const t = setTimeout(() => setClosed(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setDismissed(true);
    setHush(true);
    // 닫기 버튼이 사라지니 초점은 여우 버튼으로
    link.current?.focus();
    try {
      localStorage.setItem(TIP_KEY, "off");
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 닫힌다
    }
  }

  return (
    <div
      className={`rise ${s.fox} ${fresh && !closed && !dismissed ? s.foxTipOn : ""} ${hush ? s.foxHush : ""}`}
      onMouseLeave={() => setHush(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHush(false);
      }}
    >
      <p className={`glass-strong ${s.foxTip}`}>
        <span>피드백 사항이 있으면 저에게 알려주세요.</span>
        {fresh && !dismissed && (
          <button type="button" aria-label="말풍선 닫기" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        )}
      </p>
      <Link
        ref={link}
        href={FEEDBACK_URL}
        className={`glass press ${s.foxBtn}`}
        aria-label="피드백 보내기"
      >
        <span className={s.foxImg} />
      </Link>
    </div>
  );
}
