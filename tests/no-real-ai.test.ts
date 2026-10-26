import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

describe("테스트의 Claude API 호출", () => {
  it("가짜 응답을 받는다", async () => {
    const client = new Anthropic({ maxRetries: 0 });
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16,
      messages: [{ role: "user", content: "안녕" }],
    });
    expect(res.content[0]).toMatchObject({ type: "text", text: "가짜 응답" });
  });

  it("처리하지 않은 외부 요청은 실패한다", async () => {
    await expect(fetch("https://example.com/")).rejects.toThrow();
  });
});
