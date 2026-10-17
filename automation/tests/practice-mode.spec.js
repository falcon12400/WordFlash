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

  await page.goto("/settings.html");
  await expect(page.locator("#challengeDisplayOptions")).toBeVisible();
  await page.locator('label[for="challengeDisplayBlocks"]').click();
  await page.goto("/canvas_words.html");
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await expect(page.locator(".challenge-book")).toHaveCount(3);
  await expect(page.locator(".challenge-number")).toHaveCount(0);
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-challenge-blocks.png`),
    fullPage: false,
    scale: "device"
  });

  await page.evaluate(() => {
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 0, incorrect: 0 },
      challenge: { correct: 52 }
    }));
  });
  await page.reload();
  const visibleCapacity = Number(await page.locator(".challenge-pieces").getAttribute("data-visible-capacity"));
  await expect(page.locator(".challenge-book")).toHaveCount(Math.min(52, visibleCapacity));
  if (52 > visibleCapacity) {
    await expect(page.locator(".challenge-overflow")).toHaveText(`+${52 - visibleCapacity}`);
  }
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-challenge-capacity.png`),
    fullPage: false,
    scale: "device"
  });

  await page.goto("/settings.html");
  await page.locator('label[for="challengeDisplayBoth"]').click();
  await page.goto("/canvas_words.html");
  await expect(page.locator(".challenge-number")).toContainText("目前連續答對52");
  await expect(page.locator(".challenge-book")).toHaveCount(Math.min(52, visibleCapacity));

  await page.goto("/settings.html");
  await page.locator('label[for="challengeDisplayNumber"]').click();
  await page.goto("/canvas_words.html");
  await expect(page.locator(".challenge-number")).toContainText("目前連續答對52");
  await expect(page.locator(".challenge-book")).toHaveCount(0);
});
