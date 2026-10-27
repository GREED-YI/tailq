"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "../history.module.css";

type Tip = { text: string; x: number; y: number };

// 학습 잔디: 칸에 마우스를 올리면(터치는 누르면) 그 날짜를 칸 위 말풍선으로 보여준다.
// 칸이 365개라 칸마다 상태를 두지 않고 말풍선 하나를 옮긴다. 잔디는 가로 스크롤 안에 있어
// 위 칸 말풍선이 잘리지 않게 body에 붙인다
export function GrassTip({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  // 스크롤하면 칸이 움직이니 닫는다
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [tip]);

  return (
    <div
      className={className}
      role="img"
      aria-label={label}
      onPointerOver={(e) => {
        const cell = e.target as HTMLElement;
        const text = cell.dataset.tip;
        if (!text) return setTip(null);
        const r = cell.getBoundingClientRect();
        // 화면 가장자리 칸에서도 말풍선이 밖으로 나가지 않게
        const x = Math.min(
          Math.max(r.left + r.width / 2, 70),
          window.innerWidth - 70,
        );
        setTip({ text, x, y: r.top });
      }}
      onPointerLeave={() => setTip(null)}
    >
      {children}
      {tip &&
        createPortal(
          <span
            className={s.grassTip}
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
