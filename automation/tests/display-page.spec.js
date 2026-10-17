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

test("各裝置：注音切換不改變字級，挑戰模式不裁切字卡", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("wordflash_units_v1") === null) {
      localStorage.setItem("wordflash_units_v1", JSON.stringify({
        current: "注音版面測試",
        units: {
          "注音版面測試": ["茶|ㄔㄚˊ"]
        }
      }));
    }
    if (localStorage.getItem("wordflash_zhuyin_enabled") === null) {
      localStorage.setItem("wordflash_zhuyin_enabled", "true");
    }
    if (localStorage.getItem("wordflash_practice_mode_v1") === null) {
      localStorage.setItem("wordflash_practice_mode_v1", "none");
    }
  });

  await page.goto("/canvas_words.html");
  await expect(page.locator(".zhuyin-cell")).toHaveCount(1);
  const fontSizeWithZhuyin = await page.locator(".word-display").evaluate((element) => getComputedStyle(element).fontSize);

  await page.evaluate(() => {
    localStorage.setItem("wordflash_zhuyin_enabled", "false");
    localStorage.setItem("wordflash_practice_mode_v1", "challenge");
    localStorage.setItem("wordflash_challenge_progress_display_v1", "both");
    localStorage.setItem("wordflash_practice_session_v1", JSON.stringify({
      statistics: { correct: 0, incorrect: 0 },
      challenge: { correct: 52 }
    }));
  });
  await page.reload();

  await expect(page.locator(".zhuyin-cell")).toHaveCount(0);
  const layout = await page.evaluate(() => {
    const getRect = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    };
    return {
      fontSize: getComputedStyle(document.querySelector(".word-display")).fontSize,
      stage: getRect("#stage"),
      word: getRect(".word-display"),
      panel: getRect("#practicePanel"),
      pageWidth: document.documentElement.scrollWidth
    };
  });

  expect(layout.fontSize).toBe(fontSizeWithZhuyin);
  expect(layout.word.top).toBeGreaterThanOrEqual(layout.stage.top);
  expect(layout.word.bottom).toBeLessThanOrEqual(layout.stage.bottom);
  expect(layout.panel.top).toBeGreaterThanOrEqual(layout.stage.bottom);
  expect(layout.pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-zhuyin-challenge-layout.png`),
    fullPage: false,
    scale: "device"
  });

  await page.evaluate(() => {
    localStorage.setItem("wordflash_units_v1", JSON.stringify({
      current: "無注音版面測試",
      units: {
        "無注音版面測試": ["乙"]
      }
    }));
  });
  await page.reload();

  const unannotatedLayout = await page.evaluate(() => {
    const getRect = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    return { stage: getRect("#stage"), word: getRect(".word-display") };
  });
  expect(unannotatedLayout.word.top).toBeGreaterThanOrEqual(unannotatedLayout.stage.top);
  expect(unannotatedLayout.word.bottom).toBeLessThanOrEqual(unannotatedLayout.stage.bottom);
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-unannotated-challenge-layout.png`),
    fullPage: false,
    scale: "device"
  });
});
