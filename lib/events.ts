// 지표 이벤트(04 기능 명세 12장, 08 설계 events). 이름 목록은 마이그레이션의 check와 같아야 한다(테스트가 지킨다).
// props에는 id와 종류만 넣는다. 답변 글은 넣지 않는다(개인정보처리방침).
export type EventProps = {
  first_visit: Record<string, never>;
  trial_start: { field: string };
  trial_complete: { session_id: string };
  signup: Record<string, never>;
  session_start: { session_id: string; kind: string };
  answer_submit: {
    session_id: string;
    turn_id: string;
    kind: string;
    dont_know: boolean;
  };
  session_complete: { session_id: string; kind: string };
  rating: { turn_id: string; rating: 1 | -1 };
  share: { session_id: string };
  notification_click: Record<string, never>;
  install_click: Record<string, never>;
  app_installed: Record<string, never>;
};
export type EventName = keyof EventProps;

export const EVENT_NAMES = [
  "first_visit",
  "trial_start",
  "trial_complete",
  "signup",
  "session_start",
  "answer_submit",
  "session_complete",
  "rating",
  "share",
  "notification_click",
  "install_click",
  "app_installed",
] as const satisfies readonly EventName[];

// 브라우저를 구분하는 무작위 값(개인정보처리방침 "이용 기록"). 첫 방문 신호를 보낼지 브라우저가 알아야 해서
// httpOnly가 아니다. 이 값으로는 아무 권한도 주지 않고 이벤트를 묶는 데만 쓴다.
export const ANON_COOKIE = "tailq-anon";
export const ANON_MAX_AGE = 60 * 60 * 24 * 365;

// 루트 레이아웃의 클라이언트 컴포넌트도 이 파일을 읽으므로 zod 없이 확인한다(모든 화면 번들에 들어가지 않게)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const parseAnonId = (value: string | undefined) =>
  value && UUID.test(value) ? value : null;

// 브라우저가 POST /api/events로 직접 보내는 이벤트. 나머지는 서버가 그 일을 처리하면서 남긴다
export const CLIENT_EVENTS = [
  "first_visit",
  "notification_click",
  "install_click",
  "app_installed",
] as const satisfies readonly EventName[];

// 첫 방문은 이 브라우저에 무작위 값을 처음 줄 때, 로그인하지 않은 사람만 센다
// (쿠키를 지운 기존 사용자가 첫 방문자로 잡히지 않게)
export const countsAsEvent = (
  name: (typeof CLIENT_EVENTS)[number],
  hadAnonId: boolean,
  userId: string | null,
) => name !== "first_visit" || (!hadAnonId && !userId);
