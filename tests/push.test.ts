import { createECDH, randomBytes } from "node:crypto";
import { http, HttpResponse } from "msw";
import webpush from "web-push";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { server } from "./setup";

vi.mock("server-only", () => ({}));
const {
  isCronAuthorized,
  isPushEndpoint,
  pushPayload,
  sendDailyPushes,
  PICK_LIMIT,
  PUSH_BATCH,
} = await import("@/lib/server/push");

describe("알림 문구", () => {
  it("복습일이 된 질문이 있으면 복습 문구, 없으면 오늘의 질문 문구", () => {
    expect(JSON.parse(pushPayload(true))).toMatchObject({
      title: "복습할 질문이 있어요",
      url: "/home",
    });
    expect(JSON.parse(pushPayload(false))).toMatchObject({
      title: "오늘의 질문이 도착했어요",
      url: "/home",
    });
  });
});

describe("크론 비밀 헤더", () => {
  it("Bearer 비밀값이 같을 때만 통과한다", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer wrong!", "s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
  });

  it("서버에 비밀값이 없으면 아무도 통과하지 못한다", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});

describe("구독 주소 허용 목록", () => {
  it("브라우저 푸시 서비스 주소만 받는다", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ])
      expect(isPushEndpoint(ok), ok).toBe(true);
    for (const bad of [
      "https://example.com/push",
      "https://fcm.googleapis.com.evil.test/x",
      "https://evilpush.apple.com/x",
      "https://127.0.0.1/x",
    ])
      expect(isPushEndpoint(bad), bad).toBe(false);
  });
});

// 브라우저가 만드는 것과 같은 모양의 구독 키(P-256 공개 키 + 16바이트 auth)
const b64url = (b: Buffer) => b.toString("base64url");
function subscription(id: string, userId: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    id,
    user_id: userId,
    endpoint: `https://push.example.test/${id}`,
    p256dh: b64url(ecdh.getPublicKey()),
    auth_key: b64url(randomBytes(16)),
  };
}

// supabase-js에서 쓰는 만큼만 흉내 낸다
function fakeDb(
  targets: { user_id: string; review: boolean }[],
  subs: ReturnType<typeof subscription>[],
) {
  const deleted: string[] = [];
  const left = [...targets];
  const rpc = vi.fn((_: string, args: { p_limit: number }) => ({
    throwOnError: async () => ({ data: left.splice(0, args.p_limit) }),
  }));
  const db = {
    rpc,
    from: () => ({
      select: () => ({
        in: (_: string, ids: string[]) => ({
          order: () => ({
            range: (from: number, to: number) => ({
              throwOnError: async () => ({
                data: subs
                  .filter((s) => ids.includes(s.user_id))
                  .slice(from, to + 1),
              }),
            }),
          }),
        }),
      }),
      delete: () => ({
        in: (_: string, ids: string[]) => ({
          throwOnError: async () => {
            deleted.push(...ids);
            return {};
          },
        }),
      }),
    }),
  };
  return { db: db as never, rpc, deleted };
}

describe("매시 알림 발송", () => {
  beforeAll(() => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = "mailto:test@example.test";
  });

  it("대상이 없어도 대상 고르기를 한 번 부르고 아무것도 보내지 않는다", async () => {
    const { db, rpc } = fakeDb([], []);
    const now = new Date("2026-10-27T23:00:00Z");
    expect(await sendDailyPushes(db, now)).toEqual({
      targets: 0,
      sent: 0,
      gone: 0,
    });
    expect(rpc).toHaveBeenCalledWith("pick_push_targets", {
      p_now: now.toISOString(),
      p_limit: PICK_LIMIT,
    });
  });

  it("기기마다 문구를 골라 20개씩 보내고, 없어진 구독(404·410)은 지운다", async () => {
    // 사용자 a(복습 있음)는 기기 2개, b는 43개. b의 기기 중 둘은 없어졌고 하나는 일시 오류
    const subs = [
      subscription("a1", "a"),
      subscription("a2", "a"),
      ...Array.from({ length: 43 }, (_, i) => subscription(`b${i}`, "b")),
    ];
    const status: Record<string, number> = { b3: 410, b7: 404, b9: 500 };
    let inFlight = 0;
    let maxInFlight = 0;
    const ttl: Record<string, string> = {};
    server.use(
      http.post(
        "https://push.example.test/:id",
        async ({ params, request }) => {
          const id = String(params.id);
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 5));
          inFlight--;
          // 내용은 암호화되어 있어 받는 쪽 키 없이는 읽을 수 없다. 머리글만 확인한다
          expect(request.headers.get("authorization")).toMatch(/^vapid t=/);
          ttl[id] = request.headers.get("ttl") ?? "";
          return new HttpResponse(null, { status: status[id] ?? 201 });
        },
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { db, deleted } = fakeDb(
      [
        { user_id: "a", review: true },
        { user_id: "b", review: false },
      ],
      subs,
    );
    expect(await sendDailyPushes(db)).toEqual({
      targets: 2,
      sent: 42,
      gone: 2,
    });
    expect(Object.keys(ttl)).toHaveLength(45);
    expect(maxInFlight).toBeLessThanOrEqual(PUSH_BATCH);
    expect(deleted.sort()).toEqual(["b3", "b7"]);
    expect(ttl.a1).toBe(String(4 * 60 * 60));
  });

  it("대상이 많으면 빈 묶음이 올 때까지 나눠 고르고 모두 보낸다", async () => {
    const send = vi
      .spyOn(webpush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    const n = PICK_LIMIT * 2;
    const ids = Array.from({ length: n }, (_, i) => `u${i}`);
    const { db, rpc } = fakeDb(
      ids.map((user_id) => ({ user_id, review: false })),
      ids.map((u) => subscription(`${u}d`, u)),
    );
    expect(await sendDailyPushes(db)).toEqual({ targets: n, sent: n, gone: 0 });
    // 꽉 찬 묶음 둘 + 빈 묶음 하나
    expect(rpc).toHaveBeenCalledTimes(3);
    send.mockRestore();
  });

  it("복습 여부에 따라 사용자마다 다른 문구를 보낸다", async () => {
    const send = vi
      .spyOn(webpush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    const { db } = fakeDb(
      [
        { user_id: "a", review: true },
        { user_id: "b", review: false },
      ],
      [subscription("a1", "a"), subscription("b1", "b")],
    );
    await sendDailyPushes(db);
    const titleFor = (endpoint: string) =>
      JSON.parse(
        String(send.mock.calls.find((c) => c[0].endpoint === endpoint)?.[1]),
      ).title;
    expect(titleFor("https://push.example.test/a1")).toBe(
      "복습할 질문이 있어요",
    );
    expect(titleFor("https://push.example.test/b1")).toBe(
      "오늘의 질문이 도착했어요",
    );
    send.mockRestore();
  });
});
