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

// The same word and pronunciation share progress across libraries. A different
// pronunciation is deliberately a different item.
export function wordKey(raw) {
  const [text = "", ...reading] = String(raw ?? "").split("|");
  return JSON.stringify([text.trim().normalize("NFC"), reading.join("|").trim().replace(/\s+/g, " ").normalize("NFC")]);
}

export function selectedUnits(state) {
  const names = Object.keys(state?.units || {});
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

export function chooseWeighted(words, previous) {
  if (!words.length) return "";
  const choices = words;
  const weights = choices.map(word => {
    const { correct, incorrect } = wordStats(word);
    const total = correct + incorrect;
    const base = total < 3 ? 1.5 : 1 + 2 * incorrect / total;
    // Discourage immediate repetition without making weighting impossible when
    // there are only two words in the selected libraries.
    return words.length > 1 && wordKey(word) === wordKey(previous) ? base * 0.35 : base;
  });
  let target = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < choices.length; i += 1) {
    target -= weights[i];
    if (target < 0) return choices[i];
  }
  return choices[choices.length - 1];
}
