// Picture quiz data: question sets, cards and images, stored in this
// browser's IndexedDB. Cloud sync is a later step (docs/PICTURE_QUIZ_PLAN.md);
// until then the data stays on this device only.
//
// Import package (one JSON file, so it can be picked on a phone):
// {
//   "format": "wordflash-picture-set", "version": 1,
//   "set": { "id": "daily-objects", "name": "生活物品" },
//   "cards": [
//     { "id": "sun", "image": "data:image/png;base64,...",
//       "options": ["ㄊㄞˋ ㄧㄤˊ", "ㄊㄞˋ ㄧㄤ", "ㄉㄞˋ ㄧㄤˊ"],
//       "answer": "ㄊㄞˋ ㄧㄤˊ", "word": "太陽" }
//   ]
// }
// A card's lasting id is "<set id>/<card id>"; answer statistics use it, so
// an id must never be reused for a different picture.

import { normalizeZhuyin } from "./bopomofo.js";
import { QUESTION_STATS_KEY, questionKey } from "./question-progress.js?v=1";

export const ACTIVITY = "picture-quiz";
export const PACKAGE_FORMAT = "wordflash-picture-set";

// Sets shipped with the site (files under picture-sets/). They are only
// copied into this device's storage when someone presses "載入".
export const BUILT_IN_SETS = [
  { file: "picture-sets/sample-daily.json", id: "sample-daily", name: "範例：生活圖卡", description: "8 題生活物品，2 到 4 個選項。" },
  { file: "picture-sets/hanlin-g1-primer.json", id: "hanlin-g1-primer", name: "翰林首冊", description: "38 題，依第一到第九課分組，每題標出第幾課；練習易混的注音。" }
];

export async function importBuiltIn(file) {
  const response = await fetch(file, { cache: "no-cache" });
  if (!response.ok) throw new Error(`找不到內建題組（${response.status}）`);
  return importPackage(await response.json());
}
const DB_NAME = "wordflash-picture-quiz";
const DB_VERSION = 1;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 2_000_000;
const MAX_PACKAGE_CHARS = 40_000_000;
// One syllable: optional light-tone dot, 1–3 bopomofo symbols, optional tone mark.
const SYLLABLE_PATTERN = /^˙?[ㄅ-ㄯ]{1,3}[ˊˇˋ˙ˉ]?$/u;
const isZhuyin = (value) => value.split(" ").every(part => SYLLABLE_PATTERN.test(part));

const DISABLED_KEY = "wordflash_picture_disabled_v1";
export const PICTURE_DISABLED_KEY = DISABLED_KEY;

let dbPromise = null;

// Which cards are left out of practice. Kept per device in localStorage, by
// lasting card id, so re-importing a set keeps the choice.
const readDisabled = () => {
  try {
    const value = JSON.parse(localStorage.getItem(DISABLED_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter(id => typeof id === "string") : []);
  } catch {
    return new Set();
  }
};

export const isCardEnabled = (cardId) => !readDisabled().has(cardId);

export function setCardsEnabled(cardIds, enabled) {
  const disabled = readDisabled();
  cardIds.forEach(id => (enabled ? disabled.delete(id) : disabled.add(id)));
  localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sets")) db.createObjectStore("sets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("cards")) db.createObjectStore("cards", { keyPath: "id" }).createIndex("setId", "setId");
        if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

const promisify = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error("儲存被中斷"));
});

// Throws an Error whose message lists every problem, in plain Chinese, so a
// parent or an agent can fix the package.
export function validatePackage(data) {
  const problems = [];
  if (!data || typeof data !== "object") throw new Error("檔案不是題組格式（需要 JSON 物件）。");
  if (JSON.stringify(data).length > MAX_PACKAGE_CHARS) throw new Error("題組檔太大（上限約 30 MB），請把圖片壓縮或分成幾個題組。");
  if (data.format !== PACKAGE_FORMAT) problems.push(`format 必須是 "${PACKAGE_FORMAT}"。`);
  if (data.version !== 1) problems.push("version 必須是 1。");
  const setId = String(data.set?.id ?? "").trim();
  const setName = String(data.set?.name ?? "").trim();
  if (!ID_PATTERN.test(setId)) problems.push("set.id 只能用英文字母、數字、- 或 _（最多 64 字）。");
  if (!setName) problems.push("set.name 不能是空的。");
  // Optional credit line, e.g. the licence attribution for the pictures.
  const setCredit = String(data.set?.credit ?? "").trim();
  if (setCredit.length > 300) problems.push("set.credit 太長（最多 300 字）。");
  // Optional: sets this one takes over (their cards move here, then they are removed).
  const replaces = Array.isArray(data.set?.replaces) ? data.set.replaces.map(String) : [];
  if (replaces.some(id => !ID_PATTERN.test(id) || id === setId)) problems.push("set.replaces 只能列出其他題組的代號。");
  const cards = Array.isArray(data.cards) ? data.cards : [];
  if (!cards.length) problems.push("cards 至少要有一題。");
  const seen = new Set();
  const cleanCards = cards.map((card, index) => {
    const label = `第 ${index + 1} 題`;
    const id = String(card?.id ?? "").trim();
    if (!ID_PATTERN.test(id)) problems.push(`${label}：id 只能用英文字母、數字、- 或 _。`);
    else if (seen.has(id)) problems.push(`${label}：id「${id}」重複了。`);
    seen.add(id);
    const image = String(card?.image ?? "");
    if (!IMAGE_PATTERN.test(image)) problems.push(`${label}：image 必須是 data:image/...;base64 格式的圖片。`);
    else if (image.length > MAX_IMAGE_CHARS) problems.push(`${label}：圖片太大，請壓縮到約 1.5 MB 以下。`);
    const options = Array.isArray(card?.options) ? card.options.map(normalizeZhuyin).filter(Boolean) : [];
    if (options.length < 2 || options.length > 4) problems.push(`${label}：options 要有 2 到 4 個注音。`);
    const notZhuyin = options.filter(option => !isZhuyin(option));
    if (notZhuyin.length) problems.push(`${label}：這些選項不是注音：${notZhuyin.join("、")}（音節之間用空白分開）。`);
    if (new Set(options).size !== options.length) problems.push(`${label}：options 有重複的注音。`);
    const answer = normalizeZhuyin(card?.answer);
    if (!options.includes(answer)) problems.push(`${label}：answer 必須是 options 其中一個。`);
    const word = String(card?.word ?? "").trim();
    const lesson = String(card?.lesson ?? "").trim().slice(0, 60);
    const lessonNote = String(card?.lessonNote ?? "").trim().slice(0, 120);
    const previousIds = Array.isArray(card?.previousIds) ? card.previousIds.map(String).filter(value => /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(value)) : [];
    return { id, image, options, answer, word, lesson, lessonNote, previousIds };
  });
  if (problems.length) throw new Error(problems.join("\n"));
  return { set: { id: setId, name: setName, credit: setCredit, replaces }, cards: cleanCards };
}

