// 꼬리잇기·휴식권·학습 잔디 계산(04 기능 명세 6번, 08 설계 "꼬리잇기·잔디·휴식권").
// 따로 저장하지 않고 학습한 날 목록에서 읽을 때 계산하는 순수 함수다.
// 날짜는 모두 한국 시간 "YYYY-MM-DD" 문자열이라 문자열 비교가 곧 날짜 비교다.
import { kstDay } from "@/lib/daily-pick";

const DAY_MS = 86_400_000;

export const addDays = (day: string, n: number) =>
  new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

// 그 날이 속한 주(월~일)의 월요일
export const weekStart = (day: string) =>
  addDays(day, -((new Date(Date.parse(day)).getUTCDay() + 6) % 7));

// 본 질문 답변을 제출한 시각(turns.answered_at)의 한국 날짜가 학습한 날이다
export const studyDay = (answeredAt: string) => kstDay(new Date(answeredAt));

export type Streak = {
  // 지금 이어지는 꼬리잇기(학습한 날 수, 휴식일은 세지 않는다)
  current: number;
  longest: number;
  // 휴식권을 쓴 날
  restDays: string[];
};

// 하루만 빈 날은 그 주의 휴식권(주 1개, 월요일에 채워짐)이 남아 있으면 휴식일로 메운다.
// 이틀 이상 비거나 그 주 휴식권을 이미 썼으면 끊긴다. 오늘은 아직 풀 수 있으므로 오늘 안 풀었다고 끊지 않는다.
// 어제가 빈 날이면 오늘 풀 것을 기대해 휴식권을 미리 쓴 것으로 보여준다. 오늘도 안 풀면 내일 계산에서 빠진다.
export function computeStreak(studied: string[], today: string): Streak {
  const days = [...new Set(studied)].filter((d) => d <= today).sort();
  const restDays: string[] = [];
  const usedWeeks = new Set<string>();
  // 앞 학습일과 사이에 하루 빈 날 gap이 있을 때 휴식권으로 메울 수 있으면 쓴다
  const spendTicket = (gap: string) => {
    if (usedWeeks.has(weekStart(gap))) return false;
    usedWeeks.add(weekStart(gap));
    restDays.push(gap);
    return true;
  };

  let run = 0;
  let longest = 0;
  let prev: string | undefined;
  for (const d of days) {
    if (prev && d === addDays(prev, 1)) run++;
    else if (prev && d === addDays(prev, 2) && spendTicket(addDays(prev, 1)))
      run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const yesterday = addDays(today, -1);
  const alive =
    prev === today ||
    prev === yesterday ||
    (prev === addDays(today, -2) && spendTicket(yesterday));
  return { current: alive ? run : 0, longest, restDays };
}

export const GRASS_WEEKS = 52;

// 잔디 칸 단계 0~4(docs/07 "학습 잔디"). 0은 학습하지 않은 날.
// 점수 구간은 본 질문 점수 색(40·70, docs/09)에 90점 이상을 더했다. 모르겠어요(0점)와
// 채점 전·채점 실패(점수 없음)도 학습한 날이라 1단계다.
export function grassLevel(score: number | null | undefined): 1 | 2 | 3 | 4 {
  if (score == null || score < 40) return 1;
  if (score < 70) return 2;
  if (score < 90) return 3;
  return 4;
}

export type GrassCell = {
  day: string;
  level: 0 | 1 | 2 | 3 | 4;
  score: number | null;
  rest: boolean;
  future: boolean;
};

// 최근 52주(이번 주 포함) 칸을 월요일부터 주 단위로 채운다. 이번 주의 오늘 뒤 칸은 future
export function grassCells(
  scores: Map<string, number | null>,
  restDays: string[],
  today: string,
): GrassCell[] {
  const start = grassStart(today);
  const rest = new Set(restDays);
  return Array.from({ length: GRASS_WEEKS * 7 }, (_, i) => {
    const day = addDays(start, i);
    const studied = scores.has(day);
    const score = scores.get(day) ?? null;
    return {
      day,
      level: studied ? grassLevel(score) : 0,
      score,
      rest: rest.has(day),
      future: day > today,
    };
  });
}

export const grassStart = (today: string) =>
  addDays(weekStart(today), -(GRASS_WEEKS - 1) * 7);
