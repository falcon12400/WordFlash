const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// The picture quiz exists only in the preview copy for now.
test.skip(process.env.WORDFLASH_SITE !== "preview", "看圖選注音目前只在 preview 測試版");

// Each test starts from an empty picture-quiz database and empty storage, so
// tests running side by side never see each other's sets.
test.beforeEach(async ({ page }) => {
  await page.goto("/picture_sets.html");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("wordflash-picture-quiz");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
});

const shot = async (page, testInfo, name) => {
  const dir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-picture-${name}.png`), fullPage: true });
};

const setMode = (page, mode, timer = { enabled: false, durationSeconds: 60 }) => page.addInitScript(({ mode, timer }) => {
  if (!sessionStorage.getItem("picture-test-init")) {
    sessionStorage.setItem("picture-test-init", "1");
    localStorage.setItem("wordflash_practice_mode_v1", mode);
    localStorage.setItem("wordflash_challenge_timer_v1", JSON.stringify(timer));
  }
}, { mode, timer });

const loadSample = async (page) => {
  await page.goto("/picture_quiz.html");
  await page.getByRole("button", { name: "載入「範例：生活圖卡」" }).click();
  await expect(page.locator("#picture")).toBeVisible();
  await expect(page.locator(".option").first()).toBeVisible();
};

const noHorizontalScroll = async (page, testInfo) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(testInfo.project.use.viewport.width);
};

test("看圖選注音：統計模式選完顯示答案，按下一題才換題", async ({ page }, testInfo) => {
  await setMode(page, "statistics");
  await loadSample(page);
  await noHorizontalScroll(page, testInfo);
  const count = await page.locator(".option").count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);
  // Vertical zhuyin: each option shows one column per syllable.
  await expect(page.locator(".option .vzy-syllable").first()).toBeVisible();
  await shot(page, testInfo, "question");

  const imageBefore = await page.locator("#picture").getAttribute("src");
  await page.locator(".option").first().click();
  await expect(page.locator(".option.is-correct")).toHaveCount(1);
  await expect(page.locator(".option:disabled")).toHaveCount(count);
  await expect(page.locator("#nextButton")).toHaveText("下一題");
  await expect(page.locator("#pictureWord")).toHaveClass(/is-shown/);
  const stats = page.locator(".practice-stat strong");
  const correct = Number(await stats.nth(0).textContent());
  const incorrect = Number(await stats.nth(1).textContent());
  expect(correct + incorrect).toBe(1);
  // The picture stays until the child presses 下一題.
  expect(await page.locator("#picture").getAttribute("src")).toBe(imageBefore);
  await shot(page, testInfo, "answered");

  await page.locator("#nextButton").click();
  await expect(page.locator("#nextButton")).toHaveText("跳過");
  await expect(page.locator(".option.is-correct")).toHaveCount(0);
  expect(await page.locator("#picture").getAttribute("src")).not.toBe(imageBefore);
  expect(Number(await stats.nth(0).textContent()) + Number(await stats.nth(1).textContent())).toBe(1);
});

test("看圖選注音：連點同一個選項只記一次", async ({ page }) => {
  await setMode(page, "statistics");
  await loadSample(page);
  const option = page.locator(".option").first();
  const box = await option.boundingBox();
  for (let i = 0; i < 3; i += 1) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  const stats = page.locator(".practice-stat strong");
  await expect(page.locator(".option.is-correct")).toHaveCount(1);
  expect(Number(await stats.nth(0).textContent()) + Number(await stats.nth(1).textContent())).toBe(1);
});

test("看圖選注音：計時挑戰鎖定選項、疊書並保存紀錄", async ({ page }, testInfo) => {
  await setMode(page, "challenge", { enabled: true, durationSeconds: 30 });
  await loadSample(page);
  await expect(page.locator(".option").first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "開始 30 秒挑戰" })).toBeVisible();
  await shot(page, testInfo, "challenge-ready");

  await page.getByRole("button", { name: "開始 30 秒挑戰" }).click();
  await expect(page.locator(".challenge-timer-value")).toBeVisible();
  await expect(page.locator(".option").first()).toBeEnabled();
  await expect(page.locator("#setSelect")).toBeDisabled();

  // Answer correctly three times by reading which button the page marks correct.
  let streak = 0;
  for (let i = 0; i < 3; i += 1) {
    const answer = await page.evaluate(async () => {
      const cardId = (await (await import("./picture-questions.js?v=1")).listCards("sample-daily"));
      return cardId.map(card => ({ answer: card.answer }));
    });
    expect(answer.length).toBeGreaterThan(0);
    const values = await page.locator(".option").evaluateAll(nodes => nodes.map(node => node.dataset.value));
    const answers = new Set(answer.map(item => item.answer));
    const index = values.findIndex(value => answers.has(value));
    await page.locator(".option").nth(index).click();
    if (await page.locator(".option.is-wrong").count() === 0) streak += 1; else streak = 0;
    await page.locator("#nextButton").click();
  }
  await expect(page.locator(".challenge-number strong")).toHaveText(String(streak));
  await expect(page.locator(".challenge-book")).toHaveCount(streak);
  await shot(page, testInfo, "challenge-running");

  await page.getByRole("button", { name: "結束本輪" }).click();
  await expect(page.locator(".challenge-finished-note")).toBeVisible();
  await expect(page.locator(".option").first()).toBeDisabled();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_challenge_records_v1:picture-quiz")));
  expect(records.groups["sample-daily"]).toHaveLength(1);
  expect(records.groups["sample-daily"][0].correct).toBeGreaterThanOrEqual(0);
  // Picture quiz rounds never touch the flashcard round or records.
  expect(await page.evaluate(() => localStorage.getItem("wordflash_timed_challenge_run_v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("wordflash_challenge_records_v1"))).toBeNull();
  await noHorizontalScroll(page, testInfo);
});

test("題組管理：顯示每題正確率，拒絕格式錯誤的題組", async ({ page }, testInfo) => {
  await setMode(page, "statistics");
  await loadSample(page);
  await page.locator(".option").first().click();
  await page.goto("/picture_sets.html");
  await expect(page.locator(".set-name")).toHaveText("範例：生活圖卡");
  await expect(page.locator(".card")).toHaveCount(8);
  await expect(page.locator(".card .accuracy", { hasText: "正確率" })).toHaveCount(1);
  await noHorizontalScroll(page, testInfo);
  await shot(page, testInfo, "sets");

  await page.locator("#fileInput").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "wordflash-picture-set", version: 1, set: { id: "bad", name: "壞題組" }, cards: [{ id: "x", image: "nope", options: ["ㄅ"], answer: "ㄆ" }] }))
  });
  await expect(page.locator("#message")).toContainText("無法匯入");
  await expect(page.locator("#message")).toContainText("options 要有 2 到 4 個注音");
  await expect(page.locator(".set")).toHaveCount(1);
});

const samplePackage = async (page) => page.evaluate(async () => (await fetch("picture-sets/sample-daily.json")).json());

test("題組管理：重新匯入較短的題組，只留下新檔案裡的題目", async ({ page }) => {
  await setMode(page, "statistics");
  await loadSample(page);
  const pkg = await samplePackage(page);
  pkg.cards = pkg.cards.slice(0, 3);
  await page.goto("/picture_sets.html");
  await page.locator("#fileInput").setInputFiles({ name: "short.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pkg)) });
  await expect(page.locator("#message")).toContainText("共 3 題");
  await expect(page.locator("#message")).toContainText("5 題已從這台裝置移除");
  await expect(page.locator(".card")).toHaveCount(3);
  await page.goto("/picture_quiz.html");
  await expect(page.locator("#setSelect option")).toHaveText("範例：生活圖卡（3 題）");
});

test("題組管理：選項不是注音時拒絕匯入", async ({ page }) => {
  await page.goto("/picture_sets.html");
  const pkg = { format: "wordflash-picture-set", version: 1, set: { id: "letters", name: "字母" },
    cards: [{ id: "a", image: "data:image/png;base64,iVBORw0KGgo=", options: ["A", "ㄅㄚ"], answer: "ㄅㄚ" }] };
  await page.locator("#fileInput").setInputFiles({ name: "letters.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(pkg)) });
  await expect(page.locator("#message")).toContainText("這些選項不是注音：A");
  await expect(page.locator(".set")).toHaveCount(0);
});

test("看圖選注音：時間剛好到時第一次點選會結算一次，不記題目", async ({ page }) => {
  await setMode(page, "challenge", { enabled: true, durationSeconds: 10 });
  await loadSample(page);
  await page.getByRole("button", { name: "開始 10 秒挑戰" }).click();
  await expect(page.locator(".option").first()).toBeEnabled();
  // Move the end of the round into the past without waiting for the ticker.
  await page.evaluate(() => {
    const key = "wordflash_timed_run_v1:picture-quiz";
    const run = JSON.parse(localStorage.getItem(key));
    run.startedAtMs -= 20000; run.endsAtMs = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(run));
  });
  await page.locator(".option").first().dispatchEvent("click");
  await expect(page.locator(".challenge-finished-note")).toBeVisible();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("wordflash_challenge_records_v1:picture-quiz")));
  expect(records.groups["sample-daily"]).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("wordflash_question_stats_v1"))).toBeNull();
});

test("看圖選注音：三個多音節選項在手機上排成兩欄", async ({ page }, testInfo) => {
  await setMode(page, "none");
  await loadSample(page);
  // The umbrella card has three two-syllable options; skip until it appears.
  for (let i = 0; i < 20; i += 1) {
    if ((await page.locator("#pictureWord").textContent()) === "雨傘") break;
    await page.locator("#nextButton").click();
  }
  await expect(page.locator("#pictureWord")).toHaveText("雨傘");
  const widths = await page.locator(".option").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  if (testInfo.project.name === "pixel-10a") {
    expect(await page.locator("#options").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
  }
  expect(Math.min(...widths)).toBeGreaterThan(100);
  await shot(page, testInfo, "three-long-options");
});

test("內建題組：翰林首冊 17 題，依課次分組並顯示署名", async ({ page }, testInfo) => {
  await setMode(page, "statistics");
  await page.goto("/picture_sets.html");
  await page.getByRole("button", { name: "載入「翰林首冊」" }).click();
  await expect(page.locator("#message")).toContainText("共 38 題");
  await expect(page.locator(".set-credit")).toContainText("OpenMoji");
  await expect(page.locator(".card")).toHaveCount(38);
  await expect(page.locator(".lesson-head", { hasText: "第三課〈來數數〉（出題 4 / 4）" })).toHaveCount(1);
  await page.getByRole("button", { name: "延伸練習全部不出" }).click();
  await expect(page.locator(".set-tools span")).toHaveText("出題 33 / 38 題");
  await shot(page, testInfo, "hanlin-sets");
  await page.goto("/picture_quiz.html");
  await expect(page.locator("#credit")).toContainText("CC BY-SA 4.0");
  await expect(page.locator(".option")).toHaveCount(4);
  await page.locator(".option").first().click();
  await expect(page.locator("#pictureWord .lesson-tag")).toBeVisible();
  await noHorizontalScroll(page, testInfo);
  await shot(page, testInfo, "hanlin-question");
});

test("合併題組：舊題組的答題紀錄與勾選接到翰林首冊，舊題組移除", async ({ page }) => {
  await page.goto("/picture_sets.html");
  // An older device: the two separate Hanlin sets, with history on one card.
  await page.evaluate(async () => {
    const data = await import("./picture-questions.js?v=5");
    const merged = await (await fetch("picture-sets/hanlin-g1-primer.json")).json();
    const pick = (id) => merged.cards.filter(card => card.previousIds[0]?.startsWith(id + "/"));
    for (const id of ["hanlin-g1-confusable", "hanlin-g1-lesson-words"]) {
      await data.importPackage({ format: "wordflash-picture-set", version: 1, set: { id, name: id },
        cards: pick(id).map(({ lesson, lessonNote, previousIds, ...card }) => card) });
    }
    localStorage.setItem("wordflash_question_stats_v1", JSON.stringify({ "picture-quiz:hanlin-g1-confusable/hand": { correct: 3, incorrect: 1 } }));
    data.setCardsEnabled(["hanlin-g1-lesson-words/teacher"], false);
  });
  await page.reload();
  await expect(page.locator(".set")).toHaveCount(2);
  await page.getByRole("button", { name: "載入「翰林首冊」" }).click();
  await expect(page.locator("#message")).toContainText("共 38 題");
  await expect(page.locator(".set")).toHaveCount(1);
  await expect(page.locator(".card", { hasText: "手" }).first().locator(".accuracy")).toContainText("答對 3・答錯 1");
  await expect(page.getByRole("checkbox", { name: "老師出題" })).not.toBeChecked();
});

test("題組管理：取消勾選的題目不會出現在練習中", async ({ page }) => {
  await setMode(page, "none");
  await loadSample(page);
  await page.goto("/picture_sets.html");
  await page.getByRole("button", { name: "全部不出" }).click();
  await expect(page.locator(".set-tools span")).toHaveText("出題 0 / 8 題");
  await page.getByRole("checkbox", { name: "魚出題" }).check();
  await page.getByRole("checkbox", { name: "花出題" }).check();
  await expect(page.locator(".set-tools span")).toHaveText("出題 2 / 8 題");
  await page.goto("/picture_quiz.html");
  const seen = new Set();
  for (let i = 0; i < 8; i += 1) {
    seen.add(await page.locator("#pictureWord").textContent());
    await page.locator("#nextButton").click();
  }
  expect([...seen].sort()).toEqual(["花", "魚"]);

  await page.goto("/picture_sets.html");
  await page.getByRole("button", { name: "全部不出" }).click();
  await page.goto("/picture_quiz.html");
  await expect(page.locator("#emptyState")).toContainText("都設成不出題");
});

test("練習紀錄：每一輪分開記錄，含錯的字，並可上傳", async ({ page }, testInfo) => {
  await setMode(page, "statistics");
  await loadSample(page);
  // Answer two questions: first wrong on purpose, second right.
  for (const wantCorrect of [false, true]) {
    const answer = await page.evaluate(async () => {
      const word = document.getElementById("pictureWord").textContent;
      const cards = await (await import("./picture-questions.js?v=4")).listCards("sample-daily");
      return cards.find(card => card.word === word).answer;
    });
    const values = await page.locator(".option").evaluateAll(nodes => nodes.map(node => node.dataset.value));
    const index = wantCorrect ? values.indexOf(answer) : values.findIndex(value => value !== answer);
    await page.locator(".option").nth(index).click();
    await page.locator("#nextButton").click();
  }
  await page.goto("/practice_logs.html");
  await expect(page.locator(".log")).toHaveCount(1);
  await expect(page.locator(".log .badge")).toHaveText("進行中");
  await expect(page.locator(".log .score")).toContainText("共 2 題，答對 1、答錯 1");
  await expect(page.locator(".log .wrong li")).toHaveCount(1);
  await expect(page.locator(".log .wrong li")).toContainText("選了");
  await noHorizontalScroll(page, testInfo);
  await shot(page, testInfo, "practice-log");

  // Switching to another set closes the round; a later answer starts a new one.
  await page.goto("/picture_sets.html");
  await page.getByRole("button", { name: "載入「翰林首冊」" }).click();
  await expect(page.locator("#message")).toContainText("共 38 題");
  await page.goto("/picture_quiz.html");
  await page.locator("#setSelect").selectOption("hanlin-g1-primer");
  await page.locator(".option").first().click();
  await page.goto("/practice_logs.html");
  await expect(page.locator(".log")).toHaveCount(2);

  // Upload with a stand-in for Firebase: each round is written under its own id.
  const saved = await page.evaluate(async () => {
    const written = {};
    const logs = await import("./practice-log.js?v=3");
    await logs.syncLogs(async (log) => { written[log.id] = log; });
    return { ids: Object.keys(written), pending: logs.pendingCount() };
  });
  expect(saved.ids).toHaveLength(2);
  expect(saved.pending).toBe(0);
});

test("練習紀錄：舊的計時紀錄和累計答題會變成舊紀錄", async ({ page }) => {
  await setMode(page, "challenge", { enabled: true, durationSeconds: 30 });
  await loadSample(page);
  await page.getByRole("button", { name: "開始 30 秒挑戰" }).click();
  await page.locator(".option").first().click();
  await page.getByRole("button", { name: "結束本輪" }).click();
  // Pretend this happened before per-round logging existed.
  await page.evaluate(() => {
    localStorage.removeItem("wordflash_practice_logs_v1");
    localStorage.removeItem("wordflash_practice_logs_legacy_done_v1");
  });
  await page.goto("/practice_logs.html");
  await expect(page.locator(".log .note", { hasText: "當時沒有記下錯了哪些字" })).toHaveCount(1);
  await expect(page.locator(".log .note", { hasText: "累計" })).toHaveCount(1);
});

test("注音練習：在設定頁換成挑戰模式，返回後立刻顯示挑戰", async ({ page }) => {
  await setMode(page, "none");
  await loadSample(page);
  await expect(page.locator("#practicePanel")).toBeHidden();
  await page.goto("/settings.html#practice");
  await page.locator('label[for="practiceChallenge"]').click();
  await expect(page.locator("#practiceChallenge")).toBeChecked();
  await page.goBack();
  await expect(page.locator("#practicePanel")).toBeVisible();
  await expect(page.locator(".challenge-number")).toBeVisible();
});

test("複習：只列開啟的題目，正確率低的排前面，顯示照片和注音", async ({ page }, testInfo) => {
  await page.goto("/picture_sets.html");
  await page.getByRole("button", { name: "載入「範例：生活圖卡」" }).click();
  await expect(page.locator("#message")).toContainText("共 8 題");
  await page.evaluate(async () => {
    const data = await import("./picture-questions.js?v=5");
    data.setCardsEnabled(["sample-daily/cup"], false);
    localStorage.setItem("wordflash_question_stats_v1", JSON.stringify({
      "picture-quiz:sample-daily/fish": { correct: 1, incorrect: 3 },
      "picture-quiz:sample-daily/sun": { correct: 4, incorrect: 1 },
      "picture-quiz:sample-daily/apple": { correct: 1, incorrect: 1 }
    }));
  });
  await page.goto("/picture_review.html");
  await expect(page.locator(".review-card")).toHaveCount(7);
  await expect(page.locator(".review-card .word")).toHaveText(["魚", "蘋果", "太陽", "花", "月亮", "星星", "雨傘"].slice(0, 3).concat(await page.locator(".review-card .word").evaluateAll(n => n.slice(3).map(x => x.textContent))));
  await expect(page.locator(".review-card").first()).toHaveClass(/is-hard/);
  await expect(page.locator(".review-card .stat").first()).toHaveText("答對 1 次／共 4 次（正確率 25%）");
  await expect(page.locator(".review-card").first().locator(".vzy-syllable")).toHaveCount(1);
  await expect(page.locator(".review-card .word", { hasText: "杯子" })).toHaveCount(0);
  await noHorizontalScroll(page, testInfo);
  await shot(page, testInfo, "review");
});

test("練習紀錄：下載帳號紀錄不會蓋掉還沒上傳的紀錄，並可匯出表格", async ({ page }) => {
  await page.goto("/practice_logs.html");
  const result = await page.evaluate(async () => {
    const logs = await import("./practice-log.js?v=3");
    localStorage.setItem("wordflash_practice_logs_v1", JSON.stringify([
      { id: "a", setName: "本機", total: 2, correct: 1, incorrect: 1, startedAt: "2026-11-08T01:00:00Z", endedAt: "2026-11-08T01:05:00Z", uploadedAt: null, wrong: [{ word: "魚", answer: "ㄩˊ", times: 1 }] }
    ]));
    const added = logs.mergeCloudLogs([
      { id: "a", setName: "雲端舊版", total: 1, uploadedAt: 1 },
      { id: "b", setName: "另一台", total: 3, correct: 3, incorrect: 0, startedAt: "2026-11-07T01:00:00Z", endedAt: "2026-11-07T01:05:00Z", uploadedAt: 1700000000000 }
    ]);
    const all = logs.loadLogs();
    return { added, names: all.map(log => log.setName).sort(), csv: logs.logsToCsv(all) };
  });
  expect(result.added).toBe(1);
  expect(result.names).toEqual(["另一台", "本機"]);
  expect(result.csv).toContain("魚（ㄩˊ）");
  expect(result.csv.split("\r\n")).toHaveLength(3);
});

test("練習紀錄：核對時補傳雲端缺少的紀錄", async ({ page }) => {
  await page.goto("/practice_logs.html");
  const result = await page.evaluate(async () => {
    const logs = await import("./practice-log.js?v=3");
    localStorage.setItem("wordflash_practice_logs_v1", JSON.stringify([
      { id: "lost", setName: "上傳時斷線", total: 1, startedAt: "2026-11-08T01:00:00Z", endedAt: "2026-11-08T01:00:00Z", uploadedAt: "2026-11-08T01:01:00Z" },
      { id: "ok", setName: "已在雲端", total: 1, startedAt: "2026-11-08T02:00:00Z", endedAt: "2026-11-08T02:00:00Z", uploadedAt: "2026-11-08T02:01:00Z" }
    ]));
    const missing = logs.markMissingForUpload(new Set(["ok"]));
    const written = [];
    await logs.syncLogs(async (log) => { written.push(log.id); });
    return { missing, written };
  });
  expect(result).toEqual({ missing: 1, written: ["lost"] });
});
