"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./GrassTip.module.css";

type Tip = { text: string; x: number; y: number; below: boolean };

// 꼬리잇기 달력(리포트)·이번 주(홈): 칸에 마우스를 올리면(터치는 누르면) 그 날짜를 칸 위 말풍선으로 보여준다.
// 칸이 365개라 칸마다 상태를 두지 않고 말풍선 하나를 옮긴다. 잔디는 가로 스크롤 안에 있어
// 위 칸 말풍선이 잘리지 않게 body에 붙인다.
// focusable: 칸이 몇 개 안 되면(홈 이번 주 7칸) 칸마다 초점을 받아 키보드로도 말풍선을 본다.
// 이때 바깥은 그림(img)이 아니라 묶음(group)이고 칸이 각자 이름(aria-label)을 갖는다
export function GrassTip({
  className,
  label,
  focusable = false,
  children,
}: {
  className: string;
  label: string;
  focusable?: boolean;
  children: ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 스크롤하면 칸이 움직이니 닫는다. 터치는 pointerleave로 닫지 않으니 잔디 밖을 누르면 닫는다
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("scroll", close, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [tip]);

  const show = (cell: HTMLElement) => {
    const text = cell.dataset.tip;
    if (!text) return setTip(null);
    const r = cell.getBoundingClientRect();
    // 화면 가장자리 칸에서도 말풍선이 밖으로 나가지 않게
    const x = Math.min(
      Math.max(r.left + r.width / 2, 70),
      window.innerWidth - 70,
    );
    // 칸 위 공간이 모자라면(화면 맨 위) 칸 아래에 띄운다
    const below = r.top < 48;
    setTip({ text, x, y: below ? r.bottom : r.top, below });
  };

  return (
    <div
      ref={ref}
      className={className}
      role={focusable ? "group" : "img"}
      aria-label={label}
      onPointerOver={(e) => show(e.target as HTMLElement)}
      onFocus={(e) => show(e.target as HTMLElement)}
      onBlur={() => setTip(null)}
      // 터치는 손을 떼자마자 pointerleave가 나서 마우스일 때만 닫는다
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setTip(null);
      }}
    >
      {children}
      {tip &&
        createPortal(
          <span
            className={`${s.grassTip} ${tip.below ? s.grassTipBelow : ""}`}
            style={{ left: tip.x, top: tip.y }}
            aria-hidden="true"
          >
            {tip.text}
          </span>,
          document.body,
        )}
    </div>
  );
}
