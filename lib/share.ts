// 결과 공유 카드(04 기능 명세 8번, 08 설계 shares). 공유 페이지와 미리보기 이미지가 같이 쓴다.
import { kstDay } from "@/lib/daily-pick";

// 링크 id(shares.id 기본값과 같은 모양). 모양이 다르면 DB를 읽지 않는다
export const SHARE_ID = /^[0-9a-f]{12}$/;

export type ShareCard = {
  nickname: string | null;
  topic_name: string;
  score: number;
  streak: number;
  created_at: string;
};

// 닉네임을 뺀 카드의 이름(profiles.share_nickname 주석)
export const shareName = (card: ShareCard) => card.nickname ?? "TailQ 사용자";

// 카드에 적는 날짜 "2026.10.27"(한국 날짜)
export const shareDate = (card: ShareCard) =>
  kstDay(new Date(card.created_at)).replaceAll("-", ".");

// 공유 페이지 문장 두 줄. 만든 날 보면 "오늘", 그 뒤에 보면 날짜를 쓴다
export function shareSentence(card: ShareCard, today: string) {
  const day = kstDay(new Date(card.created_at));
  const when =
    day === today
      ? "오늘"
      : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
  return [
    `${card.nickname ? `${card.nickname}님이 ` : ""}${when} TailQ에서`,
    `'${card.topic_name}' 질문을 풀었어요`,
  ] as const;
}
