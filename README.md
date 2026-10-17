# WordFlash
WordFlash 是一個輕量的字卡練習網頁，支援多單元字庫與字型切換，適合中文或英文單字練習。

未登入時，字庫會保留在目前瀏覽器中；登入 Google 帳號後，可以把自己的字庫安全同步到 Firebase Realtime Database。

## 主要頁面

- `index.html`
  - 專案入口頁，會自動跳轉到 `canvas_words.html`

- `canvas_words.html`
  - 大字顯示頁
  - 用來給小朋友練習看字、翻字卡、切換字庫與字型
  - 支援純練習、統計、挑戰三種模式

- `manage_words.html`
  - 字庫管理頁
  - 用來編輯或整理字庫內容；儲存時會自動查詢未標註項目的注音

- `settings.html`
  - 設定頁
  - 可開啟或關閉字卡注音與工具列控制項
  - 可選擇純練習、統計或挑戰模式，並清除目前模式的紀錄
  - 可使用 Google 登入、上傳此裝置字庫，或下載自己的雲端字庫

## 練習模式

- 純練習：只顯示字卡與既有工具，不紀錄結果。
- 統計模式：由陪讀者按「答對／答錯」，累積答對、答錯與正確率。
- 挑戰模式：記錄目前連續答對數；答錯時歸零重新計算。
  - 可在設定頁選擇以數字、積木，或數字＋積木顯示進度；積木採無間隙的直立書背／骨牌排列，會依裝置寬度自動計算每列數量，最多顯示三列後以文字補上其餘題數。

## 線上網址

- GitHub Pages：`https://falcon12400.github.io/WordFlash/`
- 顯示頁：`https://falcon12400.github.io/WordFlash/canvas_words.html`
- 管理頁：`https://falcon12400.github.io/WordFlash/manage_words.html`

## 本機位置

- `D:\VSCode\WordFlash`

## Firebase 字庫同步

- Firebase 專案：`wordflash-53976`
- 登入方式：Google
- 雲端資料路徑：`wordflashUsers/{uid}/library`
- 使用者只能讀寫自己的 `{uid}` 節點；規則保存在 `database.rules.json`。
- 第一次使用時，請到設定頁使用 Google 登入，再按「上傳此裝置字庫」。之後在字庫管理頁儲存內容，會自動同步。

## 維護提示

- 如果要改畫面顯示或練習互動，先看 `canvas_words.html`
- 如果要改字庫管理或自動注音查詢流程，先看 `manage_words.html`
- 如果要改注音提示的顯示設定，先看 `settings.html` 與 `canvas_words.html`
- 這個專案目前是純 HTML 檔案，不是 React / Vite 專案
