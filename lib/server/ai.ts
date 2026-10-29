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
import {
  MOCK_NOTE_QUESTIONS,
  MOCK_PROJECT_QUESTIONS,
  NOTE_SYSTEM_PROMPT,
  NoteQuestionsOutput,
  PROJECT_SYSTEM_PROMPT,
  ProjectQuestionsOutput,
  noteUserMessage,
  projectUserMessage,
  type NoteInput,
  type ProjectInput,
} from "@/lib/question-gen";

// Claude API 호출은 이 모듈에만 둔다(08 설계 6장 "AI 경계"). 서버에서만 import한다.
// 모델 ID는 docs/09 5장. 예산 80%를 넘은 뒤 시작한 세션은 본 질문도 꼬리질문 모델(Haiku)로 채점한다.
export const GRADE_MODEL = "claude-sonnet-5-5";
export const FOLLOW_UP_MODEL = "claude-haiku-5-5";
// README에 없는 사실을 지어내지 않는 게 중요해서 Sonnet(docs/09 5장)
export const PROJECT_MODEL = "claude-sonnet-5-5";

// 서버의 Claude 호출 타임아웃(08 설계 "시간 기준은 셋이다")
const TIMEOUT_MS = 15_000;
// 질문 5개 생성은 30~60초 넘게 걸릴 수 있다. 라우트 maxDuration 300초 안에서 실패를 저장할 여유를 둔다
const PROJECT_TIMEOUT_MS = 240_000;

// 구조화 출력 스키마. 거절(refusal)이면 SDK의 자동 파싱이 먼저 터지므로 파싱은 직접 한다
const GRADE_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(GradeOutput).schema,
};
const FOLLOW_UP_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(FollowUpOutput).schema,
};
const PROJECT_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(ProjectQuestionsOutput).schema,
};
const NOTE_FORMAT = {
  type: "json_schema" as const,
  schema: betaZodOutputFormat(NoteQuestionsOutput).schema,
};

// 100만 토큰당 달러 [입력, 출력](docs/09 5장). 캐시 읽기는 입력의 0.1배, 캐시 쓰기(5분)는 1.25배.
// Opus는 서버 쪽 대체 모델로 넘어갈 때를 위해 둔다
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-opus-5-5": [4, 20],
};

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

// 호출 한 번의 비용(달러). 모르는 모델이면 표에서 가장 비싼 값으로 잡아 예산을 넉넉히 쓴 것으로 본다.
// ponytail: 대체 모델로 넘어간 호출도 응답의 마지막 모델 값으로 한 번에 센다. 정확해야 하면 usage.iterations를 모델별로 더한다
export function costUsd(model: string, u: Usage) {
  const [input, output] = PRICES[model] ?? [4, 20];
  const tokens =
    u.input_tokens * input +
    (u.cache_read_input_tokens ?? 0) * input * 0.1 +
    (u.cache_creation_input_tokens ?? 0) * input * 1.25 +
    u.output_tokens * output;
  return tokens / 1_000_000;
}

// ai_usage 한 행(08 설계 7장 "AI 호출 기록"). 성공·실패 모두 남긴다
export type AiUsage = {
  status: "used" | "failed";
  model: string;
  error_code: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cost_usd: number;
};
export type OnUsage = (usage: AiUsage) => void | Promise<void>;

export class GradingError extends Error {
  constructor(readonly reason: "timeout" | "refusal" | "schema_invalid") {
    super(reason);
  }
}

// 본 질문 채점(Sonnet, light면 Haiku). 보이는 글이 생기는 대로 onText로 조금씩 넘기고, 끝나면 검증 전의 모델 출력을 돌려준다.
// 사용자가 떠나도 끝까지 받도록 브라우저 요청의 signal은 받지 않는다(08 설계 "실행 환경").
// 호출이 끝나면(실패 포함) onUsage로 토큰·비용을 넘긴다
export async function grade(
  input: GradeInput,
  onText: (delta: string) => void,
  { light = false, onUsage }: { light?: boolean; onUsage?: OnUsage } = {},
): Promise<GradeOutput> {
  const model = light ? FOLLOW_UP_MODEL : GRADE_MODEL;
  if (process.env.AI_MOCK === "1") {
    return mockStream(MOCK_GRADE, onText, model, onUsage);
  }
  return streamStructured(
    {
      model,
      // 안전 분류기가 기술 질문을 잘못 거절하면 서버 쪽 대체 모델로 다시 돈다(docs/09 5장). Haiku에는 없다
      fallback: !light,
      system: GRADE_SYSTEM_PROMPT,
      user: gradeUserMessage(input),
      format: GRADE_FORMAT,
    },
    GradeOutput,
    onText,
    onUsage,
  );
}

