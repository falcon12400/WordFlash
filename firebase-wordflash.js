import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  get,
  getDatabase,
  ref,
  serverTimestamp,
  set
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  projectId: "wordflash-53976",
  appId: "1:358384646941:web:6a11c88d3a0fd36aa3fff4",
  databaseURL: "https://wordflash-53976-default-rtdb.firebaseio.com",
  storageBucket: "wordflash-53976.firebasestorage.app",
  apiKey: "AIzaSyDL6SZ281yDim1L4dkl2FGD5qmTrK8uwvU",
  authDomain: "wordflash-53976.firebaseapp.com",
  messagingSenderId: "358384646941"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const cloudLibraryPath = (uid) => `wordflashUsers/${uid}/library`;

const copyOrganizer = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const folders = Array.isArray(value.folders)
    ? value.folders.reduce((result, folder) => {
      if (!folder || typeof folder !== "object") return result;
      const id = typeof folder.id === "string" ? folder.id.trim() : "";
      const name = typeof folder.name === "string" ? folder.name.trim() : "";
      if (!id || !name || result.some((item) => item.id === id)) return result;
      result.push({
        id,
        name,
        parent: typeof folder.parent === "string" ? folder.parent.trim() : ""
      });
      return result;
    }, [])
    : [];
  const folderIds = new Set(folders.map((folder) => folder.id));
  const assignments = Object.entries(value.assignments || {}).reduce((result, [name, folder]) => {
    if (typeof name !== "string" || !name.trim() || typeof folder !== "string") return result;
    result[name] = folderIds.has(folder) ? folder : "";
    return result;
  }, {});
  const presets = Array.isArray(value.presets)
    ? value.presets.reduce((result, preset) => {
      if (!preset || typeof preset !== "object") return result;
      const id = typeof preset.id === "string" ? preset.id.trim() : "";
      const name = typeof preset.name === "string" ? preset.name.trim() : "";
      if (!id || !name || result.some((item) => item.id === id)) return result;
      result.push({
        id,
        name,
        units: Array.isArray(preset.units)
          ? [...new Set(preset.units.filter((unit) => typeof unit === "string" && unit.trim()).map((unit) => unit.trim()))]
          : [],
        folder: folderIds.has(preset.folder) ? preset.folder : ""
      });
      return result;
    }, [])
    : [];

  return { folders, assignments, presets };
};

const copyStudy = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const disabled = Object.entries(value.disabled || {}).reduce((result, [unit, keys]) => {
    if (typeof unit !== "string" || !unit.trim() || !Array.isArray(keys)) return result;
    result[unit] = [...new Set(keys.filter((key) => typeof key === "string" && key.trim()))];
    return result;
  }, {});
  const wordStats = Object.entries(value.wordStats || {}).reduce((result, [key, score]) => {
    if (typeof key !== "string" || !key.trim() || !score || typeof score !== "object") return result;
    const correct = Math.max(0, Math.floor(Number(score.correct) || 0));
    const incorrect = Math.max(0, Math.floor(Number(score.incorrect) || 0));
    if (correct || incorrect) result[key] = { correct, incorrect };
    return result;
  }, {});
  return { disabled, wordStats };
};

const copyUnits = (value) => {
  if (!value || typeof value !== "object" || !value.units || typeof value.units !== "object") return null;

  const units = Object.entries(value.units).reduce((result, [name, entries]) => {
    if (typeof name !== "string" || !name.trim() || !Array.isArray(entries)) return result;
    result[name] = entries
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return result;
  }, {});
  // Realtime Database may omit an empty array. Keep the names separately so a
  // newly created, still-empty library survives its first cloud round trip.
  if (Array.isArray(value.emptyUnits)) {
    value.emptyUnits.forEach((name) => {
      if (typeof name === "string" && name.trim() && !Object.hasOwn(units, name)) units[name] = [];
    });
  }
  const names = Object.keys(units);
  if (!names.length) return null;

  const library = {
    current: typeof value.current === "string" && units[value.current] ? value.current : names[0],
    units
  };
  const organizer = copyOrganizer(value.organizer);
  if (organizer) library.organizer = organizer;
  const study = copyStudy(value.study);
  if (study) library.study = study;
  return library;
};

export const normalizeUnits = (value) => copyUnits(value);

export const subscribeToUser = (callback) => onAuthStateChanged(auth, callback);

export const signInWithGoogle = () => signInWithPopup(auth, provider);

export const signOutFromGoogle = () => signOut(auth);

export const loadCloudUnits = async (user) => {
  if (!user?.uid) return null;
  const snapshot = await get(ref(database, cloudLibraryPath(user.uid)));
  return snapshot.exists() ? copyUnits(snapshot.val()) : null;
};

export const saveCloudUnits = async (user, units, organizer, study) => {
  const normalized = copyUnits(units);
  const normalizedOrganizer = copyOrganizer(organizer);
  const normalizedStudy = copyStudy(study);
  if (!user?.uid) throw new Error("請先登入 Google 帳號。");
  if (!normalized) throw new Error("找不到可上傳的字庫內容。");
  const emptyUnits = Object.entries(normalized.units)
    .filter(([, entries]) => !entries.length)
    .map(([name]) => name);
  await set(ref(database, cloudLibraryPath(user.uid)), {
    ...normalized,
    // `null` removes an older marker when all libraries contain entries.
    emptyUnits: emptyUnits.length ? emptyUnits : null,
    updatedAt: serverTimestamp(),
    schemaVersion: 3,
    ...(normalizedOrganizer ? { organizer: normalizedOrganizer } : {}),
    ...(normalizedStudy ? { study: normalizedStudy } : {})
  });
};
