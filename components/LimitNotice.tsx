import type { Quota } from "@/lib/usage";
import s from "./LimitNotice.module.css";

export type Notice = { title: string; lines: string[] };

// 시작 버튼 대신 보여줄 안내. 월 예산 → 프로젝트 연습 → 프로젝트 등록 순으로 하나만 고른다.
// what: 그 화면에서 시작하려는 것(연습만 하는 질문 목록은 "practice", 등록 화면은 "register")
export function limitNotice(
  q: Quota,
  what: "practice" | "register" | "both",
): Notice | null {
  if (q.budget === "exceeded") {
    // 04 기능 명세 12장의 문구. 오늘의 질문까지 막히므로 "오늘의 질문은 풀 수 있어요"를 붙이지 않는다
    return {
      title: "오늘은 사용 한도를 모두 썼어요",
      lines: ["내일 다시 만나요."],
    };
  }
  const daily = "오늘의 질문은 한도 없이 풀 수 있어요.";
  if (what !== "register" && q.sessionsLeft <= 0) {
    return {
      title: "오늘 프로젝트 연습 한도를 모두 썼어요",
      lines: ["프로젝트 연습은 내일 다시 할 수 있어요.", daily],
    };
  }
  if (what !== "practice" && q.gensLeft <= 0) {
    return {
      title: "오늘 프로젝트 등록 한도를 모두 썼어요",
      lines: ["프로젝트 등록은 내일 다시 할 수 있어요.", daily],
    };
  }
  return null;
}

// 하루 사용 한도·월 예산에 닿았을 때 시작 버튼 대신 보여주는 안내(04 기능 명세 12장, Figma C안 S26)
export function LimitNotice({ title, lines }: Notice) {
  return (
    <section className={s.notice} role="status">
      <strong>{title}</strong>
      <p>
        {lines.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </section>
  );
}
