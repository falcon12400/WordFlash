// Practice panel pieces shared by practice pages: statistic tiles, the
// bookshelf of correct answers, and the timed-round bar. Styles live in
// practice-ui.css. The bookshelf follows the flashcard page: three shelves of
// normal books, then a compact bookcase with about four times the room, then
// "+N" for the rest.

import { formatTimer } from "./practice-runtime.js";

const MAX_ROWS = 3;
const BOOK_COLORS = ["#dce8d7", "#f3ddd4", "#d9e4ee", "#f1e5bd"];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createStat(label, value) {
  const item = el("div", "practice-stat");
  item.append(el("span", "", label), el("strong", "", value));
  return item;
}

const booksPerRow = (container, compact) => {
  const sample = el("span", compact ? "challenge-book challenge-book--compact" : "challenge-book");
  sample.setAttribute("aria-hidden", "true");
  container.append(sample);
  const width = Math.ceil(sample.getBoundingClientRect().width) || 22;
  sample.remove();
  return Math.max(1, Math.floor((container.clientWidth - (compact ? 8 : 16)) / width));
};

// `container` must already be in the document so the shelf width can be measured.
export function createChallengeProgress(correctCount, display, container) {
  const progress = el("div", `challenge-progress challenge-progress--${display}`);
  if (display !== "blocks") {
    const number = el("div", "challenge-number");
    number.append(el("span", "", "目前連續答對"), el("strong", "", String(correctCount)));
    progress.append(number);
  }
  if (display === "number") return progress;

  const normalPerRow = booksPerRow(container, false);
  const compact = correctCount > normalPerRow * MAX_ROWS;
  const perRow = compact ? booksPerRow(container, true) : normalPerRow;
  const shelvesPerRow = compact ? 2 : 1;
  const capacity = perRow * MAX_ROWS * shelvesPerRow;
  const pieces = el("div", `challenge-pieces${compact ? " challenge-pieces--compact" : ""}`);
  pieces.setAttribute("role", "img");
  pieces.setAttribute("aria-label", `目前連續答對 ${correctCount} 題${compact ? "，以縮小書架顯示" : ""}`);
  pieces.dataset.mode = compact ? "compact" : "normal";
  pieces.dataset.visibleCapacity = String(capacity);

  if (!correctCount) {
    const empty = el("span", "challenge-empty", "答對一題，就會多一本書");
    empty.setAttribute("aria-hidden", "true");
    pieces.append(empty);
  } else {
    const visible = Math.min(correctCount, capacity);
    for (let rowIndex = 0; rowIndex < MAX_ROWS; rowIndex += 1) {
      const rowStart = rowIndex * perRow * shelvesPerRow;
      if (rowStart >= visible) break;
      const row = el("div", `challenge-piece-row${compact ? " challenge-piece-row--compact" : ""}`);
      for (let shelfIndex = 0; shelfIndex < shelvesPerRow; shelfIndex += 1) {
        const shelfStart = rowStart + shelfIndex * perRow;
        if (shelfStart >= visible) break;
        const shelf = compact ? el("div", "challenge-piece-shelf--compact") : row;
        for (let position = shelfStart; position < Math.min(shelfStart + perRow, visible); position += 1) {
          const book = el("span", `challenge-book${compact ? " challenge-book--compact" : ""}`);
          book.style.setProperty("--piece-color", BOOK_COLORS[position % BOOK_COLORS.length]);
          book.setAttribute("aria-hidden", "true");
          shelf.append(book);
        }
        if (compact) row.append(shelf);
      }
      pieces.append(row);
    }
    if (correctCount > capacity) {
      const overflow = el("span", "challenge-overflow", `+${correctCount - capacity}`);
      overflow.setAttribute("aria-hidden", "true");
      pieces.append(overflow);
    }
  }
  progress.append(pieces);
  return progress;
}

// The bar above the summary in timed mode: a start button before the round,
// the countdown and a stop button during it, and the last result afterwards.
export function createTimerBar({ mode, timer, run, remainingSeconds, sourceName, latestResult }) {
  const items = [];
  const isStatistics = (run?.mode || mode) === "statistics";
  const modeLabel = isStatistics ? "統計倒數" : "計時挑戰";
  const bar = el("div", `challenge-timer${run ? " challenge-timer--running" : ""}`);
  const copy = el("div", "challenge-timer-copy");
  if (run) {
    copy.append(el("span", "", `「${run.sourceName}」${modeLabel}`), el("strong", "", "倒數中"));
    const actions = el("div", "challenge-timer-actions");
    const value = el("output", "challenge-timer-value", formatTimer(remainingSeconds));
    value.setAttribute("aria-label", `剩餘 ${remainingSeconds} 秒`);
    const stop = el("button", "challenge-stop-button", "結束本輪");
    stop.type = "button";
    stop.dataset.action = "stop-run";
    actions.append(value, stop);
    bar.append(copy, actions);
  } else {
    copy.append(
      el("span", "", `準備開始${modeLabel}${sourceName ? `：${sourceName}` : ""}`),
      el("strong", "", isStatistics
        ? `每輪 ${timer.durationSeconds} 秒；答對與答錯會計入統計。`
        : `每輪 ${timer.durationSeconds} 秒；答錯會讓連勝歸零。`)
    );
    const start = el("button", "challenge-start-button", isStatistics
      ? `開始 ${timer.durationSeconds} 秒統計`
      : `開始 ${timer.durationSeconds} 秒挑戰`);
    start.type = "button";
    start.dataset.action = "start-run";
    bar.append(copy, start);
  }
  items.push(bar);

  if (!run && latestResult) {
    const note = el("div", "challenge-finished-note");
    const statisticsResult = latestResult.mode === "statistics";
    note.append(
      el("span", "", statisticsResult ? `「${latestResult.sourceName}」本輪統計已結束` : `「${latestResult.sourceName}」本輪挑戰已結束`),
      el("strong", "", statisticsResult
        ? `答對 ${latestResult.correct} 題、答錯 ${latestResult.incorrect} 題${latestResult.accuracy === null ? "" : `，正確率 ${latestResult.accuracy.toFixed(1)}%`}`
        : `本輪最高連續答對 ${latestResult.correct} 題`)
    );
    items.push(note);
  }
  return items;
}
