import * as store from './store.js';
import { loadCatalog, loadCourse } from './content.js';
import * as E from './engine.js';

const $app = document.getElementById('app');
let S = null;            // stato (progressi)
let catalog = [];
let course = null;
let tab = 'learn';
let run = null;          // sessione in corso
let codexFilter = { q: '', ch: 'all' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------------- icone ----------------
const I = {
  learn: '<svg viewBox="0 0 24 24"><path d="M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm0 13a1 1 0 0 0 0 2h11v-2H6Zm2-10v2h7V6H8Zm0 4v2h5v-2H8Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.5h4l.3-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  brain: '<svg viewBox="0 0 24 24"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm6 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2 3 3 0 0 0 4-3 3 3 0 0 0 1-5 3 3 0 0 0-2-5 3 3 0 0 0-3-3Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4-10.1 10.1Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5l-8-3Z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3 8 7l1.4 1.4L11 6.8V15h2V6.8l1.6 1.6L16 7l-4-4ZM5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9h-2v8H7v-8H5Z"/></svg>'
};

// ---------------- suoni ----------------
let actx = null;
function beep(kind) {
  if (!S || !S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [660, 880], ko: [220, 180], done: [523, 659, 784, 1047] }[kind];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'ko' ? 'square' : 'sine';
      o.frequency.value = f;
      const t = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === 'ko' ? 0.05 : 0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.18);
    });
  } catch { /* ignore */ }
}
function buzz(ms) { if (S && S.settings.haptics && navigator.vibrate) navigator.vibrate(ms); }

// ---------------- avvio ----------------
async function init() {
  const { state } = await store.loadState();
  S = state;
  S.stats = { correct: 0, answered: 0, sessions: 0, perfect: 0, ...(S.stats || {}) };
  S.blitzBest = S.blitzBest || {};
  store.requestPersistence();
  try {
    catalog = await loadCatalog();
    const id = S.settings.course && catalog.some((c) => c.id === S.settings.course) ? S.settings.course : catalog[0].id;
    await selectCourse(id, false);
  } catch (e) {
    $app.innerHTML = `<div class="fatal"><h2>Contenuti non disponibili</h2><p>${esc(e.message)}</p><p>Controlla la connessione e riapri l'app.</p><button class="btn" onclick="location.reload()">Riprova</button></div>`;
    return;
  }
  render();
}

async function selectCourse(id, rerender = true) {
  const meta = catalog.find((c) => c.id === id);
  course = await loadCourse(meta);
  course.emoji = meta.emoji;
  S.settings.course = id;
  const seen = S.seenVersions[id];
  if (seen && seen !== course.version) setTimeout(() => toast('📚 Contenuti aggiornati: nuove domande disponibili!'), 600);
  S.seenVersions[id] = course.version;
  store.saveState(S);
  if (rerender) render();
}

// ---------------- render principale ----------------
function render() {
  if (run) return renderRun();
  const views = { learn: viewLearn, codex: viewCodex, stats: viewStats, settings: viewSettings };
  $app.innerHTML = `<main class="screen" id="screen">${views[tab]()}</main>${tabbar()}`;
  bindTab();
}

function tabbar() {
  const t = (id, icon, label) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${I[icon]}<span>${label}</span></button>`;
  return `<nav class="tabbar">${t('learn', 'learn', 'Impara')}${t('codex', 'book', 'Articoli')}${t('stats', 'chart', 'Progressi')}${t('settings', 'gear', 'Profilo')}</nav>`;
}

function topbar() {
  const streak = E.liveStreak(S);
  const goal = S.goal;
  const today = S.daily.date === E.todayKey() ? S.daily.xp : 0;
  const pct = Math.min(1, today / goal);
  const multi = catalog.length > 1;
  return `<header class="top">
    <button class="course-chip" ${multi ? 'data-act="courses"' : ''}><span class="emoji">${course.emoji || '⚖️'}</span><span>${esc(course.title)}</span>${multi ? '<span class="caret">▾</span>' : ''}</button>
    <div class="top-stats">
      <span class="pill ${streak ? 'fire' : 'dim'}" title="Giorni di fila">🔥 ${streak}</span>
      <span class="ring" style="--p:${pct}" title="Obiettivo di oggi"><span>${today >= goal ? '✓' : Math.round(pct * 100) + '%'}</span></span>
    </div>
  </header>`;
}

// ---------------- IMPARA ----------------
function viewLearn() {
  const due = E.dueItems(S, course).length;
  const best = S.blitzBest[course.id] || 0;
  const cards = [];
  if (isIOS() && !isStandalone()) {
    cards.push(`<div class="card hint"><div class="hint-ico">📲</div><div><b>Installa l'app sulla Home</b><p>Tocca ${I.share.replace('<svg', '<svg class="inl"')} <b>Condividi</b> in Safari, poi <b>Aggiungi alla schermata Home</b>. Così i tuoi progressi sono protetti al massimo.</p></div></div>`);
  }
  const answered = S.stats.answered;
  const days = S.lastBackup ? (Date.now() - S.lastBackup) / 86400000 : Infinity;
  if (answered >= 30 && days > 7) {
    cards.push(`<div class="card hint warn"><div class="hint-ico">💾</div><div><b>${S.lastBackup ? 'Aggiorna il backup' : 'Fai il primo backup'}</b><p>Salva una copia dei progressi su iCloud Drive: un tocco e sei al sicuro.</p><button class="btn small" data-act="backup">Salva backup</button></div></div>`);
  }

  const chapters = course.chapters.map((ch) => chapterBlock(ch)).join('');
  return `${topbar()}
  <section class="hero-row">
    <button class="hero review" data-act="review">
      <div class="hero-ico">${I.brain}</div>
      <div class="hero-txt"><b>Ripasso intelligente</b><span>${due ? `${due} da ripassare oggi` : 'Rinforza ciò che sai'}</span></div>
      ${due ? `<span class="badge">${due > 99 ? '99+' : due}</span>` : ''}
    </button>
    <button class="hero blitz" data-act="blitz">
      <div class="hero-ico">${I.bolt}</div>
      <div class="hero-txt"><b>Sfida lampo</b><span>60 secondi${best ? ` · record ${best}` : ''}</span></div>
    </button>
  </section>
  ${cards.join('')}
  ${chapters}
  <p class="foot">Contenuti: ${esc(course.subtitle || '')}<br>versione ${esc(course.version)}</p>`;
}

