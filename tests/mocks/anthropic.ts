import { http, HttpResponse } from "msw/http";

// Claude Messages API의 가짜 응답. 채점 픽스처는 AI 모듈을 만들 때 여기에 더한다.
export const anthropicHandlers = [
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = (await request.json()) as { model: string };
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
