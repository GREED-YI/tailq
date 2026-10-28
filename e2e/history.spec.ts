import { expect, test } from "@playwright/test";

// 옛 기록 목록(/history)은 내 질문으로 넘기지만(#136) 상세(/history/[id])와 같은 보호 목록이라 로그인부터 묻는다
test("로그인하지 않으면 옛 기록 목록 대신 로그인으로 간다", async ({
  page,
}) => {
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

// 복습·기록을 합친 내 질문(#128)
for (const path of ["/questions", "/questions/1"]) {
  test(`로그인하지 않으면 ${path} 대신 로그인으로 간다`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}

// 옛 복습 목록은 내 질문의 오늘 필터로 넘어간 뒤 로그인을 묻는다(#136)
test("옛 복습 주소는 내 질문 오늘 필터로 넘어간다", async ({ page }) => {
  await page.goto("/review");
  await expect(page).toHaveURL(
    `/login?next=${encodeURIComponent("/questions?filter=today")}`,
  );
});
