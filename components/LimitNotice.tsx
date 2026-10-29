import { useId } from "react";
import type { Quota } from "@/lib/server/usage";
import s from "./LimitNotice.module.css";

export type Notice = { title: string; lines: string[] };

// 시작 버튼 대신 보여줄 안내. 월 예산 → 연습 → 질문 생성 순으로 하나만 고른다.
// 연습과 질문 생성 한도는 프로젝트와 학습 자료(#141)가 함께 세서 어느 쪽이라고 쓰지 않는다.
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
      title: "오늘 연습 한도를 모두 썼어요",
      lines: ["내일 다시 할 수 있어요.", daily],
    };
  }
  if (what !== "practice" && q.gensLeft <= 0) {
    return {
      title: "오늘 질문 생성 한도를 모두 썼어요",
      lines: ["내일 다시 할 수 있어요.", daily],
    };
  }
  return null;
}

// 하루 사용 한도·월 예산에 닿았을 때 시작 버튼 대신 보여주는 안내(04 기능 명세 12장, Figma C안 S26).
// DESIGN inline-notice limit: 바깥은 role=note(랜드마크 없음)에 제목 strong을 aria-labelledby로 잇는다
export function LimitNotice({ title, lines }: Notice) {
  const id = useId();
  return (
    <div className={s.notice} role="note" aria-labelledby={id}>
      <strong id={id}>{title}</strong>
      <p>
        {lines.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

// 오늘 남은 횟수(quota-line). 항목마다 이름과 score-bar 같은 칸: 채운 칸은 남은 횟수, 빈 칸은 쓴 횟수.
// 화면 읽기에는 칸 대신 "면접 연습 3번 중 2번 남음" 한 문장으로 읽힌다. 0이어도 색을 바꾸지 않는다(이유는 LimitNotice가 말한다).
// items: [이름, 남은 수, 전체 수]. 월 예산이 다 찼으면 부르는 쪽이 그리지 않는다
export function UsageLine({ items }: { items: [string, number, number][] }) {
  return (
    <section className={s.usage}>
      <h2>오늘 남은 횟수</h2>
      {items.map(([label, left, total]) => (
        <p key={label}>
          <span aria-hidden="true">{label}</span>
          <span className={s.cells} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} data-on={i < left || undefined} />
            ))}
          </span>
          <span className="sr-only">
            {label} {total}번 중 {left}번 남음
          </span>
        </p>
      ))}
    </section>
  );
}
