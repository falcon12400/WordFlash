const { test, expect } = require("@playwright/test");

async function openLibrary(page, testInfo) {
  await page.goto("/settings.html#manage");
  if (testInfo.project.name === "pixel-10a") {
    await page.locator("#navToggle").click();
    await page.locator('#settingsNav a[data-page="manage"]').click();
  }
  return page.frameLocator('iframe[title="字庫管理"]');
}

test("分類樹整合一般字庫與複合字庫", async ({ page }, testInfo) => {
  await page.addInitScript(() => { if (!localStorage.getItem("wordflash_units_v1")) localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"],乙:["書"],丙:["樹"]}})); });
  const frame = await openLibrary(page, testInfo);
  page.once("dialog", dialog => dialog.accept("中文"));
  await frame.getByRole("button", { name: "＋ 新增資料夾" }).click();
  await expect(frame.getByRole("button", { name: "📁 中文" })).toBeVisible();
  await frame.getByRole("button", { name: "📁 中文" }).click();
  await expect(frame.getByRole("button", { name: "新增子資料夾" })).toBeVisible();

  await frame.getByRole("button", { name: "＋ 新增複合字庫" }).click();
  await frame.getByLabel("複合字庫名稱").fill("兩課");
  await frame.getByLabel("甲").check();
  await frame.getByLabel("乙").check();
  await frame.getByRole("button", { name: "儲存複合字庫" }).click();
  await expect(frame.getByText("🔗 兩課", { exact: true })).toBeVisible();

  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  await page.locator('#settingsNav a[data-page="home"]').click();
  await page.locator("#quickUnitSelect").selectOption({ label:"兩課" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_selected_units_v1")))).toEqual(["甲", "乙"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
});

test("整合管理頁保留未儲存內容的離開確認", async ({ page }, testInfo) => {
  await page.addInitScript(() => { if (!localStorage.getItem("wordflash_units_v1")) localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"]}})); });
  const frame = await openLibrary(page, testInfo);
  await frame.getByRole("button", { name: "📖 甲" }).click();
  await frame.getByRole("button", { name: "編輯字庫" }).click();
  const editor = frame.frameLocator('iframe[title="編輯 甲"]');
  await editor.locator("#unitWords").fill("茶\n書");
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator('#settingsNav a[data-page="home"]').click();
  await expect(page.locator("#currentPageTitle")).toHaveText("字庫管理");
  page.once("dialog", dialog => dialog.accept());
  await page.locator('#settingsNav a[data-page="home"]').click();
  await expect(page.locator("#currentPageTitle")).toHaveText("設定首頁");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_units_v1")).units.甲)).toEqual(["茶"]);
});

test("可從整合頁新增字庫並直接編輯", async ({ page }, testInfo) => {
  await page.addInitScript(() => { if (!localStorage.getItem("wordflash_units_v1")) localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"]}})); });
  const frame = await openLibrary(page, testInfo);
  page.once("dialog", dialog => dialog.accept("英文字庫"));
  await frame.getByRole("button", { name: "＋ 新增字庫" }).click();
  await expect(frame.getByRole("button", { name: "📖 英文字庫" })).toBeVisible();
  const editor = frame.frameLocator('iframe[title="編輯 英文字庫"]');
  await editor.locator("#unitWords").fill("apple");
  await expect(editor.locator("#unitWords")).toHaveValue("apple");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_units_v1")).units.英文字庫)).toEqual([]);
});
