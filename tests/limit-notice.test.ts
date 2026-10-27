import { describe, expect, it } from "vitest";
import { limitNotice } from "@/components/LimitNotice";

const q = (over: Partial<Parameters<typeof limitNotice>[0]> = {}) => ({
  budget: "ok" as const,
  spentUsd: 0,
  sessionsLeft: 3,
  gensLeft: 1,
  ...over,
});

describe("limitNotice (시작 버튼 대신 보일 안내)", () => {
  it("한도가 남았으면 안내가 없다", () => {
    expect(limitNotice(q(), "both")).toBeNull();
    expect(limitNotice(q({ budget: "downgrade" }), "both")).toBeNull();
  });

  it("월 예산에 닿으면 어느 화면이든 같은 문구", () => {
    for (const what of ["practice", "register", "both"] as const) {
      expect(limitNotice(q({ budget: "exceeded" }), what)?.title).toBe(
        "오늘은 사용 한도를 모두 썼어요",
      );
    }
  });

  it("연습 한도는 질문 목록에, 등록 한도는 등록 화면에만 보인다", () => {
    const practice = q({ sessionsLeft: 0 });
    expect(limitNotice(practice, "practice")?.title).toBe(
      "오늘 프로젝트 연습 한도를 모두 썼어요",
    );
    expect(limitNotice(practice, "register")).toBeNull();

    const register = q({ gensLeft: 0 });
    expect(limitNotice(register, "register")?.title).toBe(
      "오늘 프로젝트 등록 한도를 모두 썼어요",
    );
    expect(limitNotice(register, "practice")).toBeNull();
    // 둘 다 쓴 목록 화면은 Figma S26처럼 연습 안내를 먼저
    expect(
      limitNotice(q({ sessionsLeft: 0, gensLeft: 0 }), "both")?.lines,
    ).toEqual([
      "프로젝트 연습은 내일 다시 할 수 있어요.",
      "오늘의 질문은 한도 없이 풀 수 있어요.",
    ]);
  });
});
