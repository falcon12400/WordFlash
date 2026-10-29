const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：統計與挑戰模式會正確記錄答題", async ({ page }, testInfo) => {
  await page.goto("/settings.html#practice");
  await page.locator('label[for="practiceStatistics"]').click();
  await page.goto("/canvas_words.html");

  await expect(page.locator("#practicePanel")).toBeVisible();
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await page.locator("#incorrectButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("答對2");
  await expect(page.locator("#practiceSummary")).toContainText("答錯1");
  await expect(page.locator("#practiceSummary")).toContainText("66.7%");
  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-statistics.png`),
    fullPage: false,
    scale: "device"
  });

  await page.goto("/settings.html#practice");
  await page.locator('label[for="practiceChallenge"]').click();
  await page.goto("/canvas_words.html");
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("目前連續答對2");
  await page.locator("#incorrectButton").click();
  await expect(page.locator("#practiceSummary")).toContainText("目前連續答對0");

  await page.goto("/settings.html#practice");
  await expect(page.locator("#challengeDisplayOptions")).toBeVisible();
  await page.locator('label[for="challengeDisplayBlocks"]').click();
  await page.goto("/canvas_words.html");
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await page.locator("#correctButton").click();
  await expect(page.locator(".challenge-book")).toHaveCount(3);
  await expect(page.locator(".challenge-number")).toHaveCount(0);
  const normalVisibleCapacity = Number(await page.locator(".challenge-pieces").getAttribute("data-normal-visible-capacity"));
  await expect(page.locator(".challenge-pieces")).toHaveAttribute("data-mode", "normal");
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-challenge-blocks.png`),
    fullPage: false,
    scale: "device"
  });

  await page.evaluate((correct) => {
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 0, incorrect: 0 },
      challenge: { correct }
    }));
  }, normalVisibleCapacity);
  await page.reload();
  await expect(page.locator(".challenge-pieces")).toHaveAttribute("data-mode", "normal");
  await expect(page.locator(".challenge-book")).toHaveCount(normalVisibleCapacity);

  await page.evaluate((correct) => {
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 0, incorrect: 0 },
      challenge: { correct }
    }));
  }, normalVisibleCapacity + 1);
  await page.reload();
  await expect(page.locator(".challenge-pieces")).toHaveAttribute("data-mode", "compact");
  await expect(page.locator(".challenge-book")).toHaveCount(normalVisibleCapacity + 1);

  await page.evaluate(() => {
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 0, incorrect: 0 },
      challenge: { correct: 1000 }
    }));
  });
  await page.reload();
  const compactVisibleCapacity = Number(await page.locator(".challenge-pieces").getAttribute("data-visible-capacity"));
  await expect(page.locator(".challenge-pieces")).toHaveAttribute("data-mode", "compact");
  expect(compactVisibleCapacity).toBeGreaterThanOrEqual(normalVisibleCapacity * 3.5);
  await expect(page.locator(".challenge-piece-row")).toHaveCount(3);
  await expect(page.locator(".challenge-book")).toHaveCount(compactVisibleCapacity);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  await expect(page.locator(".challenge-overflow")).toHaveText(`+${1000 - compactVisibleCapacity}`);
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-challenge-capacity.png`),
    fullPage: false,
    scale: "device"
  });

  await page.goto("/settings.html#practice");
  await page.locator('label[for="challengeDisplayBoth"]').click();
  await page.goto("/canvas_words.html");
  await expect(page.locator(".challenge-number")).toContainText("目前連續答對1000");
  await expect(page.locator(".challenge-book")).toHaveCount(compactVisibleCapacity);

  await page.goto("/settings.html#practice");
  await page.locator('label[for="challengeDisplayNumber"]').click();
  await page.goto("/canvas_words.html");
  await expect(page.locator(".challenge-number")).toContainText("目前連續答對1000");
  await expect(page.locator(".challenge-book")).toHaveCount(0);
});

test("統計模式的正確率保留一位小數", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("wordflash_practice_mode_v1", "statistics");
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 60, incorrect: 2 },
      challenge: { correct: 0 }
    }));
  });
  await page.goto("/canvas_words.html");
  await expect(page.locator("#practiceSummary")).toContainText("96.8%");
});
