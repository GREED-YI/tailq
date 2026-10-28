import Link from "next/link";
import { Icon } from "@/components/icons";
import { LoadingStatus } from "@/components/LoadingStatus";
import type { QuestionRow } from "./ProjectView";
import s from "@/app/(app)/projects/projects.module.css";

// 프로젝트 질문 목록과 학습 자료 질문 목록(#141)이 같이 쓰는 서버 쪽 조각

// 불러오는 동안: 뒤로 버튼은 그대로, 이름 · 제목 · 질문 5줄은 같은 크기의 빈 칸으로(레이아웃이 밀리지 않게).
// 만드는 중 화면의 질문 자리(.skeleton)와 달리 움직이지 않는다
// kind: 뒤로 버튼이 돌아갈 구획(프로젝트 /projects, 학습 자료 /projects/notes)
export function DetailLoading({
  kind = "project",
}: {
  kind?: "project" | "note";
}) {
  return (
    <>
      <LoadingStatus />
      <div aria-busy="true">
        <header className={s.top}>
          <Link
            href={kind === "note" ? "/projects/notes" : "/projects"}
            className="press icon-btn"
            aria-label={
              kind === "note" ? "학습 자료 목록으로" : "프로젝트 목록으로"
            }
          >
            <Icon name="chevronLeft" />
          </Link>
          <span className="skeleton" aria-hidden="true" />
        </header>
        <p className={s.title} aria-hidden="true">
          <span className="skeleton" style={{ width: "70%" }} />
        </p>
        <p className={s.desc} aria-hidden="true">
          <span className="skeleton" style={{ width: "50%" }} />
        </p>
        <ol className={`${s.rows} ${s.qRows}`} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className={`${s.row} ${s.qRow}`}>
              <span />
              <span>
                <span className={s.qPrompt}>
                  <span className="skeleton" />
                </span>
                <span className={s.qState}>
                  <span className="skeleton" style={{ width: "30%" }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

type Turn = {
  idx: number;
  status: string;
  score: number | null;
  verdict: string | null;
};

export function toQuestionRows(
  questions: {
    id: number;
    prompt: string;
    sessions: { status: string; created_at: string; turns: Turn[] }[];
  }[],
): QuestionRow[] {
  return questions.map((q) => {
    // 가장 최근에 본 질문을 채점받은 세션의 점수. 없고 열린 세션이 있으면 "연습 중"
    const sessions = [...q.sessions].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const main = sessions
      .map((ss) => ss.turns.find((t) => t.idx === 0))
      .find((t) => t?.status === "graded");
    const open = sessions.some((ss) => ss.status === "open");
    return {
      id: q.id,
      prompt: q.prompt,
      open,
      score: main && main.verdict !== "unknown" ? main.score : null,
      state: main
        ? main.verdict === "unknown"
          ? "모르겠어요"
          : `${main.score}점`
        : open
          ? "doing"
          : null,
    };
  });
}
