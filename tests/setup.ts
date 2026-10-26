import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { anthropicHandlers } from "./mocks/anthropic";

// 테스트에서는 실제 키를 절대 쓰지 않는다. 키가 진짜여도 요청은 아래 MSW가 가로챈다.
process.env.ANTHROPIC_API_KEY = "test-key";

export const server = setupServer(...anthropicHandlers);

// 처리하지 않은 외부 요청은 테스트를 실패시킨다. 실제 API로 새는 호출이 없게 하려는 것이다.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
