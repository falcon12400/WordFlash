const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：設定中心會套用工具列開關", async ({ page }, testInfo) => {
  await page.goto("/settings.html");
  await expect(page.getByRole("heading", { name: "設定中心" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "設定分類" })).toBeVisible();

  await page.locator('label[for="unitControlToggle"]').click();
  await expect(page.locator("#unitControlToggle")).not.toBeChecked();
  await page.goto("/canvas_words.html");
  await expect(page.locator("#unitControl")).toBeHidden();
  await expect(page.locator("#fontControl")).toBeVisible();

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.goto("/settings.html");
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-settings.png`),
    fullPage: false,
    scale: "device"
  });
});