// 꼬리질문 채점 + 다음 꼬리질문(Haiku, 서버 쪽 대체 모델 없음). 보이는 글은 한 줄 피드백이다
export async function gradeFollowUp(
  input: FollowUpInput,
  onText: (delta: string) => void,
  onUsage?: OnUsage,
): Promise<FollowUpOutput> {
  if (process.env.AI_MOCK === "1") {
    return mockStream(MOCK_FOLLOW_UP, onText, FOLLOW_UP_MODEL, onUsage);
  }
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
    onUsage,
  );
}

// 내 프로젝트 질문 5개 생성(Sonnet). 화면에 흘릴 글이 없어 끝난 출력만 돌려준다.
// 브라우저 요청과 상관없이 after()에서 돈다(08 설계 "내 프로젝트 질문 생성")
export async function generateProjectQuestions(
  input: ProjectInput,
  onUsage?: OnUsage,
): Promise<ProjectQuestionsOutput> {
  if (process.env.AI_MOCK === "1") {
    await onUsage?.(mockUsage(PROJECT_MODEL));
    return MOCK_PROJECT_QUESTIONS;
  }
  return streamStructured(
    {
      model: PROJECT_MODEL,
      fallback: true,
      system: PROJECT_SYSTEM_PROMPT,
      user: projectUserMessage(input),
      format: PROJECT_FORMAT,
      timeoutMs: PROJECT_TIMEOUT_MS,
    },
    ProjectQuestionsOutput,
    () => {},
    onUsage,
  );
}

// 학습 자료 질문 5개 생성(#141). 프로젝트 질문 생성과 모델·시간·흐름이 같고 프롬프트만 다르다
export async function generateNoteQuestions(
  input: NoteInput,
  onUsage?: OnUsage,
): Promise<NoteQuestionsOutput> {
  if (process.env.AI_MOCK === "1") {
    await onUsage?.(mockUsage(PROJECT_MODEL));
    return MOCK_NOTE_QUESTIONS;
  }
  return streamStructured(
    {
      model: PROJECT_MODEL,
      fallback: true,
      system: NOTE_SYSTEM_PROMPT,
      user: noteUserMessage(input),
      format: NOTE_FORMAT,
      timeoutMs: PROJECT_TIMEOUT_MS,
    },
    NoteQuestionsOutput,
    () => {},
    onUsage,
  );
}

async function streamStructured<T>(
  req: {
    model: string;
    fallback: boolean;
    system: string;
    user: string;
    format: { type: "json_schema"; schema: Record<string, unknown> };
    timeoutMs?: number;
  },
  schema: z.ZodType<T>,
  onText: (delta: string) => void,
  onUsage?: OnUsage,
): Promise<T> {
  const client = new Anthropic({ maxRetries: 1 });
  const started = Date.now();
  let usage: Usage | undefined;
  let model = req.model;
  let failure: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    req.timeoutMs ?? TIMEOUT_MS,
  );
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
    usage = message.usage;
    model = message.model;
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
    const error = controller.signal.aborted ? new GradingError("timeout") : e;
    failure = error instanceof GradingError ? error.reason : "api_error";
    throw error;
  } finally {
    clearTimeout(timer);
    // 타임아웃처럼 응답이 없으면 토큰을 모른다. 비용은 0으로 남는다
    await onUsage?.({
      status: failure ? "failed" : "used",
      model,
      error_code: failure,
      latency_ms: Date.now() - started,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      cache_read_tokens: usage?.cache_read_input_tokens ?? null,
      cache_write_tokens: usage?.cache_creation_input_tokens ?? null,
      cost_usd: usage ? costUsd(model, usage) : 0,
    });
  }
}

// 가짜 응답의 기록. 토큰·비용 없이 행만 남겨 로컬·E2E에서도 예약이 정리되는 흐름을 그대로 탄다
const mockUsage = (model: string): AiUsage => ({
  status: "used",
  model,
  error_code: null,
  latency_ms: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  cost_usd: 0,
});

// 스트리밍 mock: 픽스처 JSON을 글자 단위로 잘라 흘린다(08 설계 6장)
async function mockStream<T>(
  fixture: T,
  onText: (delta: string) => void,
  model: string,
  onUsage?: OnUsage,
) {
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
  await onUsage?.(mockUsage(model));
  return fixture;
}
