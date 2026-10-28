import { describe, expect, it } from "vitest";
import { themeScript } from "@/lib/theme";

// 인라인 테마 스크립트를 가짜 브라우저 환경에서 돌려 data-theme을 확인한다
function run({
  saved,
  storageThrows = false,
  systemLight,
}: {
  saved?: string | null;
  storageThrows?: boolean;
  systemLight: boolean;
}) {
  const dataset: Record<string, string> = {};
  const listeners: (() => void)[] = [];
  const mq = {
    matches: systemLight,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  const localStorage = {
    getItem: () => {
      if (storageThrows) throw new Error("SecurityError");
      return saved ?? null;
    },
  };
  const window = { matchMedia: () => mq };
  new Function("document", "window", "localStorage", "matchMedia", themeScript)(
    { documentElement: { dataset } },
    window,
    localStorage,
    window.matchMedia,
  );
  return { dataset, mq, listeners };
}

describe("테마 스크립트", () => {
  it("저장한 선택을 먼저 쓴다", () => {
    expect(run({ saved: "light", systemLight: false }).dataset.theme).toBe(
      "light",
    );
  });
  it("저장한 선택이 없으면 기기 설정을 따른다", () => {
    expect(run({ saved: null, systemLight: true }).dataset.theme).toBe("light");
    expect(run({ saved: null, systemLight: false }).dataset.theme).toBe("dark");
  });
  it("저장소를 못 읽어도 기기 설정을 따른다", () => {
    expect(run({ storageThrows: true, systemLight: true }).dataset.theme).toBe(
      "light",
    );
  });
  it("저장한 선택이 없으면 기기 설정이 바뀔 때 같이 바뀐다", () => {
    const r = run({ saved: null, systemLight: false });
    r.mq.matches = true;
    r.listeners.forEach((fn) => fn());
    expect(r.dataset.theme).toBe("light");
  });
});
