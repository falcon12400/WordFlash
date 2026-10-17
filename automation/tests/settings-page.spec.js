const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("各裝置：設定中心會套用工具列開關", async ({ page }, testInfo) => {
  await page.goto("/canvas_words.html");
  await page.evaluate(() => {
    localStorage.setItem("wordflash_units_v1", JSON.stringify({
      current: "第一字庫",
      units: {
        "第一字庫": ["郭"],
        "第二字庫": ["茶"]
      }
    }));
  });
  await page.goto("/settings.html");
  await expect(page.getByRole("heading", { name: "設定中心" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "設定分類" })).toBeVisible();
  await expect(page.locator("#quickUnitSelect")).toHaveValue("第一字庫");
  await expect(page.locator("#quickFontSelect")).toBeVisible();
  await page.locator("#quickUnitSelect").selectOption("第二字庫");
  await expect(page.locator("#googleSignIn")).toBeVisible();
  await expect(page.locator("#cloudStatus")).toContainText("尚未連線到雲端字庫");

  await page.locator('label[for="unitControlToggle"]').click();
  await expect(page.locator("#unitControlToggle")).not.toBeChecked();
  await page.goto("/canvas_words.html");
  await expect(page.locator("#unitControl")).toBeHidden();
  await expect(page.locator("#unitSelect")).toHaveValue("第二字庫");
  await expect(page.locator("#fontControl")).toBeVisible();

  const artifactDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.goto("/settings.html");
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-settings.png`),
    fullPage: false,
    scale: "device"
  });
  await page.locator("#cloud").scrollIntoViewIfNeeded();
  await expect(page.locator("#cloudTitle")).toBeVisible();
  await page.screenshot({
    path: path.join(artifactDir, `${testInfo.project.name}-settings-cloud.png`),
    fullPage: false,
    scale: "device"
  });
});
