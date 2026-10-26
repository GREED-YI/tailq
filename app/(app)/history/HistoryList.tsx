"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { TurnRows, type TurnRow } from "@/app/interview/TurnRows";
import { scoreColor } from "@/app/interview/verdict";
import s from "./history.module.css";

type Item = {
  id: string;
  day: string;
  qid: number;
  prompt: string;
  tag: string;
  turns: TurnRow[];
};

const qLabel = (id: number) => `Q.${String(id).padStart(3, "0")}`;

// 모바일·태블릿은 행을 누르면 상세로 간다. PC는 2열이라 행을 누르면 오른쪽에 요약이 뜨고,
// "기록 상세 보기"로 상세에 간다(docs/07 "PC·태블릿 앱")
export function HistoryList({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const selected = items.find((r) => r.id === selectedId);

  function select(e: MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (!matchMedia("(min-width: 1024px)").matches) return;
    e.preventDefault();
    setSelectedId(id);
  }

  if (items.length === 0) {
    return (
      <p className={`glass ${s.empty}`}>
        오늘의 질문을 마치면 여기에 기록이 남아요
      </p>
    );
  }

  return (
    <div className={s.layout}>
      <ul className={`glass ${s.rows}`} aria-label="지난 세션">
        {items.map((r) => {
          const main = r.turns[0];
          const unknown = main.verdict === "unknown";
          const followUps = r.turns.filter(
            (t) => t.idx > 0 && t.status === "graded",
          ).length;
          const meta = [
            unknown && "모르겠어요",
            qLabel(r.qid),
            followUps > 0 && `꼬리질문 ${followUps}개`,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={r.id}>
              <Link
                href={`/history/${r.id}`}
                className={s.row}
                data-selected={r.id === selectedId || undefined}
                onClick={(e) => select(e, r.id)}
              >
                <span className={`mono ${s.date}`}>
                  {r.day.slice(5).replace("-", ".")}
                </span>
                <span className={s.text}>
                  <span className={`num ${s.meta}`}>{meta}</span>
                  <span className={s.prompt}>{r.prompt}</span>
                </span>
                {/* 모르겠어요는 0점으로 기록되지만 점수 대신 –로 보여준다(S19) */}
                <span
                  className={`mono ${s.score}`}
                  style={
                    unknown ? undefined : { color: scoreColor(main.score ?? 0) }
                  }
                >
                  {unknown ? "–" : main.score}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {selected && (
        <aside className={s.panel} aria-label="선택한 기록 요약">
          <span className={`mono ${s.tag}`}>
            {qLabel(selected.qid)} · {selected.tag} ·{" "}
            {selected.day.replaceAll("-", ".")}
          </span>
          <h2 className={s.panelTitle}>{selected.prompt}</h2>
          <TurnRows turns={selected.turns} prompt={selected.prompt} />
          <Link
            href={`/history/${selected.id}`}
            className="btn btn-primary press"
          >
            기록 상세 보기
          </Link>
        </aside>
      )}
    </div>
  );
}
