# 看圖選注音 — 規劃

- 建立：2026-11-08，Claude「WordFlash 閃卡維護」與 Codex「維護中文字閃卡程式」共同規劃。
- 狀態：**方案已核可（2026-11-08），實作中**。
- 本文件是這個功能的唯一規劃來源。之後的決定與進度都更新在這裡，不只留在對話裡。

## 需求（專案擁有者 2026-11-08）

- 新的練習：顯示一張圖片，孩子從選項中選出**整個詞的注音**。
- 題目、圖片與選項都**事先準備好，再上傳到系統**，網頁不會自己產生。由專案擁有者或 agent 上傳都可以，上傳介面可以不同，資料是同一份。
- 不自動產生錯誤選項、不用萌典查詢、**不朗讀**。
- 每題最多 4 個選項，也可能只有 2 個；正確答案由資料指定。
- **共用現有機制**：可以查看某一題的正確率、計時統計正確率、計時挑戰疊積木／書架；只是題目從閃卡換成選注音。
- 答題後，由孩子**自己按「下一題」**。
- 圖片暫時放在 **Firebase**，使用登入帳號的私有路徑。

## 為什麼不直接放進 `canvas_words.html`

現有的計分入口 `recordAnswer()` 看起來可以共用，但查證後發現它不能直接接上圖片題：

- `currentText`、`wordList`、`remaining`、`showNext()`、`parseEntry()` 都假設題目是 `文字|注音` 字串。
- `recordAnswer()` 在純練習模式會直接返回；最後會呼叫 `study.recordWordAnswer(currentText)`，然後自動 `showNext()`。圖片題的紀錄會混進單字正確率，也和「自己按下一題」的流程衝突。
- `startTimedChallenge()` 只快照 `selectedUnits` 與 `wordList`；`challenge_records.html` 依一般字庫名稱分組。圖片題組不在其中。
- 點 `stage` 會觸發朗讀（pointerdown），把選項放進去會有事件冒泡和 iPad 觸控風險。
- 每次答題後，`saveUnits()` 會把整份字庫覆寫到雲端。

## 方案

**獨立頁面 `picture_quiz.html`，另外從 `canvas_words.html` 抽出小型的共用練習核心。** 兩頁共用同一套計時、統計、連勝與書架；文字閃卡頁不必累積大量例外分支。

### 共用模組

| 模組 | 內容 | 必要程度 |
|---|---|---|
| `practice-runtime.js` | 練習模式、統計、計時輪次、連勝與完成紀錄。介面暫定：`startRun({activity, source, questionIds, mode, durationSeconds})`、`recordAttempt(run, {correct})`、`finishRun(run, reason)`；`activity` 為 `flashcard` 或 `picture-quiz` | 必要 |
| 題目統計（擴充 `study-data.js` 或新增 `question-progress.js`） | `questionKey({activity, id})`、`recordQuestionAnswer()`。保持 `wordKey()`／`wordStats()` 相容；圖片題以固定 ID 記錄，不和同詞的文字閃卡混算 | 必要 |
| `answer-input.js` | 從 `answerWithTouchSupport()` 抽出 iPad 觸控去重，圖片選項也使用 | 必要 |
| `challenge-progress.js` | `createChallengeProgress()` 與書架容量計算 | 建議 |
| `picture-questions.js` | 題組、題目、圖片的 IndexedDB 快取、匯入包驗證、雲端讀寫 | 必要（新寫） |

計分和換題要拆開：

- `recordAttempt` 只負責第一次答題的計分、單題統計、計時或連勝、書架更新；
- `showNext` 只負責換題。

文字閃卡維持「計分後自動換題」。圖片題的流程如下：

- 第一次選擇後立即顯示對錯與正解，並鎖住選項；
- 「下一題」只換題、不計分，以 `answeredQuestionId` 防止重複計分；
- 時間到時鎖住選項與「下一題」，直接結束本輪。

### 暫時不動

- 萌典查詢、多音字、直式注音、朗讀。
- `library_manager.html`、複合字庫、`settings.html` 的一般字庫選擇。
- 既有的 `wordStats`、停用字詞、加權抽題。

第一階段不和文字字庫混在同一輪出題。

### 資料

每題包含：`id`（固定、不重複使用）、圖片、`options`（2–4 個）、`answer`（正解，必須在 options 裡），以及選填的 `word`（答完後顯示用）。

Firebase Realtime Database 的獨立路徑（現有規則已允許，不必修改）：

- `wordflashUsers/{uid}/pictureSets/{setId}`：名稱、資料夾、更新時間。
- `wordflashUsers/{uid}/pictureCards/{cardId}`：選項、正解、所屬題組、圖片版本、更新時間。
- `wordflashUsers/{uid}/pictureImages/{cardId}`：壓縮後的圖片（約 512px JPEG）。清單只讀 metadata，出題時才讀這裡。

