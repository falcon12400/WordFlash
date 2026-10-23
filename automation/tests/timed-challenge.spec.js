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
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();

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