function lessonState(id) { return (S.lessons[course.id] && S.lessons[course.id][id]) || { level: 0, best: 0, plays: 0 }; }

function chapterBlock(ch) {
  const lessons = course.lessons.filter((l) => l.ch === ch.id);
  const m = E.scopeMastery(S, course, { ch: ch.id });
  let prevOk = true;
  const offsets = [0, 1, 2, 1, 0, -1, -2, -1];
  const nodes = lessons.map((l, i) => {
    const ls = lessonState(l.id);
    const unlocked = prevOk;
    prevOk = ls.level >= 1;
    const lm = E.scopeMastery(S, course, { ch: ch.id, secs: l.secs });
    const cls = !unlocked ? 'locked' : ls.level >= 5 ? 'gold' : ls.level >= 1 ? 'done' : 'next';
    return `<div class="node-wrap" style="--x:${offsets[i % offsets.length]}">
      <button class="node ${cls}" data-act="lesson" data-id="${l.id}" ${unlocked ? '' : 'data-locked="1"'} style="--m:${lm.pct}">
        <span class="node-in">${!unlocked ? I.lock : ls.level >= 1 ? I.star : (i + 1)}</span>
      </button>
      <div class="node-label">${esc(l.title)}${ls.level ? `<span class="lvl">${'★'.repeat(ls.level)}${'☆'.repeat(5 - ls.level)}</span>` : ''}</div>
    </div>`;
  }).join('');
  const allDone = lessons.every((l) => lessonState(l.id).level >= 1);
  return `<section class="chapter">
    <div class="ch-head">
      <div class="ch-num">Cap. ${ch.num}</div>
      <h2>${esc(ch.title)}</h2>
      <div class="bar"><i style="width:${Math.round(m.pct * 100)}%"></i></div>
      <div class="ch-meta">${Math.round(m.pct * 100)}% padroneggiato · ${m.seen}/${m.total} elementi visti</div>
    </div>
    <div class="path">${nodes}
      <div class="node-wrap" style="--x:0">
        <button class="node trophy ${allDone ? 'next' : 'locked'}" data-act="chreview" data-ch="${ch.id}" ${allDone ? '' : 'data-locked="1"'}><span class="node-in">${I.trophy}</span></button>
        <div class="node-label">Ripasso capitolo</div>
      </div>
    </div>
  </section>`;
}

// ---------------- ARTICOLI ----------------
function viewCodex() {
  const q = codexFilter.q.trim().toLowerCase();
  const arts = [...course.articles.values()]
    .filter((a) => codexFilter.ch === 'all' || a.locs.some((l) => l.ch === codexFilter.ch))
    .filter((a) => !q || (a.ref + ' ' + a.tema + ' ' + a.desc).toLowerCase().includes(q))
    .sort((a, b) => fonteOrder(a) - fonteOrder(b) || numVal(a.ref) - numVal(b.ref));
  const chips = [`<button class="chip ${codexFilter.ch === 'all' ? 'on' : ''}" data-ch="all">Tutti</button>`,
    ...course.chapters.map((c) => `<button class="chip ${codexFilter.ch === c.id ? 'on' : ''}" data-ch="${c.id}">Cap. ${c.num}</button>`)].join('');
  const list = arts.map((a) => {
    const it = E.itemState(S, course.id, 'art:' + a.id);
    const m = E.masteryOf(it);
    const dots = [0, 1, 2, 3, 4].map((i) => `<i class="${m * 5 > i ? 'on' : ''}"></i>`).join('');
    const links = a.allLinks.map((l) => {
      const t = course.articles.get(l.to);
      return t ? `<li><b>${esc(t.ref)}</b>: ${esc(l.why)}</li>` : '';
    }).join('');
    const where = a.locs.map((l) => `Cap. ${l.chNum}, § ${esc(l.sec.replace('-p', ''))} ${esc(l.secTitle)}`).join(' · ');
    return `<details class="art">
      <summary><div class="art-ref">${esc(a.ref)}</div><div class="art-tema">${esc(a.tema)}</div><div class="dots">${dots}</div></summary>
      <div class="art-body"><p>${esc(a.desc)}</p>
      ${links ? `<div class="art-links"><span>Collegamenti</span><ul>${links}</ul></div>` : ''}
      <div class="art-where">${where}</div></div>
    </details>`;
  }).join('');
  return `${topbar()}
  <div class="codex-head">
    <input class="search" type="search" placeholder="Cerca articolo o argomento…" value="${esc(codexFilter.q)}" id="q" autocomplete="off">
    <div class="chips">${chips}</div>
    <div class="codex-count">${arts.length} articoli${codexFilter.ch !== 'all' ? ` · <button class="link" data-act="chreview" data-ch="${codexFilter.ch}">Allenati su questo capitolo →</button>` : ''}</div>
  </div>
  <div class="art-list">${list || '<p class="empty">Nessun articolo trovato.</p>'}</div>`;
}
const FONTI = ['Cost.', 'disp. prel.', 'c.c.', 'c.p.c.', 'c.p.', 'cod. cons.'];
function fonteOrder(a) { const i = FONTI.indexOf(a.fonte); return i < 0 ? 50 : i; }
function numVal(ref) { const m = ref.match(/(\d+)/); return m ? parseInt(m[1], 10) + (/-bis/.test(ref) ? 0.5 : 0) : 0; }

