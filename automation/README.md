# WordFlash 網頁自動化

這個子專案使用 Playwright 1.61 檢查本機 WordFlash 顯示頁，並輸出手機畫面截圖。它與 `D:\\VSCode\\visual-regression-tester` 的既有 Playwright 瀏覽器版本相容；共用工具保持通用，而 WordFlash 專屬測試留在此處。

## Pixel 10a

設定採用 Google 公開規格的 1080 × 2424 實體面板（20:9），在瀏覽器中以 412 × 923 CSS 像素、觸控模式與 2.625 倍螢幕密度模擬。

## 執行

```powershell
cd automation
npm run test:pixel-10a
```

成功後的截圖在 `automation/artifacts/pixel-10a-display.png`。測試會啟動本機伺服器，測試的是尚未發布的專案檔案，不會改動字庫或 GitHub Pages。

## iPad 橫向

```powershell
npm run test:ipad
```

成功後的截圖在 `automation/artifacts/ipad-landscape-display.png`。手機直式與 iPad 橫向使用不同的 CSS 版面規則。
