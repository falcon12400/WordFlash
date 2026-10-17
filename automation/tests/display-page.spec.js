const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("Pixel 10a：顯示頁可用且輸出手機截圖", async ({ page }) => {
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

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(412);

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, "pixel-10a-display.png"),
    fullPage: false,
    scale: "device"
  });
});
