// Per-question answer statistics for activities whose questions have a fixed
// id (for example a picture quiz card). Kept apart from the flashcard word
// statistics in study-data.js, which are keyed by the word itself.

export const QUESTION_STATS_KEY = "wordflash_question_stats_v1";

const readAll = () => {
  try {
    const data = JSON.parse(localStorage.getItem(QUESTION_STATS_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
};

export const questionKey = ({ activity, id }) => `${activity}:${id}`;

export function questionStats(question) {
  const value = readAll()[questionKey(question)];
  return {
    correct: Math.max(0, Number(value?.correct) || 0),
    incorrect: Math.max(0, Number(value?.incorrect) || 0)
  };
}

export function recordQuestionAnswer(question, correct) {
  const data = readAll();
  const value = questionStats(question);
  value[correct ? "correct" : "incorrect"] += 1;
  value.lastAnsweredAt = new Date().toISOString();
  data[questionKey(question)] = value;
  localStorage.setItem(QUESTION_STATS_KEY, JSON.stringify(data));
  return value;
}
