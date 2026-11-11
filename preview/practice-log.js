// One record per practice round, so rounds never overwrite each other.
//
// A round is a timed round, or (untimed) the answers given on one question
// set until the set or mode changes, or 15 minutes pass without an answer.
// Every record has its own id; the cloud copy lives at
// wordflashUsers/{uid}/practiceLogs/{id}, so uploading the same round again
// only refreshes that round.

const LOGS_KEY = "wordflash_practice_logs_v1";
const OPEN_KEY = "wordflash_practice_log_open_v1";
const LEGACY_KEY = "wordflash_practice_logs_legacy_done_v1";
const IDLE_MS = 15 * 60 * 1000;

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const newId = () => globalThis.crypto?.randomUUID?.() || `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android 手機" : "Android 平板";
  return "電腦";
}

export const loadLogs = () => {
  const logs = readJSON(LOGS_KEY, []);
  return Array.isArray(logs) ? logs.filter(log => log && typeof log.id === "string") : [];
};

const saveLogs = (logs) => {
  // Every record is kept, so "下載全部" really holds all of them on this device.
  const sorted = [...logs].sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)));
  localStorage.setItem(LOGS_KEY, JSON.stringify(sorted));
};

const upsertLog = (log) => {
  const logs = loadLogs().filter(item => item.id !== log.id);
  logs.push({ ...log, uploadedAt: null });
  saveLogs(logs);
};

const summarize = (log) => {
  const correct = log.attempts.filter(item => item.correct).length;
  const incorrect = log.attempts.length - correct;
  const wrongByCard = new Map();
  log.attempts.filter(item => !item.correct).forEach((item) => {
    const entry = wrongByCard.get(item.cardId) || { cardId: item.cardId, word: item.word, answer: item.answer, chosen: [], times: 0 };
    entry.times += 1;
    if (!entry.chosen.includes(item.chosen)) entry.chosen.push(item.chosen);
    wrongByCard.set(item.cardId, entry);
  });
  return {
    ...log,
    total: log.attempts.length,
    correct,
    incorrect,
    accuracy: log.attempts.length ? Number(((correct / log.attempts.length) * 100).toFixed(1)) : null,
    wrong: [...wrongByCard.values()]
  };
};

export const openLog = () => readJSON(OPEN_KEY, null);

// The round in progress, with its totals, for display and upload.
export const openLogSummary = () => {
  const log = openLog();
  return log?.attempts?.length ? summarize(log) : null;
};

// Closes the round in progress (if any) and keeps it as a finished record.
export function closeOpenLog() {
  const log = openLog();
  localStorage.removeItem(OPEN_KEY);
  if (!log || !log.attempts?.length) return null;
  const finished = summarize({ ...log, status: "finished" });
  upsertLog(finished);
  return finished;
}

// Records one answer. `round` describes where it was given:
// { activity, setId, setName, mode, timedRunId }.
export function logAttempt(round, attempt) {
  const now = new Date();
  let log = openLog();
  const sameRound = log
    && log.activity === round.activity
    && log.setId === round.setId
    && log.mode === round.mode
    && (log.timedRunId || null) === (round.timedRunId || null)
    && now - new Date(log.lastAnswerAt) < IDLE_MS;
  if (!sameRound) {
    closeOpenLog();
    log = {
      id: newId(),
      version: 1,
      source: "live",
      activity: round.activity,
      setId: round.setId,
      setName: round.setName,
      mode: round.mode,
      timedRunId: round.timedRunId || null,
      device: deviceLabel(),
      startedAt: now.toISOString(),
      attempts: []
    };
  }
  log.attempts.push({ ...attempt, at: now.toISOString() });
  log.lastAnswerAt = now.toISOString();
  log.endedAt = now.toISOString();
  log.status = "open";
  localStorage.setItem(OPEN_KEY, JSON.stringify(log));
  return log;
}

// Closes a round left open by an earlier visit once it has gone quiet.
export function closeStaleLog() {
  const log = openLog();
  if (log && Date.now() - new Date(log.lastAnswerAt) >= IDLE_MS) closeOpenLog();
}

// Records made before per-round logging existed: finished timed rounds (no
// word details) and the running totals per question, kept as one snapshot.
export function importLegacy({ activity, timedRecords, questionTotals }) {
  if (localStorage.getItem(LEGACY_KEY)) return 0;
  const logs = loadLogs();
  const known = new Set(logs.map(log => log.id));
  let added = 0;
  timedRecords.forEach((record) => {
    if (!record?.id || known.has(record.id)) return;
    const incorrect = Number(record.incorrect) || 0;
    const correct = Number(record.totalCorrect ?? record.correct) || 0;
    logs.push({
      id: record.id, version: 1, source: "legacy", activity,
      setId: record.sourceId, setName: record.sourceName, mode: record.mode, timedRunId: record.id,
      device: deviceLabel(), startedAt: record.completedAt, endedAt: record.completedAt, status: "finished",
      total: correct + incorrect, correct, incorrect,
      accuracy: correct + incorrect ? Number(((correct / (correct + incorrect)) * 100).toFixed(1)) : null,
      bestStreak: record.mode === "challenge" ? Number(record.correct) || 0 : null,
      wrong: [], attempts: [], note: "舊紀錄：當時沒有記下錯了哪些字。", uploadedAt: null
    });
    added += 1;
  });
  if (questionTotals.length) {
    const at = new Date().toISOString();
    logs.push({
      id: `legacy-totals-${activity}-${at.slice(0, 10)}`, version: 1, source: "legacy-totals", activity,
      setName: "累計答題（舊紀錄）", mode: "totals", device: deviceLabel(), startedAt: at, endedAt: at, status: "finished",
      total: questionTotals.reduce((sum, item) => sum + item.correct + item.incorrect, 0),
      correct: questionTotals.reduce((sum, item) => sum + item.correct, 0),
      incorrect: questionTotals.reduce((sum, item) => sum + item.incorrect, 0),
      totals: questionTotals,
      wrong: questionTotals.filter(item => item.incorrect > 0)
        .map(item => ({ cardId: item.cardId, word: item.word, answer: item.answer, times: item.incorrect, chosen: [] })),
      attempts: [], note: "舊紀錄：開始分輪記錄以前，每一題累計的答對與答錯。", uploadedAt: null
    });
    added += 1;
  }
  saveLogs(logs);
  localStorage.setItem(LEGACY_KEY, new Date().toISOString());
  return added;
}

// Uploads every record that is not in the cloud yet, plus the open round so
// it is not lost if the page is closed. `save(log)` writes one record.
export async function syncLogs(save) {
  const pending = loadLogs().filter(log => !log.uploadedAt);
  let uploaded = 0;
  for (const log of pending) {
    const { uploadedAt, ...data } = log;
    await save(JSON.parse(JSON.stringify(data)));
    const logs = loadLogs();
    const item = logs.find(entry => entry.id === log.id);
    if (item) item.uploadedAt = new Date().toISOString();
    saveLogs(logs);
    uploaded += 1;
  }
  const open = openLogSummary();
  if (open) await save(JSON.parse(JSON.stringify(open)));
  return uploaded;
}

export const pendingCount = () => loadLogs().filter(log => !log.uploadedAt).length;

// Marks every record on this device for upload again. Each record keeps its
// own id, so re-uploading only refreshes the same records in the cloud.
export function markAllForUpload() {
  saveLogs(loadLogs().map(log => ({ ...log, uploadedAt: null })));
}

// Records this device has but the cloud does not (for example an upload that
// never arrived) are queued again. Returns how many were queued.
export function markMissingForUpload(cloudIds) {
  let missing = 0;
  const logs = loadLogs().map((log) => {
    if (cloudIds.has(log.id) || !log.uploadedAt) return log;
    missing += 1;
    return { ...log, uploadedAt: null };
  });
  saveLogs(logs);
  return missing;
}

// Adds records downloaded from the cloud. A record that this device has not
// uploaded yet is never replaced by the cloud copy.
export function mergeCloudLogs(cloudLogs) {
  const logs = loadLogs();
  const byId = new Map(logs.map(log => [log.id, log]));
  let added = 0;
  cloudLogs.forEach((cloud) => {
    if (!cloud?.id) return;
    const local = byId.get(cloud.id);
    if (local && !local.uploadedAt) return;
    if (!local) added += 1;
    const uploadedAt = typeof cloud.uploadedAt === "number" ? new Date(cloud.uploadedAt).toISOString() : (cloud.uploadedAt || new Date().toISOString());
    byId.set(cloud.id, { ...cloud, uploadedAt });
  });
  saveLogs([...byId.values()]);
  return added;
}

// Moving records between devices without signing in: one device exports a
// file, another imports it; a signed-in device then uploads the imported
// records like its own. Ids are kept, so importing twice adds nothing.
export const TRANSFER_FORMAT = "wordflash-practice-logs";

export function exportLogsFile() {
  const open = openLogSummary();
  const logs = loadLogs().map(({ uploadedAt, ...log }) => log);
  if (open) logs.push({ ...open, status: "finished" });
  return JSON.stringify({ format: TRANSFER_FORMAT, version: 1, exportedAt: new Date().toISOString(), device: deviceLabel(), logs });
}

export function importLogsFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("這不是練習紀錄檔。"); }
  if (data?.format !== TRANSFER_FORMAT || !Array.isArray(data.logs)) throw new Error("這不是 WordFlash 的練習紀錄檔。");
  const logs = loadLogs();
  const known = new Set(logs.map(log => log.id));
  let added = 0;
  data.logs.forEach((log) => {
    if (!log || typeof log.id !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(log.id) || known.has(log.id)) return;
    logs.push({ ...log, uploadedAt: null });
    known.add(log.id);
    added += 1;
  });
  saveLogs(logs);
  return { added, total: data.logs.length, from: data.device || "" };
}

const MODE_NAMES = { statistics: "統計", challenge: "挑戰", totals: "累計" };
const csvCell = (value) => {
  let text = String(value ?? "");
  // A cell starting with = + - @ would run as a formula in Excel or Sheets.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// One row per round, for opening in a spreadsheet.
export function logsToCsv(logs) {
  const header = ["開始時間", "裝置", "題組", "模式", "題數", "答對", "答錯", "正確率", "答錯的字", "備註"];
  const rows = logs.map(log => [
    log.startedAt ? new Date(log.startedAt).toLocaleString("zh-TW") : "",
    log.device,
    log.setName,
    `${log.timedRunId ? "計時" : ""}${MODE_NAMES[log.mode] || log.mode || ""}`,
    log.total,
    log.correct,
    log.incorrect,
    log.accuracy === null || log.accuracy === undefined ? "" : `${log.accuracy}%`,
    (log.wrong || []).map(item => `${item.word}（${item.answer}）${item.times > 1 ? `×${item.times}` : ""}`).join("、"),
    log.note || ""
  ]);
  // A byte-order mark lets Excel open the Chinese text correctly.
  return "\ufeff" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
