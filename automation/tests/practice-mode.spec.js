const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：統計與挑戰模式會正確記錄答題", async ({ page }, testInfo) => {
  await page.goto("/settings.html");
  await page.locator('label[for="practiceStatistics"]').click();
  await page.goto("/canvas_words.html");

  await expect(page.locator("#practicePanel")).toBeVisible();
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await page.locator("#incorrectButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("答對2");
  await expect(page.locator("#practiceSummary")).toContainText("答錯1");
  await expect(page.locator("#practiceSummary")).toContainText("67%");
  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-statistics.png`),
    fullPage: false,
    scale: "device"
  });

  await page.goto("/settings.html");
  await page.locator('label[for="practiceChallenge"]').click();
  await page.goto("/canvas_words.html");
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("目前連續答對2");
  await page.locator("#incorrectButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("目前連續答對0");
});
