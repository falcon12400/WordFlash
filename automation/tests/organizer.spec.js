const { test, expect } = require("@playwright/test");

test("樹狀分組、複合字庫與裝置導覽", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"],乙:["書"],丙:["樹"]}})));
  await page.goto("/settings.html");
  if (testInfo.project.name === "pixel-10a") { await expect(page.locator("#navToggle")).toBeVisible(); await page.locator("#navToggle").click(); }
  else await expect(page.locator("#settingsNav")).toBeVisible();
  await page.locator('#settingsNav a[data-page="manage"]').click();
  await page.locator('#managePage a[data-page="organizer"]').click();
  const frame = page.frameLocator('iframe[title="字庫分組與複合字庫"]');
  page.once("dialog", dialog => dialog.accept("中文"));
  await frame.locator("#addFolder").click();
  await frame.getByLabel("移動字庫 甲").selectOption({ label: "中文" });
  await frame.getByLabel("移動字庫 乙").selectOption({ label: "中文" });
  await frame.locator("#addPreset").click();
  await frame.locator("#presetName").fill("中文課");
  await frame.getByLabel("選取 中文 的全部字庫").check();
  await expect(frame.locator('input[data-unit="甲"]')).toBeChecked();
  await expect(frame.locator('input[data-unit="乙"]')).toBeChecked();
  await frame.locator('input[data-unit="乙"]').uncheck();
  await expect(frame.getByLabel("選取 中文 的全部字庫")).toHaveJSProperty("indeterminate", true);
  await frame.locator('input[data-unit="乙"]').check();
  await frame.locator("#savePreset").click();
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  await page.locator('#settingsNav a[data-page="home"]').click();
  await page.locator("#quickUnitSelect").selectOption({ label:"中文課" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_selected_units_v1")))).toEqual(["甲", "乙"]);
  await page.locator("#quickUnitSelect").selectOption("丙");
  await page.locator("#quickUnitSelect").selectOption({ label:"中文課" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_selected_units_v1")))).toEqual(["甲", "乙"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  await page.screenshot({path:`artifacts/${testInfo.project.name}-settings-redesign.png`, fullPage:true});
});

test("子頁保留導覽，未儲存的字庫內容離開前確認", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"]}})));
  await page.goto("/settings.html#manage");
  const frame = page.frameLocator('iframe[title="字庫管理"]');
  await expect(frame.locator("#unitWords")).toBeVisible();
  await expect(frame.locator(".study-panel")).toBeHidden();
  await frame.locator("#unitWords").fill("茶\n書");
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator('#settingsNav a[data-page="words"]').click();
  await expect(page.locator("#currentPageTitle")).toHaveText("字庫管理");
  page.once("dialog", dialog => dialog.accept());
  await page.locator('#settingsNav a[data-page="words"]').click();
  await expect(page.locator("#currentPageTitle")).toHaveText("單字統計與設定");
  const words = page.frameLocator('iframe[title="單字統計與設定"]');
  await expect(words.locator(".study-panel")).toBeVisible();
  await expect(words.locator("#unitWords")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_units_v1")).units.甲)).toEqual(["茶"]);
});

test("字庫子目錄可新增並編輯字庫", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("wordflash_units_v1", JSON.stringify({current:"甲", units:{甲:["茶"]}})));
  await page.goto("/settings.html");
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  await expect(page.locator('#libraryNavTitle')).toHaveText("字庫");
  await expect(page.locator('.nav-submenu a')).toHaveText(["新增字庫", "字庫管理", "單字統計與設定"]);
  await page.locator('#settingsNav a[data-page="add"]').click();
  const frame = page.frameLocator('iframe[title="新增字庫"]');
  await expect(frame.locator("#unitWords")).toBeHidden();
  page.once("dialog", dialog => dialog.accept("英文字庫"));
  await frame.locator("#addUnit").click();
  await frame.locator("#unitWords").fill("apple");
  await frame.locator("#saveUnit").click();
  await expect(frame.locator("#status")).toContainText("已儲存字庫");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_units_v1")).units.英文字庫)).toEqual(["apple"]);
});
