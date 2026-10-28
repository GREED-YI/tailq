import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { ApiError, errorResponse, withApiErrors } =
  await import("@/lib/api-error");

const body = (res: Response) => res.json();

describe("errorResponse", () => {
  it("코드로 HTTP 상태를 정한다", async () => {
    const res = errorResponse("PROJECT_LIMIT", "x");
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: { code: "PROJECT_LIMIT", message: "x" },
    });
  });
});

describe("withApiErrors", () => {
  it("정상 응답은 그대로 돌려준다", async () => {
    const res = await withApiErrors(
      async () => new Response(null, { status: 204 }),
    )();
    expect(res.status).toBe(204);
  });

  it("ApiError는 그 코드와 메시지로 응답한다", async () => {
    const res = await withApiErrors(async () => {
      throw new ApiError("NOT_OWNER", "내 것이 아니에요.");
    })();
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({
      error: { code: "NOT_OWNER", message: "내 것이 아니에요." },
    });
  });

  it("처리하지 않은 예외는 500 INTERNAL JSON으로 응답한다", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withApiErrors(async () => {
      throw new Error("boom");
    })();
    expect(res.status).toBe(500);
    expect((await body(res)).error.code).toBe("INTERNAL");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
