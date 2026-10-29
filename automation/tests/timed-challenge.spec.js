const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：計時挑戰會鎖定字庫並依字庫保存一次紀錄", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("wordflash_units_v1")) {
      localStorage.setItem("wordflash_units_v1", JSON.stringify({
        current: "第一字庫",
        units: {
          "第一字庫": ["茶"],
          "第二字庫": ["郭"]
        }
      }));
    }
    if (!localStorage.getItem("wordflash_practice_mode_v1")) {
      localStorage.setItem("wordflash_practice_mode_v1", "challenge");
    }
    if (!localStorage.getItem("wordflash_challenge_timer_v1")) {
      localStorage.setItem("wordflash_challenge_timer_v1", JSON.stringify({ enabled: false, durationSeconds: 60 }));
    }
  });

  await page.goto("/settings.html#practice");
  await expect(page.locator("#challengeTimerOptions")).toBeVisible();
  await page.locator('label[for="challengeTimerEnabled"]').click();
  await expect(page.locator("#challengeTimerEnabled")).toBeChecked();
  await page.locator("#challengeDurationSeconds").fill("10");
  await page.locator("#challengeDurationSeconds").blur();

  await page.goto("/canvas_words.html");
  await expect(page.locator("#googleSignIn")).toHaveCount(0);
  await expect(page.locator("#googleSignOut")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "開始 10 秒挑戰" })).toBeVisible();
  await expect(page.locator("#correctButton")).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(testInfo.project.use.viewport.width);

  await page.getByRole("button", { name: "開始 10 秒挑戰" }).click();
  await expect(page.locator("#correctButton")).toBeEnabled();
  await expect(page.locator("#unitSelect")).toBeDisabled();
  // Use the touch path used by iPad and Android. Each tap must register once
  // even while the countdown is refreshing its visible time.
  await page.locator("#correctButton").tap();
  await page.locator("#correctButton").tap();

  const timedPageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(timedPageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);

  const settingsPage = await page.context().newPage();
  await settingsPage.goto("/settings.html");
  await expect(settingsPage.locator("#quickUnitSelect")).toBeDisabled();
  await expect(settingsPage.locator("#practiceChallenge")).toBeDisabled();
  await expect(settingsPage.locator("#challengeTimerEnabled")).toBeDisabled();
  await settingsPage.goto("/settings.html#practice");
  await expect(settingsPage.locator("#practiceStatus")).toContainText("本輪目前連續答對 2 題");
  await settingsPage.close();

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-timed-challenge.png`),
    fullPage: false,
    scale: "device"
  });

  await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem("wordflash_timed_challenge_run_v1"));
    run.endsAtMs = Date.now() + 50;
    localStorage.setItem("wordflash_timed_challenge_run_v1", JSON.stringify(run));
  });
  await expect(page.locator("#status")).toContainText("時間到");
  let records = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_challenge_records_v1")));
  expect(records.units["第一字庫"]).toHaveLength(1);
  expect(records.units["第一字庫"][0]).toMatchObject({ correct: 2, durationSeconds: 10, reason: "time_up" });

  await page.reload();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_challenge_records_v1")));
  expect(records.units["第一字庫"]).toHaveLength(1);

  await page.locator("#unitSelect").selectOption("第二字庫");
  await page.getByRole("button", { name: "開始 10 秒挑戰" }).click();
  await page.locator("#correctButton").click();
  await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem("wordflash_timed_challenge_run_v1"));
    run.endsAtMs = Date.now() + 50;
    localStorage.setItem("wordflash_timed_challenge_run_v1", JSON.stringify(run));
  });
  await expect(page.locator("#status")).toContainText("時間到");

  await page.goto("/challenge_records.html");
  await expect(page.getByRole("heading", { name: "挑戰紀錄" })).toBeVisible();
  await expect(page.locator("#unitSelect option")).toHaveCount(2);
  await expect(page.locator("#challengeCount")).toHaveText("1");
  await page.locator("#unitSelect").selectOption("第二字庫");
  await expect(page.locator("#challengeCount")).toHaveText("1");
  await expect(page.locator("#bestCorrect")).toHaveText("1 題");

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-challenge-records.png`),
    fullPage: false,
    scale: "device"
  });
});

