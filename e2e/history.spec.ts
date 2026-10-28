import { expect, test } from "@playwright/test";

test("로그인하지 않으면 기록 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL("/login?next=%2Fhistory");
});

test("로그인하지 않으면 기록 상세 대신 로그인으로 간다", async ({ page }) => {
  const id = "00000000-0000-0000-0000-000000000001";
  await page.goto(`/history/${id}`);
  await expect(page).toHaveURL(`/login?next=%2Fhistory%2F${id}`);
});

test("로그인하지 않으면 리포트 대신 로그인으로 간다", async ({ page }) => {
  await page.goto("/report");
  await expect(page).toHaveURL("/login?next=%2Freport");
});

// 리포트는 기록 탭 안(/history/report)에 있다가 /report로 옮겼다. 옛 주소도 로그인부터 묻는다
test("옛 리포트 주소도 로그인하지 않으면 로그인으로 간다", async ({ page }) => {
  await page.goto("/history/report");
  await expect(page).toHaveURL("/login?next=%2Fhistory%2Freport");
});

// 복습·기록을 합친 내 질문(#128). 옛 복습 주소도 #132까지 열려 있어 로그인부터 묻는다
for (const path of ["/questions", "/questions/1", "/review"]) {
  test(`로그인하지 않으면 ${path} 대신 로그인으로 간다`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}