規則：

- **不可**放進 `/library`，也不可經過 `saveCloudUnits()`：那條路徑會整包覆寫，而且會丟掉它不認得的欄位。
- 刪除時保留 `deletedAt` 標記，避免多裝置同步後刪掉的題目又出現。
- IndexedDB 只當快取，不是唯一的保存位置。

不用 Firebase Storage，因為新的 bucket 需要 Blaze 付費方案（見 [Firebase 說明](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)）。

### 上傳

- 專案擁有者：在管理頁用表單逐題上傳。
- agent：產生「匯入包」（一份 JSON 加上圖片資料夾），由專案擁有者登入後在管理頁匯入。agent 不需要 Firebase 帳密。

## 分工與順序

專案擁有者決定（2026-11-08）：**由 Claude 修改與維護程式，Codex 負責檢查**（程式審查、測試結果與截圖複核）。有版本控管，出問題可以回復。

1. Claude：純重構，抽出 `practice-runtime.js`、`answer-input.js`（以及視情況抽 `challenge-progress.js`）。`canvas_words.html` 行為不變，Playwright 測試全部通過 → 請 Codex 檢查。
2. Claude：本機版 MVP，包括 `picture_quiz.html`、`picture-questions.js`、匯入包格式與驗證、Pixel 直式與 iPad 橫式測試 → 請 Codex 檢查。
3. Claude：Firebase 雲端路徑與同步 → 請 Codex 檢查。
4. Claude：整合字庫樹、`settings.html`、`challenge_records.html` → 請 Codex 檢查。

共同規則：

- Codex 檢查時只讀、不改檔案；發現問題寫到收件匣或回覆給 Claude。
- 每一步都分開提交，方便回復。
- 推送、發布到 GitHub Pages 前，先取得專案擁有者同意。

### 畫面

- 選項上的注音採**直式**（和課本、閃卡頁一致），重用閃卡頁的直式注音呈現方式。

## 進度

- 2026-11-08 試做版（測試版 `preview/picture_quiz.html`、`preview/picture_sets.html`）：
  - 新模組：`practice-runtime.js`、`practice-ui.js`／`practice-ui.css`、`question-progress.js`、`answer-input.js`、`bopomofo.js`、`picture-questions.js`；範例題組 `picture-sample.json`（8 題、2–4 個選項）。
  - 為了先讓擁有者看到效果，順序和原計畫不同：先做圖片題頁面與新的共用模組，閃卡頁（`canvas_words.html`）**尚未**改用這些模組，也沒有被修改。之後再讓閃卡頁改用共用模組。
  - 練習模式、計時開關、書架顯示沿用設定頁的同一組設定；圖片題的連勝、本輪狀態與挑戰紀錄另外存放（`:picture-quiz` 結尾的 localStorage key），不會動到閃卡的紀錄。
  - 題組只存在這台裝置的 IndexedDB，雲端同步還沒做。
  - 測試：`WORDFLASH_SITE=preview npx playwright test`：59 項通過、1 項略過（新增 8 項圖片題測試）；正式版 51 項通過。

- 2026-11-08 依 Codex 審查修正：
  - 重新匯入時只保留新檔案的題目；
  - IndexedDB 交易改為同步排入請求（避免 Safari 交易失效）；
  - 時間剛到時第一次點選立即結算；
  - 匯入時檢查選項是否為注音，並設檔案大小上限；
  - 手機上三個多音節選項改排兩欄；
  - 練習模式被切成「純練習」時結束進行中的一輪。
  - 測試：preview 67 項通過。
  - 尚待決定：計時統計的答題是否也算進長期統計（目前和閃卡頁相同：會算進去）。
  - 尚待驗證：實體 iPad Safari 的觸控與注音字型。

- 2026-11-08 新增內建題組「翰林首冊：易混注音」：
  - 詞與圖片來源由 Codex 整理（`content/picture-quiz/hanlin-grade1-primer/confusable-zhuyin/`），Claude 下載 OpenMoji 圖片並擬好錯誤選項，做成 `picture-set.json`。
  - 匯入包可加 `set.credit`（圖片授權署名）。
  - 範例題組移到 `preview/picture-sets/`；題組管理頁新增「內建題組」區。

- 2026-11-08 練習紀錄（使用者要求「每次紀錄單獨分開，避免覆蓋」）：
  - `practice-log.js`、`picture-logs.js`、`practice_logs.html`。
  - 每一輪一筆，有自己的代號。計時的一輪就是一筆；不計時時，換題組、換模式或 15 分鐘沒答題就算新的一輪。
  - 內容：題組、模式、裝置、時間、題數、答對、答錯、答錯的字（含孩子選了什麼）、每次作答。
  - 登入 Google 的裝置會自動上傳到 `wordflashUsers/{uid}/practiceLogs/{id}`。每筆寫在自己的路徑，不會互相覆蓋，也不經過 `/library`。
  - 分輪記錄以前的資料，會一次轉成「舊紀錄」：計時輪的題數，以及每題累計的答對、答錯。
  - 修正：從設定頁按「返回」時（瀏覽器直接顯示舊畫面），注音練習頁會重新讀取練習模式。

