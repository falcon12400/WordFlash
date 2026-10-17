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
  const names = Object.keys(units);
  if (!names.length) return null;

  return {
    current: typeof value.current === "string" && units[value.current] ? value.current : names[0],
    units
  };
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

export const saveCloudUnits = async (user, units) => {
  const normalized = copyUnits(units);
  if (!user?.uid) throw new Error("請先登入 Google 帳號。");
  if (!normalized) throw new Error("找不到可上傳的字庫內容。");
  await set(ref(database, cloudLibraryPath(user.uid)), {
    ...normalized,
    updatedAt: serverTimestamp(),
    schemaVersion: 1
  });
};
