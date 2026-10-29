// Additional practice data stays separate from the existing cloud word libraries.
export const SELECTION_KEY = "wordflash_selected_units_v1";
export const DISABLED_KEY = "wordflash_disabled_words_v1";
export const WORD_STATS_KEY = "wordflash_word_stats_v1";
export const SAMPLING_KEY = "wordflash_challenge_sampling_v1";
export const ORGANIZER_KEY = "wordflash_library_organizer_v1";
export function organizer() {
  const data = readJSON(ORGANIZER_KEY, {});
  return { folders: Array.isArray(data?.folders) ? data.folders : [], assignments: data?.assignments && typeof data.assignments === "object" ? data.assignments : {}, presets: Array.isArray(data?.presets) ? data.presets : [] };
}
export function saveOrganizer(data) { localStorage.setItem(ORGANIZER_KEY, JSON.stringify(data)); }

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

// Keep named lessons in the order people expect: L1, L2, … L10, rather than
// a plain text order such as L1, L10, L2. Other library names retain their
// normal Traditional-Chinese alphabetical order.
export function sortUnitNames(names) {
  return [...names].sort((first, second) => first.localeCompare(second, "zh-Hant", { numeric: true, sensitivity: "base" }));
}

// The same word and pronunciation share progress across libraries. A different
// pronunciation is deliberately a different item.
export function wordKey(raw) {
  const [text = "", ...reading] = String(raw ?? "").split("|");
  return JSON.stringify([text.trim().normalize("NFC"), reading.join("|").trim().replace(/\s+/g, " ").normalize("NFC")]);
}

export function selectedUnits(state) {
  const names = sortUnitNames(Object.keys(state?.units || {}));
  const saved = readJSON(SELECTION_KEY, null);
  const selected = Array.isArray(saved) ? [...new Set(saved.filter(name => names.includes(name)))] : [];
  return selected.length ? selected : (names.includes(state?.current) ? [state.current] : names.slice(0, 1));
}

export function saveSelectedUnits(names) {
  localStorage.setItem(SELECTION_KEY, JSON.stringify([...new Set(names)]));
  localStorage.removeItem("wordflash_active_preset_v1");
}

export function disabledWords() {
  const data = readJSON(DISABLED_KEY, {});
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

const copyDisabledWords = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [unit, keys]) => {
    if (typeof unit !== "string" || !unit.trim() || !Array.isArray(keys)) return result;
    result[unit] = [...new Set(keys.filter((key) => typeof key === "string" && key.trim()))];
    return result;
  }, {});
};

const copyWordStats = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, score]) => {
    if (typeof key !== "string" || !key.trim() || !score || typeof score !== "object") return result;
    const correct = Math.max(0, Math.floor(Number(score.correct) || 0));
    const incorrect = Math.max(0, Math.floor(Number(score.incorrect) || 0));
    if (correct || incorrect) result[key] = { correct, incorrect };
    return result;
  }, {});
};

// Practice settings remain usable offline, while a signed-in account also
// stores a normalized copy so its enabled words and results follow the user.
export function cloudData() {
  return {
    disabled: copyDisabledWords(disabledWords()),
    wordStats: copyWordStats(readJSON(WORD_STATS_KEY, {}))
  };
}

export function applyCloudData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  localStorage.setItem(DISABLED_KEY, JSON.stringify(copyDisabledWords(value.disabled)));
  localStorage.setItem(WORD_STATS_KEY, JSON.stringify(copyWordStats(value.wordStats)));
  return true;
}

export function isEnabled(unit, raw) {
  const disabled = disabledWords()[unit];
  return !Array.isArray(disabled) || !disabled.includes(wordKey(raw));
}

export function setEnabled(unit, raw, enabled) {
  const data = disabledWords();
  const entries = new Set(Array.isArray(data[unit]) ? data[unit] : []);
  if (enabled) entries.delete(wordKey(raw)); else entries.add(wordKey(raw));
  Object.defineProperty(data, unit, { value: [...entries], writable: true, configurable: true, enumerable: true });
  localStorage.setItem(DISABLED_KEY, JSON.stringify(data));
}

export function practiceWords(state, names = selectedUnits(state)) {
  const seen = new Set();
  const result = [];
  for (const name of names) {
    for (const raw of state?.units?.[name] || []) {
      const key = wordKey(raw);
      if (String(raw).trim() && isEnabled(name, raw) && !seen.has(key)) {
        seen.add(key);
        result.push(raw);
      }
    }
  }
  return result;
}

export function wordStats(raw) {
  const data = readJSON(WORD_STATS_KEY, {});
  const value = data && typeof data === "object" ? data[wordKey(raw)] : null;
  return { correct: Math.max(0, Number(value?.correct) || 0), incorrect: Math.max(0, Number(value?.incorrect) || 0) };
}

export function recordWordAnswer(raw, correct) {
  if (!String(raw ?? "").trim()) return;
  const data = readJSON(WORD_STATS_KEY, {});
  const safe = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const value = wordStats(raw);
  value[correct ? "correct" : "incorrect"] += 1;
  safe[wordKey(raw)] = value;
  localStorage.setItem(WORD_STATS_KEY, JSON.stringify(safe));
}

export function weightedSnapshot(words) {
  return words.reduce((snapshot, word) => {
    const { correct, incorrect } = wordStats(word);
    const total = correct + incorrect;
    snapshot[wordKey(word)] = total < 3 ? 1.5 : 1 + 2 * incorrect / total;
    return snapshot;
  }, {});
}

export function chooseWeighted(words, previous, snapshot = null) {
  if (!words.length) return "";
  const previousKey = wordKey(previous);
  // A weighted question may appear often, but showing exactly the same card
  // immediately after it was answered feels like the answer was ignored.
  // Keep every word's relative weighting while removing only the preceding
  // card when another distinct card is available.
  const alternatives = words.filter(word => wordKey(word) !== previousKey);
  const choices = alternatives.length ? alternatives : words;
  const weights = choices.map(word => {
    const savedWeight = Number(snapshot?.[wordKey(word)]);
    if (Number.isFinite(savedWeight) && savedWeight > 0) return savedWeight;
    const { correct, incorrect } = wordStats(word);
    const total = correct + incorrect;
    return total < 3 ? 1.5 : 1 + 2 * incorrect / total;
  });
  let target = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < choices.length; i += 1) {
    target -= weights[i];
    if (target < 0) return choices[i];
  }
  return choices[choices.length - 1];
}
