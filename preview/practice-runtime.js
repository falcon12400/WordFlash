// Shared practice rules: practice mode, untimed totals, timed rounds and
// finished-round records. The settings page writes the mode / timer keys;
// each activity (flashcard, picture-quiz) keeps its own session, running
// round and records so the two pages never overwrite each other.
//
// The flashcard page (canvas_words.html) still has its own copy of these
// rules; it is planned to move onto this module after the picture quiz is
// stable (see docs/PICTURE_QUIZ_PLAN.md).

export const PRACTICE_MODE_KEY = "wordflash_practice_mode_v1";
export const CHALLENGE_PROGRESS_DISPLAY_KEY = "wordflash_challenge_progress_display_v1";
export const CHALLENGE_TIMER_KEY = "wordflash_challenge_timer_v1";

const PRACTICE_MODES = new Set(["none", "statistics", "challenge"]);
const PROGRESS_DISPLAYS = new Set(["number", "blocks", "both"]);
const DEFAULT_TIMER = { enabled: false, durationSeconds: 60 };
const MAX_RECORDS_PER_GROUP = 50;

const readJSON = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

export const createId = (prefix = "run") => (
  globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

export function loadPracticeMode() {
  const saved = localStorage.getItem(PRACTICE_MODE_KEY);
  return PRACTICE_MODES.has(saved) ? saved : "none";
}

export function loadProgressDisplay() {
  const saved = localStorage.getItem(CHALLENGE_PROGRESS_DISPLAY_KEY);
  return PROGRESS_DISPLAYS.has(saved) ? saved : "both";
}

export function normalizeDuration(value) {
  const seconds = Math.round(Number(value));
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(10, seconds)) : DEFAULT_TIMER.durationSeconds;
}

export function loadTimer() {
  const saved = readJSON(CHALLENGE_TIMER_KEY, {});
  return { enabled: saved?.enabled === true, durationSeconds: normalizeDuration(saved?.durationSeconds) };
}

