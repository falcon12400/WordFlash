# WordFlash

WordFlash 是給親子共讀與識字練習使用的繁體中文／英文閃卡網頁。它可顯示大字、播放讀音、提供可切換的注音提示，並支援字庫管理、練習／計時挑戰紀錄與 Google 雲端字庫。

- 線上網站：<https://falcon12400.github.io/WordFlash/>
- 正式版本：[v1.0.0](https://github.com/falcon12400/WordFlash/releases/tag/v1.0.0)
- 原始碼：<https://github.com/falcon12400/WordFlash>

## 文件入口

| 文件 | 適合對象 | 內容 |
|---|---|---|
| [使用說明](docs/USER_GUIDE.md) | 家長、陪讀者 | 字卡操作、字庫編輯、注音、多音字、練習／計時挑戰、挑戰紀錄與雲端字庫 |
| [開發與維護說明](docs/DEVELOPER_GUIDE.md) | 後續維護者 | 頁面架構、資料流、Firebase、外部 API、測試與發布流程 |
| [維護待辦](docs/MAINTENANCE_TODO.md) | 專案擁有者 | 已知限制、需要決定的事項、未來可做項目與發版檢查表 |
| [自動化測試說明](automation/README.md) | 維護者 | Pixel 10a 與 iPad 橫向的 Playwright 測試 |

## 主要頁面

- `canvas_words.html`：孩子使用的顯示頁；不放帳號按鈕，讓練習畫面保持單純。
- `manage_words.html`：編輯字庫、補注音與選擇多音字讀音。
- `settings.html`：快速切換字庫／字型、設定顯示、練習與計時挑戰、管理帳號與同步。
- `challenge_records.html`：依字庫查看及刪除計時挑戰紀錄。

## 目前的資料同步範圍

Google 登入後，可將字庫同步到 Firebase Realtime Database。多字庫選擇、單字啟用狀態和單字正確率，以及字型、注音開關、工具列設定、統計答題紀錄、不限時挑戰進度、計時挑戰的進行狀態與依字庫的挑戰紀錄，目前都只儲存在該裝置的瀏覽器中；換裝置後不會自動延續。

詳細操作請見[使用說明](docs/USER_GUIDE.md)，資料與同步機制請見[開發與維護說明](docs/DEVELOPER_GUIDE.md)。
