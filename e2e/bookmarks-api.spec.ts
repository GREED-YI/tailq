import { expect, test } from "@playwright/test";

test("로그인하지 않고 북마크를 저장·해제할 수 없다", async ({ request }) => {
  for (const res of [
    await request.put("/api/bookmarks/1"),
    await request.delete("/api/bookmarks/1"),
  ]) {
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "로그인이 필요해요." },
    });
  }
});
