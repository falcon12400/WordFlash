# WordFlash 開發與維護說明

本文件面向需要維護 WordFlash 的人。專案以靜態 HTML、原生 JavaScript 與 CSS 製作，沒有打包流程、框架或伺服器端程式。

## 專案原則

- 優先維持低複雜度：這是小型、功能已穩定的個人專案，不需要為了結構而全面改寫。
- 每次改動都以手機直式與 iPad 橫式為基本驗收目標。
- 字庫以使用者可閱讀、可手動修正的純文字格式保存。
- Firebase 只處理帳號與字庫；不要在沒有先設計同步規則前，直接把其他本機資料寫進雲端。

## 檔案與責任

| 檔案 | 主要責任 |
|---|---|
| `index.html` | 將網站根目錄導向 `canvas_words.html`。 |
| `canvas_words.html` | 顯示字卡、朗讀、字庫／字型切換、注音排版、練習模式、挑戰積木及登入按鈕。 |
| `manage_words.html` | 字庫 CRUD、自動查詢注音、多音字選擇與雲端字庫載入。 |
| `settings.html` | 快速切換、顯示偏好、練習偏好、資料清除、雲端上傳／下載與帳號管理。 |
| `firebase-wordflash.js` | Firebase 初始化、Google Auth、字庫正規化與 Realtime Database 讀寫。 |
| `database.rules.json` | Realtime Database 的使用者隔離規則。 |
| `firebase.json` | Firebase CLI 部署資料庫規則的設定。 |
| `automation/` | Playwright 測試、測試用靜態伺服器與截圖。 |

## 頁面與資料流

```text
瀏覽器 localStorage
 ├─ 字庫 ──────────────────────── canvas / manage / settings
 ├─ 顯示偏好、字型、注音開關 ─── canvas / settings
 └─ 練習模式與紀錄 ───────────── canvas / settings

Firebase Auth ──────────────── Google 帳號登入狀態
Firebase Realtime Database ── 該帳號的字庫備份
萌典 API ───────────────────── manage_words 的注音查詢
Web Speech API ────────────── canvas 的朗讀
```

### localStorage keys

| Key | 資料 | 使用頁面 |
|---|---|---|
| `wordflash_units_v1` | `{ current, units }` 字庫資料 | 三個主要頁面 |
| `wordflash_font_family` | CSS `font-family` 字串 | 顯示頁、設定頁 |
| `wordflash_zhuyin_enabled` | `"true"`／`"false"` | 顯示頁、設定頁 |
| `wordflash_display_preferences_v1` | 工具列／提示顯示偏好 | 顯示頁、設定頁 |
| `wordflash_practice_mode_v1` | `none`、`statistics`、`challenge` | 顯示頁、設定頁 |
| `wordflash_practice_session_v1` | 統計與挑戰進度 | 顯示頁、設定頁 |
| `wordflash_challenge_progress_display_v1` | `number`、`blocks`、`both` | 顯示頁、設定頁 |

字庫格式示例：

```json
{
  "current": "生活",
  "units": {
    "生活": ["茶|ㄔㄚˊ", "重新|ㄔㄨㄥˊ ㄒㄧㄣ", "for"]
  }
}
```

每個字庫項目都是一行文字；`|` 右側為手動指定的注音，中文字的音節以空白分隔。顯示頁會以中文字符數檢查音節數，數量不相符時不顯示注音，避免注音錯位。

### 練習資料

```json
{
  "statistics": { "correct": 12, "incorrect": 3 },
  "challenge": { "correct": 7 }
}
```

此資料目前只存在 localStorage，未寫入 Firebase。同一瀏覽器的不同分頁會經由 `storage` event 更新畫面。

## 注音與字卡顯示

### 注音查詢

`manage_words.html` 使用萌典公開端點：

```text
GET https://www.moedict.tw/a/{文字}.json
```

流程如下：

1. 查完整詞語，找到字數與注音音節數相符的結果時直接使用。
2. 查不到詞語時，逐一查詢中文字。
3. 所有字各只有一個讀音時，自動組合。
4. 某字有多個候選讀音時，不自動猜測；顯示選單等待使用者選擇。
5. 查詢失敗則保留原文字，讓使用者手動以 `文字|注音` 指定。

這不是完整的語意斷詞系統；即使詞語查到多筆合法讀音，目前也會採第一筆符合音節數的結果。修改這個流程時，應以「重新、很重、國王、王子」等詞做人工驗收。

### 注音排版