export function formatTimer(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export const accuracyOf = (correct, incorrect) => (
  correct + incorrect ? Number(((correct / (correct + incorrect)) * 100).toFixed(1)) : null
);

export function createPracticeRuntime(activity) {
  if (!/^[a-z][a-z0-9-]*$/.test(activity)) throw new Error(`Invalid activity name: ${activity}`);
  const SESSION_KEY = `wordflash_practice_session_v1:${activity}`;
  const RUN_KEY = `wordflash_timed_run_v1:${activity}`;
  const RECORDS_KEY = `wordflash_challenge_records_v1:${activity}`;

  const loadSession = () => {
    const saved = readJSON(SESSION_KEY, {});
    return {
      statistics: { correct: count(saved?.statistics?.correct), incorrect: count(saved?.statistics?.incorrect) },
      challenge: { correct: count(saved?.challenge?.correct) }
    };
  };
  const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  const normalizeRun = (value) => {
    if (!value || typeof value !== "object" || !["running", "finished"].includes(value.status)) return null;
    const startedAtMs = Number(value.startedAtMs);
    const endsAtMs = Number(value.endsAtMs);
    const sourceName = typeof value.sourceName === "string" ? value.sourceName : "";
    if (!sourceName || !Number.isFinite(startedAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startedAtMs) return null;
    return {
      version: 1,
      activity,
      id: typeof value.id === "string" && value.id ? value.id : createId(),
      mode: value.mode === "statistics" ? "statistics" : "challenge",
      sourceId: typeof value.sourceId === "string" && value.sourceId ? value.sourceId : sourceName,
      sourceName,
      questionIds: Array.isArray(value.questionIds) ? value.questionIds.filter(id => typeof id === "string") : [],
      durationSeconds: normalizeDuration(value.durationSeconds),
      startedAtMs,
      endsAtMs,
      status: value.status,
      currentStreak: count(value.currentStreak),
      bestStreak: count(value.bestStreak),
      correctCount: count(value.correctCount),
      incorrectCount: count(value.incorrectCount),
      finishedAtMs: Number.isFinite(Number(value.finishedAtMs)) ? Number(value.finishedAtMs) : null
    };
  };

  const loadRun = () => normalizeRun(readJSON(RUN_KEY, null));
  const saveRun = (run) => localStorage.setItem(RUN_KEY, JSON.stringify(run));
  const clearRun = () => localStorage.removeItem(RUN_KEY);
  const remainingSeconds = (run) => Math.max(0, Math.ceil((run.endsAtMs - Date.now()) / 1000));

  const loadRecords = () => {
    const saved = readJSON(RECORDS_KEY, null);
    const groups = saved && typeof saved.groups === "object" && saved.groups ? saved.groups : {};
    return {
      version: 1,
      groups: Object.fromEntries(Object.entries(groups).filter(([, list]) => Array.isArray(list)))
    };
  };

  const saveRecord = (run, reason) => {
    const records = loadRecords();
    const completedAtMs = run.finishedAtMs || Date.now();
    const isStatistics = run.mode === "statistics";
    const record = {
      id: run.id,
      activity,
      mode: run.mode,
      sourceId: run.sourceId,
      sourceName: run.sourceName,
      completedAt: new Date(completedAtMs).toISOString(),
      durationSeconds: run.durationSeconds,
      elapsedSeconds: Math.min(run.durationSeconds, Math.max(0, Math.round((completedAtMs - run.startedAtMs) / 1000))),
      correct: isStatistics ? run.correctCount : run.bestStreak,
      totalCorrect: run.correctCount,
      incorrect: run.incorrectCount,
      ...(isStatistics ? { accuracy: accuracyOf(run.correctCount, run.incorrectCount) } : {}),
      reason
    };
    const list = records.groups[run.sourceId] || [];
    const existing = list.findIndex(item => item?.id === run.id);
    if (existing >= 0) list[existing] = record; else list.unshift(record);
    records.groups[run.sourceId] = list
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, MAX_RECORDS_PER_GROUP);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return record;
  };

  const isTimedNow = (timer, run) => timer.enabled || run?.status === "running";

  return {
    activity,
    loadSession,
    loadRun,
    loadRecords,
    remainingSeconds,

    // Timed mode is "armed" when the settings enable a timer for statistics
    // or challenge mode. Answers are locked until the round is started.
    state() {
      const mode = loadPracticeMode();
      const timer = loadTimer();
      const stored = loadRun();
      const run = stored?.status === "running" && remainingSeconds(stored) > 0 ? stored : null;
      const timed = mode !== "none" && (timer.enabled || Boolean(run));
      return { mode, timer, run, expired: Boolean(stored && !run), timed, locked: timed && !run };
    },

    startRun({ sourceId, sourceName, questionIds = [] }) {
      const { mode, timer } = this.state();
      if (mode === "none" || !timer.enabled) return null;
      const existing = loadRun();
      if (existing?.status === "running" && remainingSeconds(existing) > 0) return existing;
      if (existing) this.finishRun("time_up");
      const now = Date.now();
      const run = normalizeRun({
        id: createId(),
        mode,
        sourceId,
        sourceName,
        questionIds,
        durationSeconds: timer.durationSeconds,
        startedAtMs: now,
        endsAtMs: now + timer.durationSeconds * 1000,
        status: "running"
      });
      saveRun(run);
      return run;
    },

    // Returns null when the answer is not counted (no practice mode, or a
    // timed round that has not started). Returns { finished: record } when
    // the round had already run out of time.
    recordAttempt(correct) {
      const mode = loadPracticeMode();
      if (mode === "none") return null;
      const timer = loadTimer();
      const run = loadRun();
      const timed = isTimedNow(timer, run);
      if (timed) {
        if (!run || run.status !== "running") return null;
        if (remainingSeconds(run) <= 0) return { finished: this.finishRun("time_up") };
        if (correct) {
          run.correctCount += 1;
          run.currentStreak += 1;
          run.bestStreak = Math.max(run.bestStreak, run.currentStreak);
        } else {
          run.incorrectCount += 1;
          run.currentStreak = 0;
        }
        saveRun(run);
      }
      const session = loadSession();
      if (mode === "statistics") {
        session.statistics[correct ? "correct" : "incorrect"] += 1;
      } else if (!timed) {
        session.challenge.correct = correct ? session.challenge.correct + 1 : 0;
      }
      saveSession(session);
      return { counted: true };
    },

    finishRun(reason = "time_up") {
      const stored = loadRun();
      if (!stored) return null;
      const run = {
        ...stored,
        status: "finished",
        finishedAtMs: stored.finishedAtMs || Math.min(Date.now(), stored.endsAtMs)
      };
      const record = saveRecord(run, reason);
      clearRun();
      return record;
    },

    // Values to show in the panel: this round while timed, long-term totals otherwise.
    summary() {
      const { mode, run, timed } = this.state();
      const session = loadSession();
      if (mode === "statistics") {
        const correct = run ? run.correctCount : (timed ? 0 : session.statistics.correct);
        const incorrect = run ? run.incorrectCount : (timed ? 0 : session.statistics.incorrect);
        return { mode, correct, incorrect, accuracy: accuracyOf(correct, incorrect) };
      }
      if (mode === "challenge") {
        return { mode, streak: run ? run.currentStreak : (timed ? 0 : session.challenge.correct) };
      }
      return { mode };
    }
  };
}
