const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      // Pixel 10a: 1080 × 2424 physical pixels (20:9, 422.2 ppi).
      // Browser tests use the matching logical mobile viewport.
      name: "pixel-10a",
      use: {
        viewport: { width: 412, height: 923 },
        screen: { width: 412, height: 923 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (Linux; Android 16; Pixel 10a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
      }
    },
    {
      name: "ipad-landscape",
      use: {
        viewport: { width: 1180, height: 820 },
        screen: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      }
    }
  ],
  webServer: {
    command: "node static-server.js",
    cwd: ".",
    url: "http://127.0.0.1:4173/canvas_words.html",
    reuseExistingServer: !process.env.CI
  }
});