字卡使用原生 `<ruby>` 保存文字／注音語意，同時用獨立視覺層做右側直式注音，以避免各瀏覽器原生 ruby 排版差異。不要只改 `<rt>` 樣式；需在手機實機或 Playwright 截圖確認字與注音沒有重疊。

### 朗讀

顯示頁使用瀏覽器的 Web Speech API：

- 純英文字詞：`en-US`、速度 `0.9`。
- 其他含中文項目：`zh-TW`、速度 `0.85`。

語音清單由裝置提供，程式無法保證特定聲音一定存在。

## Firebase

### 服務與用途

| 服務 | 用途 |
|---|---|
| Firebase Authentication | Google 帳號登入、切換帳號、登出。 |
| Firebase Realtime Database | 保存每個帳號自己的字庫。 |

- Firebase 專案 ID：`wordflash-53976`
- 雲端路徑：`wordflashUsers/{uid}/library`
- 資料格式：字庫物件加上 `updatedAt` 與 `schemaVersion: 1`。
- Firebase Web SDK 從 Google CDN 載入，版本固定在 `12.13.0`。

前端 Firebase 設定存在 `firebase-wordflash.js`，這類 Web 公開設定可放在前端；真正的資料保護依賴 Realtime Database 規則，而不是隱藏設定值。

### 資料庫規則

`database.rules.json` 限制使用者只能讀取及寫入 `wordflashUsers/{自己的 uid}`。修改資料路徑時，必須一併更新規則並以 Firebase CLI 部署：

```powershell
firebase deploy --only database
```

### 目前同步行為與注意事項

- 未登入：字庫只存在本機。
- 在設定頁第一次上傳：把本機字庫寫到登入帳號的雲端路徑。
- 在字庫管理頁儲存：若已登入，會同步更新雲端字庫。
- 顯示頁與字庫管理頁偵測到登入帳號且雲端已有字庫時，會載入雲端字庫到本機。
- 設定頁的「下載雲端字庫」會先詢問，才以雲端版本取代本機版本。

目前不同入口的行為並非完全一致。尤其設定頁切換字庫時，登入狀態下會寫入雲端；日後若調整同步，應先在 `docs/MAINTENANCE_TODO.md` 決定覆蓋／合併規則，再修改程式。

## 響應式版面與挑戰積木

顯示頁對手機直式與平板橫式使用不同 CSS 規則。挑戰積木實際是無間距的「書背」方塊：程式讀取單一本積木的真實寬度，計算每列可容納數量，最多顯示三列，再用 `+N` 表示其餘數量。此計算避免連勝數較大時產生水平捲動。

修改相關 CSS 或積木尺寸後，必須檢查窄螢幕及長連勝數的畫面。

## 本機開發與測試

專案是靜態檔案，直接以瀏覽器開啟即可查看基本畫面；Google 登入與 ES module 匯入則建議使用 HTTP 伺服器。

Playwright 測試：

```powershell
cd D:\VSCode\WordFlash\automation
npm install
npm test
```

測試涵蓋：

- Pixel 10a 直式與 iPad 橫式。
- 顯示頁可開啟、主要按鈕存在、頁面沒有水平溢出。
- 統計模式、挑戰歸零、數字／積木顯示與大數量上限。
- 設定頁快速切換字庫、工具列開關與分組畫面。

截圖輸出於 `automation/artifacts/`，且已被 `.gitignore` 排除。這些是人工檢視素材，不是像素級視覺比對基準。

Google 登入與 Firebase 實體資料不適合以目前的匿名 Playwright 測試自動驗證；每次碰到登入或同步程式時，請手動檢查登入、切換帳號、上傳、下載各一次。

## 發布流程

GitHub Pages 會由 `main` 分支的靜態檔案更新網站；Git tag／GitHub Release 是版本紀錄，不會單獨部署網站。

建議流程：

1. 修改後在 `automation` 執行 `npm test`。
2. 用手機實機檢查有變動的頁面；若改同步功能，另測 Google 登入、上傳與下載。
3. 檢查 `git diff --check` 與 `git status`。
4. 提交並推送 `main`，確認 GitHub Pages 更新。
5. 要正式版時建立語意化 tag，例如 `v1.0.1`，再建立 GitHub Release 並寫明變更內容。

## 不建議現在做的事

- 不要僅為了抽象化而加入 React、建置工具或複雜狀態管理。
- 不要未經同步設計就把所有 localStorage key 自動上傳 Firebase。
- 不要把 Firebase 規則放寬為所有登入者可讀寫全部字庫。

若未來真的要改資料格式或新增跨裝置進度，才考慮抽出小型共用的狀態／常數檔，避免三個 HTML 頁面的 key、預設值與字型清單逐漸不同。
