import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QuestionFile, qLabel, tagLine } from "@/lib/questions";

const samples: unknown[] = JSON.parse(
  readFileSync("supabase/seed/sample-questions.json", "utf8"),
);

describe("질문 콘텐츠 형식", () => {
  it("샘플 질문은 모두 형식에 맞고, 실제 은행과 겹치지 않는 90000번대 id다", () => {
    for (const q of samples) {
      const parsed = QuestionFile.parse(q);
      expect(parsed.id).toBeGreaterThanOrEqual(90000);
    }
  });

  it("분야마다 체험 질문이 하나씩 있다", () => {
    const fields = samples.map((q) => QuestionFile.parse(q).trial_field);
    expect(new Set(fields)).toEqual(new Set(["cs", "backend", "frontend"]));
  });

  it("빠진 칸이나 잘못된 난이도는 거부한다", () => {
    const base = QuestionFile.parse(samples[0]);
    expect(QuestionFile.safeParse({ ...base, level: "hard" }).success).toBe(
      false,
    );
    expect(
      QuestionFile.safeParse({
        ...base,
        rubric: { keywords: ["하나"], criteria: [] },
      }).success,
    ).toBe(false);
    expect(QuestionFile.safeParse({ ...base, links: [] }).success).toBe(false);
  });

  it("is_hidden을 적지 않으면 숨기지 않는다", () => {
    const { is_hidden: _omit, ...rest } = QuestionFile.parse(samples[0]);
    void _omit;
    expect(QuestionFile.parse(rest).is_hidden).toBe(false);
  });
});

describe("질문 표시", () => {
  it("은행 질문은 번호와 분야 / 세부 주제, 프로젝트 질문은 내 프로젝트와 프로젝트 이름", () => {
    expect(
      tagLine({
        id: 42,
        topic_id: "jpa",
        topics: { field: "backend" },
        projects: null,
      }),
    ).toBe("Q.042 · backend / jpa");
    expect(
      tagLine({
        id: 151,
        topic_id: null,
        topics: null,
        projects: { name: "혜자" },
      }),
    ).toBe("내 프로젝트 · 혜자");
    expect(qLabel({ id: 7, project_id: null })).toBe("Q.007");
    expect(qLabel({ id: 151, project_id: "p" })).toBe("내 프로젝트");
  });
});