test("統計模式也能使用倒數，並持續累積答題統計", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("wordflash_units_v1")) {
      localStorage.setItem("wordflash_units_v1", JSON.stringify({
        current: "統計字庫",
        units: { "統計字庫": ["茶", "書"] }
      }));
    }
    if (!localStorage.getItem("wordflash_practice_mode_v1")) {
      localStorage.setItem("wordflash_practice_mode_v1", "statistics");
    }
    if (!localStorage.getItem("wordflash_challenge_timer_v1")) {
      localStorage.setItem("wordflash_challenge_timer_v1", JSON.stringify({ enabled: false, durationSeconds: 10 }));
    }
  });

  await page.goto("/settings.html#practice");
  await expect(page.locator("#challengeTimerOptions")).toBeVisible();
  await page.locator('label[for="challengeTimerEnabled"]').click();
  await expect(page.locator("#challengeTimerEnabled")).toBeChecked();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("wordflash_challenge_timer_v1"))).toContain('"enabled":true');
  await page.goto("/canvas_words.html");
  await expect(page.getByRole("button", { name: "開始 10 秒統計" })).toBeVisible();
  await expect(page.locator("#correctButton")).toBeDisabled();

  await page.getByRole("button", { name: "開始 10 秒統計" }).click();
  await expect(page.locator("#correctButton")).toBeEnabled();
  await expect(page.locator("#practiceSummary")).toContainText("答對0");
  await expect(page.locator("#practiceSummary")).toContainText("答錯0");
  await page.locator("#correctButton").click();
  await page.locator("#incorrectButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("答對");
  await expect(page.locator("#practiceSummary")).toContainText("答錯");
  await expect(page.locator("#practiceSummary")).toContainText("50.0%");

  await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem("wordflash_timed_challenge_run_v1"));
    run.endsAtMs = Date.now() + 50;
    localStorage.setItem("wordflash_timed_challenge_run_v1", JSON.stringify(run));
  });
  await expect(page.locator("#status")).toContainText("本輪答對 1 題、答錯 1 題");
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_challenge_records_v1") || '{"units":{}}'));
  expect(records.units["統計字庫"]).toHaveLength(1);
  expect(records.units["統計字庫"][0]).toMatchObject({
    mode: "statistics", correct: 1, incorrect: 1, accuracy: 50, reason: "time_up"
  });
  await page.goto("/challenge_records.html");
  await expect(page.locator("#recordsContent")).toContainText("倒數統計");
  await expect(page.locator("#recordsContent")).toContainText("答對 1／錯 1・50.0%");
});

test("倒數可手動結束，並保留本輪與單字紀錄", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("wordflash_units_v1", JSON.stringify({
      current: "測試字庫",
      units: { "測試字庫": ["茶"] }
    }));
    localStorage.setItem("wordflash_practice_mode_v1", "challenge");
    localStorage.setItem("wordflash_challenge_timer_v1", JSON.stringify({ enabled: true, durationSeconds: 60 }));
  });
  await page.goto("/canvas_words.html");
  await page.getByRole("button", { name: "開始 60 秒挑戰" }).click();
  await page.locator("#correctButton").click();
  await page.getByRole("button", { name: "結束本輪" }).click();
  await expect(page.locator("#status")).toContainText("已結束本輪");
  const saved = await page.evaluate(() => ({
    records: JSON.parse(localStorage.getItem("wordflash_challenge_records_v1")),
    words: JSON.parse(localStorage.getItem("wordflash_word_stats_v1"))
  }));
  expect(saved.records.units["測試字庫"][0]).toMatchObject({ reason: "manual_stop", correct: 1, totalCorrect: 1 });
  expect(saved.words[JSON.stringify(["茶", ""])]).toEqual({ correct: 1, incorrect: 0 });
});