// Adds or replaces a whole set. The set afterwards holds exactly the cards in
// the package; cards left out are removed from this device. Answer statistics
// live in localStorage (question-progress.js) and are kept either way.
export async function importPackage(data) {
  const pkg = validatePackage(data);
  const db = await openDb();
  // Read first in its own transaction. Every request of the write transaction
  // below is queued synchronously, so Safari never sees an idle transaction.
  const readTx = db.transaction(["sets", "cards"], "readonly");
  const [existing, oldCards] = await Promise.all([
    promisify(readTx.objectStore("sets").get(pkg.set.id)),
    promisify(readTx.objectStore("cards").index("setId").getAllKeys(pkg.set.id))
  ]);
  const now = new Date().toISOString();
  const keep = new Set(pkg.cards.map(card => `${pkg.set.id}/${card.id}`));
  const tx = db.transaction(["sets", "cards", "images"], "readwrite");
  tx.objectStore("sets").put({ id: pkg.set.id, name: pkg.set.name, credit: pkg.set.credit, createdAt: existing?.createdAt || now, updatedAt: now });
  oldCards.filter(id => !keep.has(id)).forEach((id) => {
    tx.objectStore("cards").delete(id);
    tx.objectStore("images").delete(id);
  });
  pkg.cards.forEach((card, order) => {
    const id = `${pkg.set.id}/${card.id}`;
    tx.objectStore("images").put({ id, dataUrl: card.image });
    tx.objectStore("cards").put({
      id, setId: pkg.set.id, order, options: card.options, answer: card.answer, word: card.word,
      lesson: card.lesson, lessonNote: card.lessonNote, updatedAt: now
    });
  });
  await transactionDone(tx);
  carryOverHistory(pkg);
  for (const oldSetId of pkg.set.replaces) await deleteSet(oldSetId);
  const removed = oldCards.filter(id => !keep.has(id)).length;
  return { setId: pkg.set.id, setName: pkg.set.name, count: pkg.cards.length, replaced: Boolean(existing), removed };
}

// When a card replaces cards of an older set, its answer statistics and
// "出題" choice move to the new id (only if the new id has none yet).
function carryOverHistory(pkg) {
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(QUESTION_STATS_KEY) || "{}") || {}; } catch { stats = {}; }
  const disabled = readDisabled();
  let changed = false;
  pkg.cards.forEach((card) => {
    const id = `${pkg.set.id}/${card.id}`;
    const newKey = questionKey({ activity: ACTIVITY, id });
    card.previousIds.forEach((oldId) => {
      const oldKey = questionKey({ activity: ACTIVITY, id: oldId });
      if (stats[oldKey] && !stats[newKey]) { stats[newKey] = stats[oldKey]; changed = true; }
      if (disabled.has(oldId)) { disabled.add(id); }
    });
  });
  if (changed) localStorage.setItem(QUESTION_STATS_KEY, JSON.stringify(stats));
  localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
}

export async function listSets() {
  const db = await openDb();
  const tx = db.transaction(["sets", "cards"], "readonly");
  const [sets, cards] = await Promise.all([
    promisify(tx.objectStore("sets").getAll()),
    promisify(tx.objectStore("cards").getAll())
  ]);
  return sets
    .map(set => ({ ...set, cardCount: cards.filter(card => card.setId === set.id).length }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
}

export async function listCards(setId) {
  const db = await openDb();
  const cards = await promisify(db.transaction("cards", "readonly").objectStore("cards").index("setId").getAll(setId));
  return cards.sort((a, b) => a.order - b.order);
}

export async function loadImage(cardId) {
  const db = await openDb();
  const record = await promisify(db.transaction("images", "readonly").objectStore("images").get(cardId));
  return record?.dataUrl || "";
}

// Removes the set's pictures from this device. Answer statistics are kept,
// so importing the same set again brings its history back.
export async function deleteSet(setId) {
  const cards = await listCards(setId);
  const db = await openDb();
  const tx = db.transaction(["sets", "cards", "images"], "readwrite");
  tx.objectStore("sets").delete(setId);
  cards.forEach((card) => {
    tx.objectStore("cards").delete(card.id);
    tx.objectStore("images").delete(card.id);
  });
  await transactionDone(tx);
}