// ---------------- PROGRESSI ----------------
function viewStats() {
  const li = E.levelInfo(S.xp);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = E.todayKey(d);
    days.push({ k, xp: S.history[k] || 0, label: ['D', 'L', 'M', 'M', 'G', 'V', 'S'][d.getDay()] });
  }
  const max = Math.max(S.goal, ...days.map((d) => d.xp));
  const bars = days.map((d) => `<div class="day"><div class="col"><i style="height:${Math.round((d.xp / max) * 100)}%" class="${d.xp >= S.goal ? 'hit' : ''}"></i></div><span>${d.label}</span></div>`).join('');
  const chs = course.chapters.map((c) => {
    const m = E.scopeMastery(S, course, { ch: c.id });
    return `<div class="mrow"><div class="mrow-t">Cap. ${c.num} · ${esc(c.title)}</div><div class="bar"><i style="width:${Math.round(m.pct * 100)}%"></i></div><div class="mrow-n">${Math.round(m.pct * 100)}%</div></div>`;
  }).join('');
  const weak = [...course.articles.values()]
    .map((a) => ({ a, it: E.itemState(S, course.id, 'art:' + a.id) }))
    .filter((x) => x.it && x.it.ko > 0)
    .sort((x, y) => (y.it.ko - y.it.ok * 0.5) - (x.it.ko - x.it.ok * 0.5))
    .slice(0, 6)
    .map((x) => `<li><b>${esc(x.a.ref)}</b><span>${esc(x.a.tema)}</span><em>${x.it.ko}✗ ${x.it.ok}✓</em></li>`).join('');
  const learned = [...course.articles.values()].filter((a) => (E.itemState(S, course.id, 'art:' + a.id)?.b || 0) >= 3).length;
  const acc = S.stats.answered ? Math.round((S.stats.correct / S.stats.answered) * 100) : 0;
  const ach = ACH.map((a) => {
    const got = S.achievements[a.id];
    return `<div class="ach ${got ? 'got' : ''}"><div class="ach-ico">${a.icon}</div><b>${a.name}</b><span>${a.desc}</span></div>`;
  }).join('');
  return `${topbar()}
  <section class="card level">
    <div class="lvl-badge">${li.level}</div>
    <div class="lvl-txt"><b>${E.rankFor(li.level)}</b><span>Livello ${li.level} · ${S.xp} XP totali</span>
    <div class="bar gold"><i style="width:${Math.round((li.into / li.need) * 100)}%"></i></div><small>${li.need - li.into} XP al prossimo livello</small></div>
  </section>
  <section class="grid4">
    <div class="stat"><b>🔥 ${E.liveStreak(S)}</b><span>serie attuale</span></div>
    <div class="stat"><b>🏅 ${S.streak.best}</b><span>serie record</span></div>
    <div class="stat"><b>📜 ${learned}</b><span>articoli imparati</span></div>
    <div class="stat"><b>🎯 ${acc}%</b><span>precisione</span></div>
  </section>
  <section class="card"><h3>Ultimi 7 giorni</h3><div class="week">${bars}</div><small class="muted">Obiettivo giornaliero: ${S.goal} XP · salvagenti serie: ${'🧊'.repeat(S.streak.freezes) || 'nessuno'}</small></section>
  <section class="card"><h3>Padronanza per capitolo</h3>${chs}</section>
  ${weak ? `<section class="card"><h3>Articoli su cui inciampi</h3><ul class="weak">${weak}</ul><button class="btn small" data-act="review">Ripassali ora</button></section>` : ''}
  <section class="card"><h3>Traguardi</h3><div class="achs">${ach}</div></section>`;
}

