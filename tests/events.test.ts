import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countsAsEvent, EVENT_NAMES, parseAnonId } from "@/lib/events";

describe("지표 이벤트 이름", () => {
  // 허용 목록을 마지막으로 바꾼 마이그레이션(#150 설치 버튼)과 비교한다
  it("마이그레이션의 허용 목록과 같다", () => {
    const sql = readFileSync(
      "supabase/migrations/20261029170000_events_install.sql",
      "utf8",
    );
    const list = sql.match(/check \(name in \(([^)]*)\)\)/)?.[1] ?? "";
    expect([...list.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual([
      ...EVENT_NAMES,
    ]);
  });
});

describe("브라우저 무작위 값", () => {
  it("UUID만 받는다", () => {
    const id = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";
    expect(parseAnonId(id)).toBe(id);
    expect(parseAnonId(undefined)).toBeNull();
    expect(parseAnonId("")).toBeNull();
    expect(parseAnonId("not-a-uuid")).toBeNull();
    expect(parseAnonId(`${id}x`)).toBeNull();
  });
});

describe("첫 방문", () => {
  it("무작위 값을 처음 받는 비로그인 브라우저만 센다", () => {
    expect(countsAsEvent("first_visit", false, null)).toBe(true);
    expect(countsAsEvent("first_visit", true, null)).toBe(false);
    expect(countsAsEvent("first_visit", false, "user-1")).toBe(false);
  });

  it("알림 클릭·설치 버튼·설치 완료는 언제나 센다", () => {
    for (const name of [
      "notification_click",
      "install_click",
      "app_installed",
    ] as const) {
      expect(countsAsEvent(name, true, "user-1")).toBe(true);
      expect(countsAsEvent(name, false, null)).toBe(true);
    }
  });
});
