const { test, expect } = require("@playwright/test");

// Speech must start on a finished tap: iOS Safari ignores speech started from
// a touch pointerdown, which made the first tap on the card silent.
const stubSpeech = (page) => page.addInitScript(() => {
  window.__spoken = [];
  window.speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
  window.speechSynthesis.cancel = () => {};
});

test("閃卡：第一次點卡片就朗讀，而且只念一次", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/canvas_words.html");
  await expect(page.locator("#stage .word-display")).toBeVisible();
  const box = await page.locator("#stage").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__spoken.length)).toBe(1);
});

test("注音練習：答對和答錯會播放音效", async ({ page }) => {
  test.skip(process.env.WORDFLASH_SITE !== "preview", "注音練習目前只在 preview 測試版");
  await page.addInitScript(() => {
    window.__tones = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() { window.__tones += 1; return super.createOscillator(); }
    };
    localStorage.setItem("wordflash_practice_mode_v1", "statistics");
  });
  await page.goto("/picture_quiz.html");
  await page.getByRole("button", { name: "載入「範例：生活圖卡」" }).click();
  await page.locator(".option").first().click();
  await expect.poll(() => page.evaluate(() => window.__tones)).toBeGreaterThan(0);
});