// ---------------- PROFILO / IMPOSTAZIONI ----------------
function viewSettings() {
  const lb = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'mai';
  const goals = [20, 50, 100, 150].map((g) => `<button class="chip ${S.goal === g ? 'on' : ''}" data-goal="${g}">${g} XP</button>`).join('');
  return `${topbar()}
  <section class="card">
    <h3>${I.shield.replace('<svg', '<svg class="inl"')} I tuoi progressi</h3>
    <p class="muted">Salvati solo su questo iPhone, in tre copie (database, copia di riserva e istantanee automatiche). Il backup su file è la tua assicurazione se cambi telefono o cancelli Safari.</p>
    <div class="kv"><span>Archiviazione protetta</span><b id="persist">verifico…</b></div>
    <div class="kv"><span>Modalità app (Home)</span><b>${isStandalone() ? '✅ sì' : '⚠️ no, aprila dalla Home'}</b></div>
    <div class="kv"><span>Ultimo backup</span><b>${lb}</b></div>
    <div class="btn-row">
      <button class="btn" data-act="backup">💾 Salva backup</button>
      <label class="btn ghost">📂 Ripristina<input type="file" accept="application/json,.json" id="restore" hidden></label>
    </div>
  </section>
  <section class="card">
    <h3>Obiettivo giornaliero</h3>
    <div class="chips">${goals}</div>
  </section>
  <section class="card">
    <h3>Preferenze</h3>
    <label class="toggle"><span>Suoni</span><input type="checkbox" id="snd" ${S.settings.sound ? 'checked' : ''}><i></i></label>
  </section>
  <section class="card">
    <h3>Corsi disponibili</h3>
    ${catalog.map((c) => `<button class="course-row ${c.id === course.id ? 'on' : ''}" data-course="${c.id}"><span>${c.emoji || '⚖️'}</span><b>${esc(c.title)}</b>${c.id === course.id ? '<em>in uso</em>' : ''}</button>`).join('')}
    <p class="muted small">Per aggiungere un esame o nuovi capitoli carica i file a Claude: i progressi restano intatti.</p>
  </section>
  <section class="card danger">
    <h3>Zona pericolosa</h3>
    <button class="btn ghost red" data-act="reset">Azzera tutti i progressi</button>
  </section>
  <p class="foot">Quiz Giurisprudenza · fatto per studiare, articolo dopo articolo.</p>`;
}

