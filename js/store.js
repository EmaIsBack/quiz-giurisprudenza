// Salvataggio dei progressi: IndexedDB (principale) + localStorage (copia) + snapshot di sicurezza.
// I progressi non dipendono mai dai contenuti: sono legati agli ID stabili degli elementi.

const DB_NAME = 'quiz-giurisprudenza';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'qg-state';
const SNAP_KEYS = ['snap-0', 'snap-1', 'snap-2'];

export const SCHEMA = 1;

export function freshState() {
  const now = Date.now();
  return {
    schema: SCHEMA,
    createdAt: now,
    updatedAt: now,
    xp: 0,
    streak: { count: 0, best: 0, last: null, freezes: 1 },
    daily: { date: null, xp: 0 },
    goal: 50,
    history: {},          // 'YYYY-MM-DD' -> xp
    items: {},            // courseId -> itemId -> { b, due, seen, ok, ko, last }
    lessons: {},          // courseId -> lessonId -> { level, best, plays }
    achievements: {},     // id -> timestamp
    settings: { sound: true, haptics: true },
    lastBackup: null,
    lastSnapshot: 0,
    seenVersions: {}      // courseId -> versione contenuti vista
  };
}

let dbPromise = null;
function openDB() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}

function lsGet() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function lsSet(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

function valid(s) {
  return s && typeof s === 'object' && typeof s.xp === 'number' && s.items && typeof s.items === 'object';
}

// Completa uno stato vecchio con i campi nuovi, senza perdere nulla.
export function migrate(s) {
  const base = freshState();
  const out = { ...base, ...s };
  out.streak = { ...base.streak, ...(s.streak || {}) };
  out.daily = { ...base.daily, ...(s.daily || {}) };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  for (const k of ['history', 'items', 'lessons', 'achievements', 'seenVersions']) {
    out[k] = s[k] && typeof s[k] === 'object' ? s[k] : {};
  }
  out.schema = SCHEMA;
  return out;
}

export async function loadState() {
  const candidates = [];
  const a = await idbGet(KEY); if (valid(a)) candidates.push(a);
  const b = lsGet(); if (valid(b)) candidates.push(b);
  if (!candidates.length) {
    // Ultima spiaggia: gli snapshot
    for (const k of SNAP_KEYS) { const s = await idbGet(k); if (valid(s)) candidates.push(s); }
  }
  if (!candidates.length) return { state: freshState(), restored: false };
  candidates.sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
  return { state: migrate(candidates[0]), restored: true };
}

let saveTimer = null;
let pending = null;

export function saveState(state, { immediate = false } = {}) {
  state.updatedAt = Date.now();
  pending = state;
  lsSet(state); // sincrono: sopravvive anche se l'app viene chiusa subito
  clearTimeout(saveTimer);
  if (immediate) return flush();
  saveTimer = setTimeout(flush, 400);
  return Promise.resolve();
}

export async function flush() {
  if (!pending) return;
  const s = pending; pending = null;
  await idbSet(KEY, s);
  // Snapshot a rotazione, al massimo uno ogni 6 ore
  if (Date.now() - (s.lastSnapshot || 0) > 6 * 3600 * 1000) {
    s.lastSnapshot = Date.now();
    const slot = SNAP_KEYS[Math.floor(Date.now() / (6 * 3600 * 1000)) % SNAP_KEYS.length];
    await idbSet(slot, JSON.parse(JSON.stringify(s)));
    lsSet(s);
    await idbSet(KEY, s);
  }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', () => flush());

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return false;
}

export async function isPersisted() {
  try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch { return false; }
}

// ---------- Backup su file ----------

export function backupBlob(state) {
  const payload = { app: 'quiz-giurisprudenza', exportedAt: new Date().toISOString(), state };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export function backupFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `backup-quiz-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export async function exportBackup(state) {
  const blob = backupBlob(state);
  const name = backupFileName();
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup Quiz Giurisprudenza' });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'aborted';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export async function parseBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const s = data && data.state ? data.state : data;
  if (!valid(s)) throw new Error('File non valido');
  return migrate(s);
}