- 2026-11-08 合併兩個翰林題組為「翰林首冊」（17 題，`content/picture-quiz/hanlin-grade1-primer/merged/`）：
  - 每題標課次，由 Codex 核對：詞本身在課文裡就標課次，否則標「延伸練習」；能對應到某課的加註課次。
  - 題組管理頁依課次分組，每課有「這課全出／這課不出」。
  - 匯入包新增 `lesson`、`lessonNote`、`previousIds`、`set.replaces`：舊題組的答題紀錄和勾選會接到新題目，舊題組自動移除。
  - 依 Codex 審查：不計時的一輪結束（換題組或換模式）也會立刻上傳。

- 2026-11-08 複習頁與紀錄同步：
  - `picture_review.html`：只列開啟出題的題目，顯示照片、字和直式正確注音。依正確率排序（使用者要求以正確率表示）：正確率低的在前，正確率相同時答錯次數多的在前，沒練過的排最後。正確率 50% 以下的卡片加紅框。入口在練習頁題組選單旁的「複習」，以及題組管理頁的「複習這個題組」。
  - 自動同步：答題時最多每 20 秒上傳一次；每次打開頁面（或登入時）依紀錄代號核對裝置和雲端，雲端缺的補傳、裝置缺的下載，畫面只顯示一行結果。
  - 練習紀錄頁：可以「全部上傳」「下載帳號裡的全部紀錄」「匯出 CSV」。下載時，本機還沒上傳的紀錄不會被雲端的版本蓋掉。
  - 正確率目前用這台裝置的單題統計，不含其他裝置下載來的紀錄。
  - 依 Codex 審查（2026-11-11）：
    - 取消本機只保留 300 筆的上限，「下載全部」會真的全部保留；
    - CSV 儲存格開頭是 = + - @ 時加上單引號，避免被當成公式；
    - 每個測試開始前清空題組資料庫，避免測試互相干擾。
  - **暫行做法**：開頁核對時會讀整個 practiceLogs（含每次作答），資料量會隨使用時間增加。之後應改成另存一份小索引（只有 id 和時間），核對時只讀索引、缺什麼再下載。

- 2026-11-11 不登入也能傳紀錄（使用者的 iPad 無法登入 Firebase）：
  - 練習紀錄頁加「傳出紀錄」：iPad／iPhone 會開分享選單（AirDrop、LINE），其他裝置則下載 JSON 檔。
  - 「匯入紀錄檔」：在已登入的裝置匯入後，紀錄排入上傳。紀錄代號保留，重複匯入也不會多出資料。
  - 待查：iPad 無法登入的原因。推測是 `signInWithPopup` 在 iOS Safari 跨網域（github.io 對上 firebaseapp.com）時被瀏覽器的隱私保護擋下。

## 未來可考慮（未決定）

- 一個帳號多位使用者（例如爸爸和孩子）：圖片題素材共用，答題紀錄依使用者分開。
- 答完約 3 秒內可以撤銷誤觸；大人長按圖片才顯示答案；預先載入下一張圖。
- 依熟練度調整選項數。

## 決定紀錄

| 日期 | 決定 | 來源 |
|---|---|---|
| 2026-11-08 | 題目事先準備並上傳，不自動產生；不朗讀；2–4 個選項；共用現有統計、計時與挑戰 | 專案擁有者 |
| 2026-11-08 | 答題後由孩子自己按「下一題」 | 專案擁有者 |
| 2026-11-08 | 圖片暫時放 Firebase 的私有路徑 | 專案擁有者 |
| 2026-11-08 | 獨立頁面＋抽出共用練習核心（Codex 提議，Claude 同意） | 專案擁有者核可 |
| 2026-11-08 | Claude 實作與維護，Codex 檢查 | 專案擁有者 |
| 2026-11-08 | 選項注音採直式 | 專案擁有者 |
| 2026-11-08 | 圖片題的紀錄以每題的代號（id）計算，不以單字計算，和閃卡的單字正確率分開 | 專案擁有者 |
| 2026-11-08 | 畫面上的名稱叫「注音練習」；正式版閃卡頁加「注音練習」按鈕，連到測試版的遊戲頁 | 專案擁有者 |
| 2026-11-08 | 先在測試版 `preview/`（/WordFlash/preview/）開發與試用，正式版不動；測好再搬回正式版 | 專案擁有者 |