// ---------------- eventi schede ----------------
function bindTab() {
  $app.querySelectorAll('.tab').forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
  $app.querySelectorAll('[data-act]').forEach((b) => b.onclick = (e) => act(b.dataset.act, b, e));
  const q = document.getElementById('q');
  if (q) q.oninput = () => { codexFilter.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  $app.querySelectorAll('.chip[data-ch]').forEach((b) => b.onclick = () => { codexFilter.ch = b.dataset.ch; render(); });
  $app.querySelectorAll('.chip[data-goal]').forEach((b) => b.onclick = () => { S.goal = +b.dataset.goal; store.saveState(S); render(); });
  $app.querySelectorAll('[data-course]').forEach((b) => b.onclick = () => selectCourse(b.dataset.course));
  const snd = document.getElementById('snd');
  if (snd) snd.onchange = () => { S.settings.sound = snd.checked; store.saveState(S); };
  const rs = document.getElementById('restore');
  if (rs) rs.onchange = async () => {
    const f = rs.files[0]; if (!f) return;
    try {
      const ns = await store.parseBackup(f);
      if (!confirm(`Ripristinare il backup? (${ns.xp} XP, salvato il ${new Date(ns.updatedAt).toLocaleDateString('it-IT')}). I progressi attuali verranno sostituiti.`)) return;
      S = ns; S.stats = { correct: 0, answered: 0, sessions: 0, perfect: 0, ...(S.stats || {}) }; S.blitzBest = S.blitzBest || {};
      await store.saveState(S, { immediate: true });
      toast('✅ Backup ripristinato');
      render();
    } catch (e) { toast('⚠️ ' + e.message); }
  };
  const p = document.getElementById('persist');
  if (p) store.isPersisted().then((v) => { p.textContent = v ? '✅ attiva' : 'richiesta (si attiva con l\'uso)'; });
}

async function act(a, el) {
  if (a === 'lesson') {
    if (el.dataset.locked) return toast('🔒 Completa prima la lezione precedente');
    return lessonSheet(el.dataset.id);
  }
  if (a === 'chreview') {
    if (el.dataset.locked) return toast('🏆 Si sblocca completando tutte le lezioni del capitolo');
    const ch = course.chapters.find((c) => c.id === el.dataset.ch);
    return startRun({ mode: 'lesson', scope: { ch: ch.id }, title: `Ripasso Cap. ${ch.num}`, size: 15, lessonId: 'review-' + ch.id });
  }
  if (a === 'review') return startRun({ mode: 'review', scope: { all: true }, title: 'Ripasso intelligente', size: 12 });
  if (a === 'blitz') return startRun({ mode: 'blitz', scope: { all: true }, title: 'Sfida lampo', size: 25 });
  if (a === 'backup') {
    const r = await store.exportBackup(S);
    if (r !== 'aborted') { S.lastBackup = Date.now(); unlock('backup'); store.saveState(S, { immediate: true }); toast('💾 Backup creato'); render(); }
    return;
  }
  if (a === 'reset') {
    if (!confirm('Vuoi davvero azzerare TUTTI i progressi? Ti consiglio di salvare prima un backup.')) return;
    if (!confirm('Ultima conferma: azzero tutto?')) return;
    const keep = { settings: S.settings, seenVersions: S.seenVersions };
    S = { ...store.freshState(), ...keep }; S.stats = { correct: 0, answered: 0, sessions: 0, perfect: 0 }; S.blitzBest = {};
    await store.saveState(S, { immediate: true });
    toast('Progressi azzerati'); render();
  }
  if (a === 'courses') { tab = 'settings'; render(); }
}

function lessonSheet(id) {
  const l = course.lessons.find((x) => x.id === id);
  const ch = course.chapters.find((c) => c.id === l.ch);
  const ls = lessonState(id);
  const m = E.scopeMastery(S, course, { ch: l.ch, secs: l.secs });
  const secs = l.secs.map((s) => ch.sections.find((x) => x.id === s)).filter(Boolean)
    .map((s) => `<li>§ ${esc(s.id.replace('-p', ''))} · ${esc(s.title)}</li>`).join('');
  sheet(`<div class="ls">
    <div class="ch-num">Cap. ${ch.num}</div>
    <h2>${esc(l.title)}</h2>
    <ul class="secs">${secs}</ul>
    <div class="ls-stats"><div><b>${'★'.repeat(ls.level)}${'☆'.repeat(5 - ls.level)}</b><span>livello</span></div><div><b>${Math.round(m.pct * 100)}%</b><span>padronanza</span></div><div><b>${m.total}</b><span>elementi</span></div></div>
    <button class="btn big" id="go">${ls.level ? 'Allenati ancora' : 'Inizia'} · +${10 * 10 + 10} XP</button>
  </div>`, (root) => {
    root.querySelector('#go').onclick = () => { closeSheet(); startRun({ mode: 'lesson', scope: { ch: l.ch, secs: l.secs }, title: l.title, size: 10, lessonId: id }); };
  });
}

// ---------------- sessione di gioco ----------------
function startRun(opts) {
  const qs = E.buildSession(S, course, opts);
  if (!qs.length) return toast('Nessuna domanda disponibile qui per ora');
  run = { ...opts, queue: qs, idx: 0, retry: [], correct: 0, answered: 0, xp: 0, combo: 0, maxCombo: 0,
    mistakes: [], start: Date.now(), done: false, deadline: opts.mode === 'blitz' ? Date.now() + 60000 : 0, retried: new Set() };
  render();
  if (run.deadline) tickBlitz();
}

function tickBlitz() {
  if (!run || run.mode !== 'blitz') return;
  const left = Math.max(0, run.deadline - Date.now());
  const el = document.getElementById('timer');
  if (el) { el.textContent = Math.ceil(left / 1000) + 's'; el.classList.toggle('hurry', left < 10000); }
  const bar = document.getElementById('tbar');
  if (bar) bar.style.width = (left / 600) + '%';
  if (left <= 0) { finishRun(); return; }
  run.timer = setTimeout(tickBlitz, 250);
}

function renderRun() {
  if (run.done) return renderResult();
  const q = run.queue[run.idx];
  if (!q) return finishRun();
  const total = run.mode === 'blitz' ? 0 : run.queue.length;
  const prog = total ? (run.idx / total) * 100 : 0;
  const head = run.mode === 'blitz'
    ? `<div class="pbar"><i id="tbar" style="width:100%"></i></div><span class="timer" id="timer">60s</span><span class="score">✓ ${run.correct}</span>`
    : `<div class="pbar"><i style="width:${prog}%"></i></div>${run.combo >= 3 ? `<span class="combo">🔥${run.combo}</span>` : ''}`;
  $app.innerHTML = `<div class="run">
    <header class="run-top"><button class="x" id="quit">${I.close}</button>${head}</header>
    <div class="q" id="q">${questionHTML(q)}</div>
    <div class="feedback" id="fb"></div>
  </div>`;
  document.getElementById('quit').onclick = () => {
    if (run.answered && run.mode !== 'blitz' && !confirm('Uscire dalla lezione? Le risposte date finora restano salvate.')) return;
    clearTimeout(run.timer); run = null; render();
  };
  bindQuestion(q);
  if (run.mode === 'blitz') tickBlitz();
}

const KIND_LABEL = { mc: 'Scegli la risposta', tf: 'Vero o falso', match: 'Abbinamenti', seq: 'Metti in ordine' };
const TPL_LABEL = { artToTema: 'Articolo → argomento', temaToArt: 'Argomento → articolo', descToArt: 'Riconosci l\'articolo', link: 'Collegamenti', odd: 'Trova l\'intruso', cxSort: 'Classifica', cxOdd: 'Trova l\'intruso', conDef: 'Concetti', defCon: 'Concetti', artTF: 'Vero o falso', conTF: 'Vero o falso', tf: 'Tranelli d\'esame', match: 'Abbinamenti', conMatch: 'Abbinamenti', seq: 'Metti in ordine' };

function questionHTML(q) {
  const tag = `<div class="q-kind">${TPL_LABEL[q.template] || KIND_LABEL[q.type]}</div>`;
  const ref = q.refLabel ? `<div class="q-ref">${esc(q.refLabel)}</div>` : '';
  const title = q.title ? `<div class="q-title">${esc(q.title)}</div>` : '';
  const quote = q.quote ? `<blockquote class="q-quote">${esc(q.quote)}</blockquote>` : '';
  const prompt = `<h2 class="q-prompt">${esc(q.prompt)}</h2>`;
  if (q.type === 'mc') {
    const opts = q.options.map((o, i) => `<button class="opt ${o.big ? 'big' : ''} ${o.small ? 'small' : ''}" data-i="${i}"><span class="k">${'ABCD'[i] || ''}</span><span class="t">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span></button>`).join('');
    return `${tag}${title}${prompt}${ref}${quote}<div class="opts">${opts}</div>`;
  }
  if (q.type === 'tf') {
    return `${tag}${title}${prompt}${quote}<div class="tf"><button class="opt tfb" data-v="1">✓ Vero</button><button class="opt tfb" data-v="0">✗ Falso</button></div>`;
  }
  if (q.type === 'match') {
    const left = E.shuffle(q.pairs).map((p) => `<button class="m-item" data-side="l" data-id="${esc(p.id)}">${esc(p.left)}</button>`).join('');
    const right = E.shuffle(q.pairs).map((p) => `<button class="m-item ${q.small ? 'small' : ''}" data-side="r" data-id="${esc(p.id)}">${esc(p.right)}</button>`).join('');
    return `${tag}${prompt}<div class="match"><div class="m-col">${left}</div><div class="m-col">${right}</div></div>`;
  }
  if (q.type === 'seq') {
    const pool = q.shuffled.map((s, i) => `<button class="s-item" data-i="${i}">${esc(s)}</button>`).join('');
    return `${tag}${title}${prompt}<ol class="s-answer" id="sa"></ol><div class="s-pool" id="sp">${pool}</div><button class="btn big" id="scheck" disabled>Controlla</button>`;
  }
  return '';
}

function bindQuestion(q) {
  const root = document.getElementById('q');
  if (q.type === 'mc') {
    root.querySelectorAll('.opt').forEach((b) => b.onclick = () => {
      if (root.dataset.locked) return;
      root.dataset.locked = '1';
      const o = q.options[+b.dataset.i];
      root.querySelectorAll('.opt').forEach((x, i) => { if (q.options[i].ok) x.classList.add('right'); });
      if (!o.ok) b.classList.add('wrong');
      answer(q, o.ok, o.ok ? null : q.options.find((x) => x.ok).label);
    });
  }
  if (q.type === 'tf') {
    root.querySelectorAll('.tfb').forEach((b) => b.onclick = () => {
      if (root.dataset.locked) return;
      root.dataset.locked = '1';
      const v = b.dataset.v === '1';
      const ok = v === q.answer;
      root.querySelectorAll('.tfb').forEach((x) => { if ((x.dataset.v === '1') === q.answer) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      answer(q, ok, ok ? null : (q.answer ? 'Vero' : 'Falso'));
    });
  }
  if (q.type === 'match') {
    let sel = null;
    const bad = new Set();
    let matched = 0;
    root.querySelectorAll('.m-item').forEach((b) => b.onclick = () => {
      if (b.classList.contains('ok')) return;
      if (!sel || sel.dataset.side === b.dataset.side) {
        if (sel) sel.classList.remove('sel');
        sel = b; b.classList.add('sel'); return;
      }
      if (sel.dataset.id === b.dataset.id) {
        sel.classList.remove('sel'); sel.classList.add('ok'); b.classList.add('ok');
        matched++; beep('ok'); sel = null;
        if (matched === q.pairs.length) {
          const results = q.pairs.map((p) => ({ key: q.items[q.pairs.indexOf(p)], ok: !bad.has(p.id) }));
          answerMulti(q, results);
        }
      } else {
        bad.add(sel.dataset.id); bad.add(b.dataset.id);
        const a = sel, c = b; a.classList.add('no'); c.classList.add('no'); buzz(60);
        setTimeout(() => { a.classList.remove('no', 'sel'); c.classList.remove('no'); }, 450);
        sel = null;
      }
    });
  }
  if (q.type === 'seq') {
    const order = [];
    const sa = root.querySelector('#sa'), sp = root.querySelector('#sp'), chk = root.querySelector('#scheck');
    const redraw = () => {
      sa.innerHTML = order.map((i, n) => `<li data-n="${n}">${esc(q.shuffled[i])}</li>`).join('');
      sp.querySelectorAll('.s-item').forEach((b) => b.classList.toggle('used', order.includes(+b.dataset.i)));
      chk.disabled = order.length !== q.shuffled.length;
      sa.querySelectorAll('li').forEach((li) => li.onclick = () => { if (root.dataset.locked) return; order.splice(+li.dataset.n, 1); redraw(); });
    };
    sp.querySelectorAll('.s-item').forEach((b) => b.onclick = () => { if (root.dataset.locked || order.includes(+b.dataset.i)) return; order.push(+b.dataset.i); redraw(); });
    chk.onclick = () => {
      root.dataset.locked = '1';
      const given = order.map((i) => q.shuffled[i]);
      const ok = given.every((v, i) => v === q.steps[i]);
      sa.querySelectorAll('li').forEach((li, i) => li.classList.add(given[i] === q.steps[i] ? 'right' : 'wrong'));
      chk.remove();
      answer(q, ok, null);
    };
  }
}

function answerMulti(q, results) {
  const allOk = results.every((r) => r.ok);
  for (const r of results) E.applyResult(S, course.id, r.key, r.ok);
  scoreAnswer(q, allOk, results.filter((r) => r.ok).length, results.length);
  showFeedback(q, allOk, null, allOk ? 'Abbinamenti perfetti!' : 'Completato, con qualche errore');
}

function answer(q, ok, correctLabel) {
  for (const k of q.items) E.applyResult(S, course.id, k, ok);
  scoreAnswer(q, ok, ok ? 1 : 0, 1);
  showFeedback(q, ok, correctLabel);
}

function scoreAnswer(q, ok, good, total) {
  run.answered++;
  S.stats.answered += total;
  S.stats.correct += good;
  if (ok) {
    run.correct++; run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
    const gain = run.mode === 'blitz' ? 5 : 10 + (run.combo >= 3 ? Math.min(10, (run.combo - 2) * 2) : 0);
    run.xp += gain; E.addXP(S, gain);
    beep('ok'); buzz(15);
  } else {
    run.combo = 0;
    run.mistakes.push(q);
    if (!q.isRetry) run.firstMistakes = (run.firstMistakes || 0) + 1;
    if (run.mode !== 'blitz' && !run.retried.has(q)) { run.retried.add(q); run.retry.push(q); }
    beep('ko'); buzz([40, 40, 40]);
  }
  store.saveState(S);
}

function showFeedback(q, ok, correctLabel, customHead) {
  const fb = document.getElementById('fb');
  const ex = q.explain;
  if (run.mode === 'blitz') {
    fb.className = `feedback show mini ${ok ? 'ok' : 'ko'}`;
    fb.innerHTML = `<b>${ok ? 'Esatto!' : 'No: ' + esc(correctLabel || '')}</b>`;
    setTimeout(next, ok ? 450 : 1100);
    return;
  }
  const praise = E.pick(['Esatto!', 'Perfetto!', 'Bravo!', 'Ottimo!', 'Giusto!', 'Da 30!']);
  fb.className = `feedback show ${ok ? 'ok' : 'ko'}`;
  fb.innerHTML = `<div class="fb-in">
    <div class="fb-head">${ok ? I.check : I.close}<b>${esc(customHead || (ok ? praise : 'Non proprio…'))}</b></div>
    ${!ok && correctLabel ? `<div class="fb-correct">Risposta giusta: <b>${esc(correctLabel)}</b></div>` : ''}
    ${ex ? `<div class="fb-ex"><b>${esc(ex.head)}</b><p>${esc(ex.body).replace(/\n/g, '<br>')}</p></div>` : ''}
    <button class="btn big ${ok ? '' : 'red'}" id="next">Continua</button>
  </div>`;
  document.getElementById('next').onclick = next;
}

function next() {
  if (!run) return;
  run.idx++;
  if (run.mode === 'blitz') {
    if (run.idx >= run.queue.length) {
      const more = E.buildSession(S, course, { mode: 'blitz', scope: { all: true }, size: 20 });
      run.queue.push(...more);
    }
    if (Date.now() >= run.deadline) return finishRun();
  } else if (run.idx >= run.queue.length && run.retry.length) {
    run.queue.push(...run.retry.map((q) => rebuild(q)));
    run.retry = [];
  }
  if (run.idx >= run.queue.length) return finishRun();
  renderRun();
}

// Una domanda sbagliata torna alla fine della lezione, con opzioni rimescolate
function rebuild(q) {
  const c = JSON.parse(JSON.stringify(q));
  if (c.options) c.options = E.shuffle(c.options);
  if (c.shuffled) c.shuffled = E.shuffle(c.shuffled);
  c.isRetry = true;
  return c;
}

function finishRun() {
  if (!run || run.done) return;
  clearTimeout(run.timer);
  run.done = true;
  S.stats.sessions++;
  const firstPass = run.mode === 'blitz' ? run.answered : run.queue.filter((q) => !q.isRetry).length;
  const perfect = run.mode !== 'blitz' && !run.firstMistakes && run.answered > 0;
  let bonus = 0;
  if (run.mode !== 'blitz' && run.answered) bonus += 10;
  if (perfect) { bonus += 10; S.stats.perfect++; unlock('perfect'); }
  if (bonus) { E.addXP(S, bonus); run.xp += bonus; }
  run.bonus = bonus;
  run.firstPass = firstPass;
  if (run.lessonId && run.answered) {
    if (!S.lessons[course.id]) S.lessons[course.id] = {};
    const ls = S.lessons[course.id][run.lessonId] || { level: 0, best: 0, plays: 0 };
    ls.plays++; ls.level = Math.min(5, ls.level + 1);
    S.lessons[course.id][run.lessonId] = ls;
  }
  if (run.mode === 'blitz') {
    run.newRecord = run.correct > (S.blitzBest[course.id] || 0);
    if (run.newRecord) S.blitzBest[course.id] = run.correct;
    if (run.correct >= 15) unlock('blitz15');
  }
  run.streak = run.answered ? E.touchStreak(S) : { changed: false };
  checkAchievements();
  store.saveState(S, { immediate: true });
  beep('done');
  renderResult();
}

function renderResult() {
  const r = run;
  const accFirst = r.mode === 'blitz' ? (r.answered ? Math.round((r.correct / r.answered) * 100) : 0)
    : Math.max(0, Math.round(((r.firstPass - (r.firstMistakes || 0)) / Math.max(1, r.firstPass)) * 100));
  const secs = Math.round((Date.now() - r.start) / 1000);
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const title = r.mode === 'blitz' ? (r.newRecord ? 'Nuovo record! 🏆' : 'Tempo scaduto!')
    : accFirst === 100 ? 'Lezione perfetta! 🎉' : accFirst >= 70 ? 'Lezione completata! 💪' : 'Lezione completata';
  const streakMsg = r.streak.changed ? `<div class="r-streak">🔥 Serie: ${S.streak.count} ${S.streak.count === 1 ? 'giorno' : 'giorni'}${r.streak.usedFreeze ? ' (salvata con un 🧊)' : ''}${r.streak.earnedFreeze ? ' · hai guadagnato un 🧊 salvagente!' : ''}</div>` : '';
  const goalHit = S.daily.xp >= S.goal && S.daily.xp - r.xp < S.goal;
  const mistakes = uniqMistakes(r.mistakes).slice(0, 6).map((q) => q.explain ? `<li><b>${esc(q.explain.head)}</b><span>${esc(q.explain.body)}</span></li>` : '').join('');
  const newAch = (r.newAch || []).map((a) => `<div class="r-ach">${a.icon} Traguardo sbloccato: <b>${a.name}</b></div>`).join('');
  $app.innerHTML = `<div class="result">
    <div class="confetti" aria-hidden="true">${confetti(accFirst)}</div>
    <h1>${title}</h1>
    <p class="r-sub">${esc(r.title)}</p>
    <div class="r-cards">
      <div class="r-card xp"><span>XP</span><b>+${r.xp}</b></div>
      <div class="r-card acc"><span>${r.mode === 'blitz' ? 'Risposte giuste' : 'Precisione'}</span><b>${r.mode === 'blitz' ? r.correct : accFirst + '%'}</b></div>
      <div class="r-card time"><span>${r.mode === 'blitz' ? 'Record' : 'Tempo'}</span><b>${r.mode === 'blitz' ? (S.blitzBest[course.id] || 0) : mm}</b></div>
    </div>
    ${streakMsg}
    ${goalHit ? '<div class="r-goal">🎯 Obiettivo di oggi raggiunto!</div>' : ''}
    ${newAch}
    ${mistakes ? `<details class="r-mist"><summary>Ripassa gli errori (${uniqMistakes(r.mistakes).length})</summary><ul>${mistakes}</ul></details>` : ''}
    <div class="r-actions">
      <button class="btn big" id="cont">Continua</button>
      <button class="btn ghost" id="again">${r.mode === 'blitz' ? 'Riprova' : 'Rifai con domande nuove'}</button>
    </div>
  </div>`;
  document.getElementById('cont').onclick = () => { run = null; render(); window.scrollTo(0, 0); };
  document.getElementById('again').onclick = () => { const o = { mode: r.mode, scope: r.scope, title: r.title, size: r.size, lessonId: r.lessonId }; run = null; startRun(o); };
}
function uniqMistakes(list) { const s = new Set(); return list.filter((q) => { const k = q.explain ? q.explain.head : q.prompt; if (s.has(k)) return false; s.add(k); return true; }); }
function confetti(acc) {
  const n = acc >= 90 ? 40 : acc >= 60 ? 22 : 0;
  const cols = ['#f5b301', '#58cc02', '#1cb0f6', '#ff4b4b', '#a560e8'];
  let h = '';
  for (let i = 0; i < n; i++) h += `<i style="left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random()}s;transform:rotate(${Math.random() * 360}deg)"></i>`;
  return h;
}

// ---------------- traguardi ----------------
const ACH = [
  { id: 'first', icon: '🎓', name: 'Primo passo', desc: 'Completa la prima lezione' },
  { id: 'perfect', icon: '💎', name: 'Da 30 e lode', desc: 'Una lezione senza errori' },
  { id: 'streak3', icon: '🔥', name: 'Costanza', desc: '3 giorni di fila' },
  { id: 'streak7', icon: '📅', name: 'Una settimana', desc: '7 giorni di fila' },
  { id: 'streak30', icon: '🏛️', name: 'Inarrestabile', desc: '30 giorni di fila' },
  { id: 'c100', icon: '✅', name: 'Cento', desc: '100 risposte giuste' },
  { id: 'c500', icon: '📚', name: 'Secchione', desc: '500 risposte giuste' },
  { id: 'chapter', icon: '🏆', name: 'Capitolo chiuso', desc: 'Completa tutte le lezioni di un capitolo' },
  { id: 'art25', icon: '📜', name: 'Codice in tasca', desc: '25 articoli imparati' },
  { id: 'blitz15', icon: '⚡', name: 'Fulmine', desc: '15 risposte in una sfida lampo' },
  { id: 'backup', icon: '💾', name: 'Previdente', desc: 'Salva il primo backup' }
];
function unlock(id) {
  if (S.achievements[id]) return;
  S.achievements[id] = Date.now();
  const a = ACH.find((x) => x.id === id);
  if (run && a) (run.newAch = run.newAch || []).push(a);
  else if (a) toast(`${a.icon} Traguardo: ${a.name}`);
}
function checkAchievements() {
  if (S.stats.sessions >= 1) unlock('first');
  const st = S.streak.count;
  if (st >= 3) unlock('streak3');
  if (st >= 7) unlock('streak7');
  if (st >= 30) unlock('streak30');
  if (S.stats.correct >= 100) unlock('c100');
  if (S.stats.correct >= 500) unlock('c500');
  for (const ch of course.chapters) {
    const ls = course.lessons.filter((l) => l.ch === ch.id);
    if (ls.length && ls.every((l) => lessonState(l.id).level >= 1)) unlock('chapter');
  }
  const learned = [...course.articles.values()].filter((a) => (E.itemState(S, course.id, 'art:' + a.id)?.b || 0) >= 3).length;
  if (learned >= 25) unlock('art25');
}

// ---------------- UI helper ----------------
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

function sheet(html, bind) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg"></div><div class="sheet"><div class="grip"></div>${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  wrap.querySelector('.sheet-bg').onclick = closeSheet;
  bind && bind(wrap);
}
function closeSheet() {
  document.querySelectorAll('.sheet-wrap').forEach((w) => { w.classList.remove('show'); setTimeout(() => w.remove(), 250); });
}

// ---------------- service worker ----------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller && !run) toast('✨ App aggiornata: riaprila per la nuova versione');
        });
      });
    }).catch(() => {});
  });
}

init();
