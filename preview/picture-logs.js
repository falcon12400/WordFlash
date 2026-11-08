// Glue between the picture quiz and the per-round practice logs: importing
// records made before logging existed, and uploading logs when the device is
// signed in to Google (sign in on the settings page; the quiz page itself has
// no account buttons).

import { importLegacy, syncLogs, pendingCount, markAllForUpload, mergeCloudLogs, markMissingForUpload, loadLogs } from "./practice-log.js?v=3";
import { ACTIVITY, listSets, listCards } from "./picture-questions.js?v=5";
import { createPracticeRuntime } from "./practice-runtime.js?v=1";
import { QUESTION_STATS_KEY } from "./question-progress.js?v=1";

export async function importPictureLegacy() {
  const runtime = createPracticeRuntime(ACTIVITY);
  const timedRecords = Object.values(runtime.loadRecords().groups).flat();
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(QUESTION_STATS_KEY) || "{}") || {}; } catch { stats = {}; }
  const cards = new Map();
  for (const set of await listSets()) {
    for (const card of await listCards(set.id)) cards.set(card.id, { ...card, setName: set.name });
  }
  const prefix = `${ACTIVITY}:`;
  const questionTotals = Object.entries(stats)
    .filter(([key, value]) => key.startsWith(prefix) && value && (value.correct || value.incorrect))
    .map(([key, value]) => {
      const cardId = key.slice(prefix.length);
      const card = cards.get(cardId);
      return {
        cardId,
        word: card?.word || cardId,
        answer: card?.answer || "",
        setName: card?.setName || "",
        correct: Number(value.correct) || 0,
        incorrect: Number(value.incorrect) || 0
      };
    });
  return importLegacy({ activity: ACTIVITY, timedRecords, questionTotals });
}

// Calls onStatus({ signedIn, pending, error }) whenever something changes.
export function startCloudSync(onStatus = () => {}) {
  let user = null;
  let firebase = null;
  let running = null;

  const sync = async () => {
    if (!firebase || !user) { onStatus({ signedIn: Boolean(user), pending: pendingCount() }); return; }
    if (running) return running;
    running = syncLogs(log => firebase.savePracticeLog(user, log))
      .then(() => onStatus({ signedIn: true, pending: pendingCount() }))
      .catch((error) => {
        console.error("WordFlash practice log upload failed", error);
        onStatus({ signedIn: true, pending: pendingCount(), error });
      })
      .finally(() => { running = null; });
    return running;
  };

  // Each time the page opens (and on sign-in): compare this device with the
  // cloud by record id, upload what the cloud lacks, download what this
  // device lacks, and report one summary line instead of every record.
  const reconcile = async () => {
    if (!firebase || !user) { onStatus({ signedIn: Boolean(user), pending: pendingCount() }); return; }
    try {
      const cloudLogs = await firebase.loadPracticeLogs(user);
      markMissingForUpload(new Set(cloudLogs.map(log => log.id)));
      const downloaded = mergeCloudLogs(cloudLogs);
      await syncLogs(log => firebase.savePracticeLog(user, log));
      const cloudCount = new Set([...cloudLogs.map(log => log.id), ...loadLogs().map(log => log.id)]).size;
      onStatus({ signedIn: true, pending: pendingCount(), checked: true, downloaded, cloudCount, checkedAt: new Date() });
    } catch (error) {
      console.error("WordFlash practice log check failed", error);
      onStatus({ signedIn: true, pending: pendingCount(), error });
    }
  };

  // Loaded on demand: if the network is down the quiz keeps working offline.
  import("./firebase-wordflash.js?v=5").then((module) => {
    firebase = module;
    module.subscribeToUser((nextUser) => { user = nextUser; reconcile(); });
  }).catch((error) => {
    console.warn("WordFlash cloud unavailable", error);
    onStatus({ signedIn: false, pending: pendingCount(), error });
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); });
  // Uploads at most every 20 seconds while a child keeps answering.
  let lastQuickSync = 0;
  const syncSoon = () => {
    if (Date.now() - lastQuickSync < 20000) return;
    lastQuickSync = Date.now();
    sync();
  };

  return {
    sync,
    reconcile,
    syncSoon,
    uploadAll: async () => { markAllForUpload(); await sync(); },
    // Copies every record of this account onto this device; returns how many were new.
    downloadAll: async () => {
      if (!firebase || !user) throw new Error("請先在設定頁登入 Google。");
      return mergeCloudLogs(await firebase.loadPracticeLogs(user));
    },
    loadCloudLogs: async () => (firebase && user ? firebase.loadPracticeLogs(user) : null),
    isSignedIn: () => Boolean(user)
  };
}
