const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：顯示頁可用且輸出截圖", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("wordflash_units_v1", JSON.stringify({
      current: "Pixel 10a 測試",
      units: {
        "Pixel 10a 測試": ["重新|ㄔㄨㄥˊ ㄒㄧㄣ"]
      }
    }));
  });

  await page.goto("/canvas_words.html");
  await expect(page.locator("#stage")).toBeVisible();
  await expect(page.locator("#nextButton")).toBeVisible();

  const layout = await page.locator(".flashcard-layout").evaluate((element) => ({
    display: getComputedStyle(element).display,
    columns: getComputedStyle(element).gridTemplateRows
  }));
  expect(layout.display).toBe("grid");

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-display.png`),
    fullPage: false,
    scale: "device"
  });
});
