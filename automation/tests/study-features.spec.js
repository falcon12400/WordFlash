const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("多字庫、單字開關與個別正確率", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("wordflash_units_v1")) {
      localStorage.setItem("wordflash_units_v1", JSON.stringify({
        current: "第一課",
        units: { "第一課": ["茶", "樹"], "第二課": ["茶", "書"] }
      }));
      localStorage.setItem("wordflash_practice_mode_v1", "challenge");
    }
  });
  await page.goto("/settings.html#manage");
  const organizer = page.frameLocator('iframe[title="字庫管理"]');
  await organizer.getByRole("button", { name: "＋ 新增複合字庫" }).click();
  await organizer.getByLabel("複合字庫名稱").fill("兩課");
  await organizer.getByLabel("第一課").check();
  await organizer.getByLabel("第二課").check();
  await organizer.getByRole("button", { name: "儲存複合字庫" }).click();
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  await page.locator('#settingsNav a[data-page="home"]').click();
  await page.locator("#quickUnitSelect").selectOption({ label: "兩課" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-multi-library-settings.png`), scale: "device" });
  if (testInfo.project.name === "pixel-10a") await page.locator("#navToggle").click();
  await page.locator('#settingsNav a[data-page="practice"]').click();
  await page.locator('input[name="challengeSampling"][value="weighted"]').check();

  await page.goto("/manage_words.html");
  await page.getByRole("checkbox", { name: "啟用 樹" }).uncheck();
  await page.locator("#unitSelect").selectOption("第二課");
  await page.getByRole("checkbox", { name: "啟用 書" }).uncheck();

  await page.goto("/canvas_words.html");
  await expect(page.locator("#unitSelect")).toHaveValue("__wordflash_combined__");
  await expect(page.locator(".word-display")).toContainText("茶");
  await page.locator("#correctButton").click();
  await page.locator("#incorrectButton").click();
  await page.locator("#nextButton").click();
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_word_stats_v1")));
  expect(stats[JSON.stringify(["茶", ""])]).toEqual({ correct: 1, incorrect: 1 });

  await page.goto("/manage_words.html");
  await expect(page.locator(".study-word").filter({ hasText: "茶" })).toContainText("50.0%（對 1／錯 1）");
  await page.locator("#unitSelect").selectOption("第一課");
  await expect(page.locator(".study-word").filter({ hasText: "茶" })).toContainText("50.0%（對 1／錯 1）");
  await expect(page.getByRole("checkbox", { name: "啟用 樹" })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  await page.screenshot({ path: path.join(artifactDir, `${testInfo.project.name}-word-statistics.png`), scale: "device" });
  await page.locator("#disableAllWords").click();
  await page.locator("#unitSelect").selectOption("第二課");
  await page.locator("#disableAllWords").click();
  await page.goto("/canvas_words.html");
  await expect(page.locator("#correctButton")).toBeDisabled();
  await expect(page.locator("#nextButton")).toBeDisabled();
  await expect(page.locator("#status")).toContainText("沒有啟用的字詞");
});

test("加權抽題與計時挑戰快照", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("wordflash_units_v1")) {
      localStorage.setItem("wordflash_units_v1", JSON.stringify({ current: "甲", units: { "甲": ["茶"], "乙": ["書"] } }));
      localStorage.setItem("wordflash_selected_units_v1", JSON.stringify(["甲", "乙"]));
      localStorage.setItem("wordflash_practice_mode_v1", "challenge");
      localStorage.setItem("wordflash_challenge_timer_v1", JSON.stringify({ enabled: true, durationSeconds: 10 }));
    }
  });
  await page.goto("/canvas_words.html");
  const weighted = await page.evaluate(async () => {
    const study = await import("/study-data.js");
    for (let i = 0; i < 3; i += 1) { study.recordWordAnswer("茶", false); study.recordWordAnswer("書", true); }
    const random = Math.random;
    Math.random = () => 0.55;
    const picked = study.chooseWeighted(["茶", "書"], "");
    Math.random = () => 0;
    const canRepeat = study.chooseWeighted(["茶", "書"], "茶");
    Math.random = random;
    return { picked, canRepeat, differentReading: study.wordKey("重|ㄔㄨㄥˊ") !== study.wordKey("重|ㄓㄨㄥˋ") };
  });
  // Even in weighted mode, an answered card must advance to a different
  // question whenever the selected libraries have another choice.
  expect(weighted).toEqual({ picked: "茶", canRepeat: "書", differentReading: true });
  await page.getByRole("button", { name: "開始 10 秒挑戰" }).click();
  const run = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_timed_challenge_run_v1")));
  expect(run.unitNames).toEqual(["甲", "乙"]);
  expect(run.words).toEqual(["茶", "書"]);
  const settingsPage = await page.context().newPage();
  await settingsPage.goto("/settings.html");
  await expect(settingsPage.locator("#practiceUnitChoices input").first()).toBeDisabled();
  await expect(settingsPage.locator('input[name="challengeSampling"][value="weighted"]')).toBeDisabled();
  const managePage = await page.context().newPage();
  await managePage.goto("/manage_words.html");
  await expect(managePage.locator(".study-word input").first()).toBeDisabled();
  await managePage.close();
  await settingsPage.close();
  await page.reload();
  await expect(page.locator("#unitSelect")).toBeDisabled();
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem("wordflash_timed_challenge_run_v1"));
    current.endsAtMs = Date.now() + 50;
    localStorage.setItem("wordflash_timed_challenge_run_v1", JSON.stringify(current));
  });
  await expect(page.locator("#status")).toContainText("時間到");
  await page.goto("/challenge_records.html");
  await expect(page.locator("#unitSelect option:checked")).toHaveText("混合：甲＋乙");
  await expect(page.locator("#challengeCount")).toHaveText("1");
});
