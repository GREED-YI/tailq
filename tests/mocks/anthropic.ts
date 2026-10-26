import { http, HttpResponse } from "msw/http";
import { MOCK_GRADE } from "@/lib/grading";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

// 스트리밍 응답(SSE). 글을 몇 글자씩 잘라 content_block_delta로 흘린다
export function sseMessage(
  text: string,
  { stopReason = "end_turn", chunk = 7 } = {},
) {
  const events: [string, object][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
    ],
    [
      "content_block_start",
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      },
    ],
  ];
  for (let i = 0; i < text.length; i += chunk) {
    events.push([
      "content_block_delta",
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: text.slice(i, i + chunk) },
      },
    ]);
  }
  events.push(
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: 10 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  );
  const body = events
    .map(
      ([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    .join("");
  return new HttpResponse(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

export const streamMessage = (
  text: string,
  opts?: Parameters<typeof sseMessage>[1],
) => http.post(MESSAGES_URL, () => sseMessage(text, opts));

// Claude Messages API의 가짜 응답. 스트리밍이면 채점 픽스처를, 아니면 짧은 글을 돌려준다
export const anthropicHandlers = [
  http.post(MESSAGES_URL, async ({ request }) => {
    const body = (await request.json()) as { model: string; stream?: boolean };
    if (body.stream) return sseMessage(JSON.stringify(MOCK_GRADE));
    return HttpResponse.json({
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [{ type: "text", text: "가짜 응답" }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  }),
];
