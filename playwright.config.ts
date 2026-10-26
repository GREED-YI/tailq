import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // CI에서는 실패했을 때 올릴 HTML 리포트를 만든다
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // E2E도 Claude API는 가짜 응답으로 돈다(AI_MOCK=1).
  // 로그인하지 않은 화면만 보므로 Supabase는 띄우지 않고 주소·키 자리만 채운다.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      AI_MOCK: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    },
  },
});
