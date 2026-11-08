// Zhuyin (bopomofo) helpers: normalising readings and drawing them in the
// vertical textbook layout. Each syllable is a column of symbols; the tone
// mark sits to the right of the last symbol and the light tone dot sits on
// top, as in Taiwanese first-grade textbooks.

const TONES = new Set(["ˊ", "ˇ", "ˋ", "ˉ"]);
const LIGHT_TONE = "˙";

export function normalizeZhuyin(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

export const syllablesOf = (value) => normalizeZhuyin(value).split(" ").filter(Boolean);

export function splitSyllable(syllable) {
  let letters = [...syllable];
  let tone = "";
  let light = false;
  if (letters[0] === LIGHT_TONE) { light = true; letters = letters.slice(1); }
  const last = letters[letters.length - 1];
  if (last === LIGHT_TONE) { light = true; letters = letters.slice(0, -1); }
  else if (TONES.has(last)) { tone = last === "ˉ" ? "" : last; letters = letters.slice(0, -1); }
  return { letters, tone, light };
}

// Returns an element; style it with the .vzy rules in picture_quiz.html.
export function renderVerticalZhuyin(value) {
  const word = document.createElement("span");
  word.className = "vzy";
  word.setAttribute("aria-hidden", "true");
  for (const syllable of syllablesOf(value)) {
    const { letters, tone, light } = splitSyllable(syllable);
    const column = document.createElement("span");
    column.className = "vzy-syllable";
    if (light) {
      const dot = document.createElement("span");
      dot.className = "vzy-light";
      dot.textContent = LIGHT_TONE;
      column.append(dot);
    }
    letters.forEach((letter, index) => {
      const cell = document.createElement("span");
      cell.className = "vzy-letter";
      cell.textContent = letter;
      if (tone && index === letters.length - 1) {
        const mark = document.createElement("span");
        mark.className = "vzy-tone";
        mark.textContent = tone;
        cell.append(mark);
      }
      column.append(cell);
    });
    word.append(column);
  }
  return word;
}

// Longest syllable column, counting the light-tone dot, used for sizing.
export function zhuyinHeight(value) {
  return Math.max(1, ...syllablesOf(value).map((syllable) => {
    const { letters, light } = splitSyllable(syllable);
    return letters.length + (light ? 0.6 : 0);
  }));
}
