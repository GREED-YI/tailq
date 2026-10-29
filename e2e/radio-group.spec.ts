import { expect, test } from "@playwright/test";
import { login, supabase } from "./login";

// role=radio 묶음의 키보드(#169, lib/radio-group.ts). 로그인한 화면이라 로컬 Supabase가 있을 때만 돈다.
// 피드백 분류로 본다. 보내지는 않는다
test.skip(!supabase, "로컬 Supabase가 있어야 로그인한 화면을 본다");

test("분류는 Tab 한 번에 들어가고 방향키로 고른다", async ({
  page,
  context,
}) => {
  await login(context, "e2e-radio@example.test");
  await page.goto("/my/feedback");
  const group = page.getByRole("radiogroup", { name: "분류" });
  const etc = group.getByRole("radio", { name: "기타" });
  await expect(etc).toBeChecked();

  // 고른 칸만 Tab에 멈춘다
  await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await etc.focus();

  // ← 앞 칸을 고르고 초점도 옮긴다, → 끝에서는 첫 칸으로 돈다
  await page.keyboard.press("ArrowLeft");
  const report = group.getByRole("radio", { name: "신고" });
  await expect(report).toBeChecked();
  await expect(report).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const feature = group.getByRole("radio", { name: "바라는 기능" });
  await expect(feature).toBeChecked();
  await expect(feature).toBeFocused();

  // Tab은 묶음을 바로 빠져나가 의견 칸으로 간다
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("의견")).toBeFocused();
});
