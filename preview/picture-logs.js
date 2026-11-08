// Glue between the picture quiz and the per-round practice logs: importing
// records made before logging existed, and uploading logs when the device is
// signed in to Google (sign in on the settings page; the quiz page itself has
// no account buttons).

import { importLegacy, syncLogs, pendingCount } from "./practice-log.js?v=1";
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

  // Loaded on demand: if the network is down the quiz keeps working offline.
  import("./firebase-wordflash.js?v=5").then((module) => {
    firebase = module;
    module.subscribeToUser((nextUser) => { user = nextUser; sync(); });
  }).catch((error) => {
    console.warn("WordFlash cloud unavailable", error);
    onStatus({ signedIn: false, pending: pendingCount(), error });
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); });
  return {
    sync,
    loadCloudLogs: async () => (firebase && user ? firebase.loadPracticeLogs(user) : null),
    isSignedIn: () => Boolean(user)
  };
}
