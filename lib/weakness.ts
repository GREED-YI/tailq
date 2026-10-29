// 약점 리포트(04 기능 명세 6번 E-3, 08 설계 "꼬리잇기·잔디·휴식권").
// 따로 저장하지 않고 본 질문 점수 목록에서 읽을 때 계산하는 순수 함수다.
import { weekStart } from "@/lib/streak";

// 채점된 본 질문 하나. day는 제출한 한국 날짜("YYYY-MM-DD")
export type Attempt = {
  topicId: string;
  topic: string;
  day: string;
  score: number;
};

export type TopicScore = {
  topicId: string;
  topic: string;
  attempts: number;
  average: number;
  // 지난주까지의 평균에서 이번 주 기록을 더한 지금 평균까지의 변화. 지난주까지 기록이 없으면 null
  change: number | null;
};

const MIN_ATTEMPTS = 3;

const mean = (xs: number[]) =>
  Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

// 3번 이상 푼 세부 주제를 평균이 낮은 순으로. 그보다 적게 푼 주제는 "데이터가 모이는 중"으로 개수만 센다
export function weaknessReport(attempts: Attempt[], today: string) {
  const thisWeek = weekStart(today);
  const byTopic = new Map<string, Attempt[]>();
  for (const a of attempts) {
    byTopic.set(a.topicId, [...(byTopic.get(a.topicId) ?? []), a]);
  }

  const topics: TopicScore[] = [];
  let collecting = 0;
  for (const [topicId, list] of byTopic) {
    if (list.length < MIN_ATTEMPTS) {
      collecting++;
      continue;
    }
    const average = mean(list.map((a) => a.score));
    const before = list.filter((a) => a.day < thisWeek).map((a) => a.score);
    topics.push({
      topicId,
      topic: list[0].topic,
      attempts: list.length,
      average,
      change: before.length ? average - mean(before) : null,
    });
  }
  topics.sort(
    (a, b) => a.average - b.average || a.topic.localeCompare(b.topic, "ko"),
  );
  return { topics, collecting };
}
