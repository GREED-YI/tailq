import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  FollowUpOutput,
  GRADE_SYSTEM_PROMPT,
  GradeOutput,
  MOCK_FOLLOW_UP,
  MOCK_GRADE,
  followUpUserMessage,
  gradeUserMessage,
  visibleText,
  type FollowUpInput,
  type GradeInput,
} from "@/lib/grading";

// Claude API 호출은 이 모듈에만 둔다(08 설계 6장 "AI 경계"). 서버에서만 import한다.
// 모델 ID는 docs/09 5장. 예산 80% 뒤 Haiku로 낮추는 것은 하루 사용 상한 이슈에서 붙인다.
export const GRADE_MODEL = "claude-sonnet-5-5";
export const FOLLOW_UP_MODEL = "claude-haiku-5-5";

// 서버의 Claude 호출 타임아웃(08 설계 "시간 기준은 셋이다")
const TIMEOUT_MS = 15_000;

// 구조화 출력 스키마. 거절(refusal)이면 SDK의 자동 파싱이 먼저 터지므로 파싱은 직접 한다
const GRADE_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(GradeOutput).schema,
};
const FOLLOW_UP_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(FollowUpOutput).schema,
};

export class GradingError extends Error {
  constructor(readonly reason: "timeout" | "refusal" | "schema_invalid") {
    super(reason);
  }
}

// 본 질문 채점(Sonnet). 보이는 글이 생기는 대로 onText로 조금씩 넘기고, 끝나면 검증 전의 모델 출력을 돌려준다.
// 사용자가 떠나도 끝까지 받도록 브라우저 요청의 signal은 받지 않는다(08 설계 "실행 환경").
export async function grade(
  input: GradeInput,
  onText: (delta: string) => void,
): Promise<GradeOutput> {
  if (process.env.AI_MOCK === "1") return mockStream(MOCK_GRADE, onText);
  return streamStructured(
    {
      model: GRADE_MODEL,
      // 안전 분류기가 기술 질문을 잘못 거절하면 서버 쪽 대체 모델로 다시 돈다(docs/09 5장)
      fallback: true,
      system: GRADE_SYSTEM_PROMPT,
      user: gradeUserMessage(input),
      format: GRADE_FORMAT,
    },
    GradeOutput,
    onText,
  );
}

// 꼬리질문 채점 + 다음 꼬리질문(Haiku, 서버 쪽 대체 모델 없음). 보이는 글은 한 줄 피드백이다
export async function gradeFollowUp(
  input: FollowUpInput,
  onText: (delta: string) => void,
): Promise<FollowUpOutput> {
  if (process.env.AI_MOCK === "1") return mockStream(MOCK_FOLLOW_UP, onText);
  return streamStructured(
    {
      model: FOLLOW_UP_MODEL,
      fallback: false,
      system: FOLLOW_UP_SYSTEM_PROMPT,
      user: followUpUserMessage(input),
      format: FOLLOW_UP_FORMAT,
    },
    FollowUpOutput,
    onText,
  );
}

async function streamStructured<T>(
  req: {
    model: string;
    fallback: boolean;
    system: string;
    user: string;
    format: { type: "json_schema"; schema: Record<string, unknown> };
  },
  schema: z.ZodType<T>,
  onText: (delta: string) => void,
): Promise<T> {
  const client = new Anthropic({ maxRetries: 1 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let sent = "";
  try {
    const stream = client.beta.messages.stream(
      {
        model: req.model,
        max_tokens: 8000,
        ...(req.fallback && {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }),
        system: [
          {
            type: "text",
            text: req.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: req.user }],
        // 생각은 켜 두고 노력 수준은 low(docs/09 5장). 모델마다 기본값이 달라 꼭 정한다
        output_config: { effort: "low", format: req.format },
      },
      { signal: controller.signal },
    );
    stream.on("text", (_delta, snapshot) => {
      const shown = visibleText(snapshot);
      if (shown.length > sent.length && shown.startsWith(sent)) {
        onText(shown.slice(sent.length));
        sent = shown;
      }
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new GradingError("refusal");
    // 중간에 대체 모델로 넘어갔으면 마지막 text 블록이 그 모델의 출력이다
    const last = message.content.findLast((b) => b.type === "text");
    const text = last?.type === "text" ? last.text : "";
    let parsed;
    try {
      parsed = schema.safeParse(JSON.parse(text));
    } catch {
      throw new GradingError("schema_invalid");
    }
    if (!parsed.success) throw new GradingError("schema_invalid");
    return parsed.data;
  } catch (e) {
    if (controller.signal.aborted) throw new GradingError("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 스트리밍 mock: 픽스처 JSON을 글자 단위로 잘라 흘린다(08 설계 6장)
async function mockStream<T>(fixture: T, onText: (delta: string) => void) {
  const json = JSON.stringify(fixture);
  let sent = "";
  for (let i = 8; i <= json.length; i += 8) {
    const shown = visibleText(json.slice(0, i));
    if (shown.length > sent.length) {
      onText(shown.slice(sent.length));
      sent = shown;
      await new Promise((r) => setTimeout(r, 15));
    }
  }
  const rest = visibleText(json);
  if (rest.length > sent.length) onText(rest.slice(sent.length));
  return fixture;
}
