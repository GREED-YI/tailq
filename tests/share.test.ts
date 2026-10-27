import { describe, expect, it } from "vitest";
import {
  SHARE_ID,
  shareDate,
  shareName,
  shareSentence,
  type ShareCard,
} from "@/lib/share";

// 한국 시간 2026-10-27 오전 0시 30분
const card: ShareCard = {
  nickname: "테일러",
  topic_name: "JPA",
  score: 72,
  streak: 12,
  created_at: "2026-10-26T15:30:00Z",
};

describe("SHARE_ID", () => {
  it("16진수 12자만 링크 id로 받는다", () => {
    expect(SHARE_ID.test("0123456789ab")).toBe(true);
    expect(SHARE_ID.test("0123456789AB")).toBe(false);
    expect(SHARE_ID.test("0123456789a")).toBe(false);
    expect(SHARE_ID.test("../../etc")).toBe(false);
  });
});

describe("공유 카드 문구", () => {
  it("닉네임을 뺀 카드는 'TailQ 사용자'로 보인다", () => {
    expect(shareName(card)).toBe("테일러");
    expect(shareName({ ...card, nickname: null })).toBe("TailQ 사용자");
  });

  it("날짜는 만든 시각의 한국 날짜", () => {
    expect(shareDate(card)).toBe("2026.10.27");
  });

  it("만든 날에는 '오늘', 그 뒤에는 날짜로 말한다", () => {
    expect(shareSentence(card, "2026-10-27")).toEqual([
      "테일러님이 오늘 TailQ에서",
      "'JPA' 질문을 풀었어요",
    ]);
    expect(shareSentence({ ...card, nickname: null }, "2026-11-03")).toEqual([
      "10월 27일 TailQ에서",
      "'JPA' 질문을 풀었어요",
    ]);
  });
});
