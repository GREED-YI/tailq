// 홈의 세 상태(04 기능 명세 "화면 목록" S10 오늘 안 풂 · S11 하던 중 · S12 오늘 완료)
export type HomeState =
  | { kind: "todo" }
  // step: 진행 중인 턴(0 본 질문 채점 중·실패, 1~3 꼬리질문)
  | { kind: "doing"; step: number }
  | { kind: "done" };

// 오늘 세션 상태와 idx 순서의 턴 목록으로 정한다. 본 질문에 아직 답하지 않았으면 오늘 안 풂
export function homeState(
  sessionStatus: string,
  turns: { idx: number; status: string }[],
): HomeState {
  if (sessionStatus !== "open") return { kind: "done" };
  const last = turns.at(-1);
  if (!last || (last.idx === 0 && last.status === "answering")) {
    return { kind: "todo" };
  }
  return { kind: "doing", step: last.idx };
}

// 홈 첫 방문 안내(#146)를 닫았는지 이 브라우저에 남기는 키
export const HOME_GUIDE_KEY = "tailq-home-guide";

// 첫 그림 전에 닫은 안내를 숨긴다(app/layout.tsx head). 서버는 저장소를 모르니 안내를 늘 그리고,
// 닫은 브라우저는 html에 data-home-guide를 달아 CSS로 숨긴다. 그래서 다시 온 사람은 레이아웃이 밀리지 않고,
// 처음 온 사람도 첫 그림부터 안내가 있다. 저장소를 못 읽으면 안내를 보여준다
export const homeGuideScript = `try{if(localStorage.getItem("${HOME_GUIDE_KEY}")!==null)document.documentElement.dataset.homeGuide="closed"}catch(e){}`;
