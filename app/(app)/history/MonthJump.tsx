"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import s from "./history.module.css";

// 달 머리 옆 화살표: 누르면 기록이 있는 달 목록(해마다 묶음, 최신 순)이 열리고, 고르면 그 달 머리로 스크롤한다.
// 링크 목록이라 메뉴 대신 펼침(disclosure) 방식: 버튼 aria-expanded, Tab으로 고르고 Esc·바깥 누르기·초점이 나가면 닫힌다.
// 처음엔 띠 오른쪽 끝의 "바로 가기" 달 칩이었다(#117, 사용자 요청으로 옮김)
export function MonthJump({
  month,
  months,
}: {
  month: string;
  months: string[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("[aria-current]")?.focus();
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const go = (m: string) => {
    setOpen(false);
    const el = document.getElementById(`m-${m}`);
    if (!el) return;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    history.replaceState(null, "", `#m-${m}`);
    // 키보드로 골랐으면 그 달의 화살표에서 이어 가게
    el.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  };

  const years = [...new Set(months.map((m) => m.slice(0, 4)))];

  return (
    <div
      ref={box}
      className={s.jump}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={`press ${s.jumpButton}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label="다른 달로 가기"
        onClick={() => setOpen(!open)}
      >
        <Icon name="chevronDown" size={18} bold />
      </button>
      <div id={id} className={s.jumpList} hidden={!open}>
        {years.map((y) => (
          <div key={y} role="group" aria-label={`${y}년`}>
            <p className={`num ${s.jumpYear}`} aria-hidden="true">
              {y}년
            </p>
            <ul>
              {months
                .filter((m) => m.startsWith(y))
                .map((m) => (
                  <li key={m}>
                    <a
                      href={`#m-${m}`}
                      className="num press"
                      aria-current={m === month ? "true" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        go(m);
                      }}
                    >
                      {Number(m.slice(5))}월
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
