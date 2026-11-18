// Motore: ripetizione dilazionata (Leitner) + generazione di domande sempre diverse.

const DAY = 86400000;
// Intervalli per box 0..6 (in giorni)
const INTERVALS = [0, 0.25, 1, 3, 7, 16, 35];
export const MAX_BOX = 6;

// ---------- utilità ----------
export const rnd = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[rnd(arr.length)];
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }
const uniqBy = (arr, f) => { const s = new Set(); return arr.filter((x) => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; }); };

// ---------- stato degli elementi ----------
export function itemState(state, courseId, key) {
  return (state.items[courseId] && state.items[courseId][key]) || null;
}

export function applyResult(state, courseId, key, correct) {
  if (!state.items[courseId]) state.items[courseId] = {};
  const now = Date.now();
  const it = state.items[courseId][key] || { b: 0, due: 0, seen: 0, ok: 0, ko: 0, last: 0 };
  it.seen++;
  it.last = now;
  if (correct) {
    it.ok++;
    it.b = Math.min(MAX_BOX, it.b + 1);
  } else {
    it.ko++;
    it.b = it.b >= 4 ? 2 : 1;
  }
  // un po' di variazione per non far scadere tutto lo stesso giorno
  const jitter = 1 + (Math.random() * 0.2 - 0.1);
  it.due = now + INTERVALS[it.b] * DAY * jitter;
  state.items[courseId][key] = it;
  return it;
}

export function masteryOf(it) {
  if (!it) return 0;
  return Math.min(1, it.b / 5);
}

// ---------- elementi di un ambito ----------
function inScope(locs, scope) {
  if (!scope || scope.all) return true;
  if (scope.chs) return locs.some((l) => scope.chs.includes(l.ch));
  return locs.some((l) => l.ch === scope.ch && (!scope.secs || scope.secs.includes(l.sec)));
}

export function scopeItems(course, scope) {
  const out = [];
  for (const a of course.articles.values()) if (inScope(a.locs, scope)) out.push({ key: 'art:' + a.id, kind: 'art', ref: a });
  for (const c of course.concepts.values()) if (inScope(c.locs, scope)) out.push({ key: 'con:' + c.id, kind: 'con', ref: c });
  for (const x of course.contrasts.values()) if (inScope(x.locs, scope)) {
    x.facts.forEach((f, i) => out.push({ key: `cx:${x.id}:${i}`, kind: 'cx', ref: x, fact: i }));
  }
  for (const t of course.truefalse.values()) if (inScope(t.locs, scope)) out.push({ key: 'tf:' + t.id, kind: 'tf', ref: t });
  for (const s of course.sequences.values()) if (inScope(s.locs, scope)) out.push({ key: 'seq:' + s.id, kind: 'seq', ref: s });
  for (const c of course.cases.values()) if (inScope(c.locs, scope)) out.push({ key: 'case:' + c.id, kind: 'case', ref: c });
  return out;
}

export function scopeMastery(state, course, scope) {
  const items = scopeItems(course, scope);
  if (!items.length) return { pct: 0, seen: 0, total: 0, due: 0 };
  let sum = 0, seen = 0, due = 0;
  const now = Date.now();
  for (const i of items) {
    const it = itemState(state, course.id, i.key);
    sum += masteryOf(it);
    if (it) { seen++; if (it.due <= now) due++; }
  }
  return { pct: sum / items.length, seen, total: items.length, due };
}

export function dueItems(state, course) {
  const now = Date.now();
  return scopeItems(course, { all: true }).filter((i) => {
    const it = itemState(state, course.id, i.key);
    return it && it.due <= now;
  });
}

// Priorità: mai visti, scaduti, deboli. Con una componente casuale per la varietà.
function priority(state, course, item) {
  const it = itemState(state, course.id, item.key);
  const now = Date.now();
  let p = Math.random() * 2.5;
  if (!it) p += 4;
  else {
    if (it.due <= now) p += 3 + Math.min(3, (now - it.due) / DAY);
    p += (MAX_BOX - it.b) * 0.8;
    if (it.ko > it.ok) p += 1.5;
  }
  return p;
}

// ---------- costruzione della sessione ----------
// mode: 'lesson' | 'review' | 'blitz'
export function buildSession(state, course, { scope, mode = 'lesson', size = 10 }) {
  let pool = scopeItems(course, scope);
  if (mode === 'review') {
    const due = dueItems(state, course);
    pool = due.length >= 4 ? due : scopeItems(course, { all: true }).filter((i) => itemState(state, course.id, i.key));
    if (pool.length < 4) pool = scopeItems(course, { all: true });
  }
  if (mode === 'blitz') pool = pool.filter((i) => i.kind !== 'seq');

  const ranked = pool.map((i) => ({ i, p: priority(state, course, i) })).sort((a, b) => b.p - a.p).map((x) => x.i);
  // Gli articoli sono il cuore del gioco: almeno metà della sessione, se disponibili
  const artQuota = Math.ceil(size * 0.55);
  const arts = ranked.filter((i) => i.kind === 'art').slice(0, artQuota);
  // Casi pratici: 2-3 per sessione, perché gli esempi aiutano a capire
  const cases = ranked.filter((i) => i.kind === 'case').slice(0, Math.max(2, Math.round(size * 0.25)));
  const others = ranked.filter((i) => !arts.includes(i) && !cases.includes(i));
  const merged = [];
  let turn = 0;
  while (arts.length || others.length || cases.length) {
    if (arts.length) merged.push(arts.shift());
    if (turn++ % 2 === 0 && cases.length) merged.push(cases.shift());
    else if (others.length) merged.push(others.shift());
    else if (cases.length) merged.push(cases.shift());
  }
  // Al massimo 2 fatti dello stesso confronto e 1 sequenza per sessione
  const perCx = {};
  let seqCount = 0;
  const chosen = [];
  for (const it of merged) {
    if (chosen.length >= size * 2) break;
    if (it.kind === 'cx') { perCx[it.ref.id] = (perCx[it.ref.id] || 0) + 1; if (perCx[it.ref.id] > 2) continue; }
    if (it.kind === 'seq') { if (++seqCount > 1) continue; }
    chosen.push(it);
  }

  const ctx = makeCtx(course, scope);
  const questions = [];
  const used = new Set();
  let matchUsed = mode === 'blitz';
  let lastType = '';
  for (const it of chosen) {
    if (questions.length >= size) break;
    if (used.has(it.key)) continue;
    let q = null;
    for (let tries = 0; tries < 4 && !q; tries++) {
      q = makeQuestion(ctx, it, { mode, allowMatch: !matchUsed, avoid: lastType });
    }
    if (!q) continue;
    if (q.type === 'match') matchUsed = true;
    q.items.forEach((k) => used.add(k));
    lastType = q.template;
    questions.push(q);
  }
  return shuffle(questions).sort((a, b) => (a.type === 'seq') - (b.type === 'seq'));
}

function makeCtx(course, scope) {
  const arts = [...course.articles.values()];
  const local = arts.filter((a) => inScope(a.locs, scope));
  const chScope = scope && scope.ch ? { ch: scope.ch } : scope && scope.chs ? { chs: scope.chs } : { all: true };
  const chapter = arts.filter((a) => inScope(a.locs, chScope));
  const cons = [...course.concepts.values()];
  return {
    course, arts, local, chapter, cons,
    consLocal: cons.filter((c) => inScope(c.locs, chScope)),
    linked: (a) => new Set([a.id, ...a.allLinks.map((l) => l.to)])
  };
}

// Distrattori per un articolo: non collegati, preferibilmente vicini (stesso capitolo/stessa fonte)
function artDistractors(ctx, a, n, { sameFonte = false } = {}) {
  const ban = ctx.linked(a);
  const ok = (x) => !ban.has(x.id) && x.tema !== a.tema;
  let pool = [];
  if (sameFonte) pool.push(...shuffle(ctx.arts.filter((x) => ok(x) && x.fonte === a.fonte)).slice(0, n));
  pool.push(...shuffle(ctx.chapter.filter(ok)));
  pool.push(...shuffle(ctx.arts.filter(ok)));
  pool = uniqBy(pool, (x) => x.id);
  if (sameFonte) {
    // mescola: metà stessa fonte, metà dal capitolo
    const same = pool.filter((x) => x.fonte === a.fonte).slice(0, Math.ceil(n / 2) + (Math.random() < 0.5 ? 1 : 0));
    const rest = pool.filter((x) => !same.includes(x));
    pool = [...same, ...rest];
  }
  return pool.slice(0, n);
}

function conDistractors(ctx, c, n) {
  const pool = uniqBy([...shuffle(ctx.consLocal), ...shuffle(ctx.cons)].filter((x) => x.id !== c.id && x.term !== c.term), (x) => x.id);
  return pool.slice(0, n);
}

function numOf(ref) {
  const m = ref.match(/Art\.\s*([\d]+(?:-[a-z]+)?)/i);
  return m ? m[1] : null;
}

const P = {
  artToTema: ['Di cosa parla l\'{ref}?', 'Che cosa disciplina l\'{ref}?', '{ref}: qual è l\'argomento?', 'Se ti dico {ref}, a cosa pensi?'],
  temaToArt: ['Quale articolo riguarda: «{tema}»?', 'Dove trovi la disciplina: «{tema}»?', 'Qual è il numero giusto per: «{tema}»?', '«{tema}»: quale articolo?'],
  descToArt: ['Quale articolo prevede che…', 'Di quale articolo si tratta?', 'Riconosci l\'articolo?'],
  artTF: ['Vero o falso? L\'{ref} riguarda: «{tema}»', 'Vero o falso? «{tema}» è la materia dell\'{ref}'],
  link: ['Quale articolo va letto insieme all\'{ref}?', 'Quale articolo è collegato all\'{ref}?', 'Fai il collegamento: con quale articolo si lega l\'{ref}?'],
  odd: ['Tre di questi riguardano {tag}. Trova l\'intruso', 'Quale NON riguarda {tag}?', 'Elimina l\'intruso: gli altri riguardano {tag}'],
  conDef: ['Che cos\'è: {term}?', 'Definisci: {term}', '{term} significa…'],
  defCon: ['Come si chiama?', 'Di quale concetto si parla?', 'Dai il nome giusto'],
  conTF: ['Vero o falso? {term}: «{def}»'],
  cxSort: ['{title}', 'A quale si riferisce?', 'Classifica'],
  cxOdd: ['Quale NON si riferisce a: {col}?', 'Trova l\'intruso: gli altri riguardano «{col}»'],
  tf: ['Vero o falso?', 'Vero o falso: attento al tranello!', 'Giusto o sbagliato?']
};
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

function mcq({ template, prompt, quote, options, correct, explain, items, title, refLabel }) {
  const opts = shuffle(options.map((o, i) => ({ ...o, ok: i === correct })));
  return { type: 'mc', template, prompt, quote, title, refLabel, options: opts, explain, items };
}

function artExplain(a) {
  return { head: `${a.ref}: ${a.tema}`, body: a.desc, es: a.es };
}

function makeQuestion(ctx, item, { mode, allowMatch, avoid }) {
  const blitz = mode === 'blitz';
  if (item.kind === 'art') {
    const a = item.ref;
    const opts = [];
    const desc = a.desc || '';
    const num = numOf(a.ref);
    const descSafe = desc && num && !new RegExp(`\\b${num.replace('-', '\\-')}\\b`).test(desc);
    const types = ['artToTema', 'artToTema', 'temaToArt', 'temaToArt', 'artTF'];
    if (descSafe) types.push('descToArt');
    if (!blitz && a.allLinks.length) types.push('link', 'link');
    if (!blitz && a.tags.some((t) => ctx.arts.filter((x) => x.tags.includes(t)).length >= 3)) types.push('odd');
    if (allowMatch && ctx.local.length >= 4) types.push('match');
    let t = pick(types);
    if (t === avoid && types.length > 1) t = pick(types.filter((x) => x !== avoid));

    if (t === 'artToTema') {
      const ds = artDistractors(ctx, a, 3);
      if (ds.length < 3) return null;
      return mcq({ template: t, prompt: fill(pick(P.artToTema), { ref: a.ref }), refLabel: a.ref,
        options: [{ label: a.tema }, ...ds.map((d) => ({ label: d.tema }))], correct: 0,
        explain: artExplain(a), items: [item.key] });
    }
    if (t === 'temaToArt' || t === 'descToArt') {
      const ds = artDistractors(ctx, a, 3, { sameFonte: true });
      if (ds.length < 3) return null;
      const isDesc = t === 'descToArt';
      return mcq({ template: t, prompt: isDesc ? pick(P.descToArt) : fill(pick(P.temaToArt), { tema: a.tema }),
        quote: isDesc ? desc : null,
        options: [{ label: a.ref, big: true }, ...ds.map((d) => ({ label: d.ref, big: true }))], correct: 0,
        explain: artExplain(a), items: [item.key] });
    }
    if (t === 'artTF') {
      const truth = Math.random() < 0.5;
      const other = truth ? a : artDistractors(ctx, a, 1)[0];
      if (!other) return null;
      return { type: 'tf', template: t, prompt: fill(pick(P.artTF), { ref: a.ref, tema: other.tema }), answer: truth,
        explain: truth ? artExplain(a) : { head: `Falso. ${a.ref}: ${a.tema}`, body: `«${other.tema}» è l'${other.ref}. ${a.desc}`, es: a.es },
        items: [item.key] };
    }
    if (t === 'link') {
      const l = pick(a.allLinks);
      const target = ctx.course.articles.get(l.to);
      const ban = new Set([a.id, ...a.allLinks.map((x) => x.to)]);
      const ds = uniqBy([...shuffle(ctx.chapter), ...shuffle(ctx.arts)].filter((x) => !ban.has(x.id)), (x) => x.id).slice(0, 3);
      if (!target || ds.length < 3) return null;
      return mcq({ template: t, prompt: fill(pick(P.link), { ref: a.ref }), title: a.tema,
        options: [{ label: target.ref, sub: target.tema }, ...ds.map((d) => ({ label: d.ref, sub: d.tema }))], correct: 0,
        explain: { head: `${a.ref} ↔ ${target.ref}`, body: l.why }, items: [item.key, 'art:' + target.id] });
    }
    if (t === 'odd') {
      const tags = a.tags.filter((tg) => ctx.arts.filter((x) => x.tags.includes(tg)).length >= 3);
      const tag = pick(tags);
      const label = ctx.course.tags[tag] || tag;
      const mates = sample(ctx.arts.filter((x) => x.id !== a.id && x.tags.includes(tag)), 2);
      const group = [a, ...mates];
      const ban = new Set(group.flatMap((g) => [g.id, ...g.allLinks.map((l) => l.to)]));
      const intruder = pick(ctx.arts.filter((x) => !x.tags.includes(tag) && !ban.has(x.id)
        && !x.tags.some((tg) => tg === tag)));
      if (!intruder || mates.length < 2) return null;
      return mcq({ template: t, prompt: fill(pick(P.odd), { tag: label }),
        options: [{ label: intruder.ref, sub: intruder.tema }, ...group.map((g) => ({ label: g.ref, sub: g.tema }))], correct: 0,
        explain: { head: `L'intruso è l'${intruder.ref}`, body: `Riguarda «${intruder.tema}». Gli altri (${group.map((g) => g.ref).join(', ')}) riguardano ${label}.` },
        items: [item.key, ...mates.map((m) => 'art:' + m.id)] });
    }
    if (t === 'match') {
      const others = sample(ctx.local.filter((x) => x.id !== a.id && x.tema !== a.tema), 3);
      if (others.length < 3) return null;
      const set = [a, ...others];
      return { type: 'match', template: t, prompt: 'Abbina ogni articolo al suo argomento',
        pairs: set.map((x) => ({ id: x.id, left: x.ref, right: x.tema })),
        explain: null, items: set.map((x) => 'art:' + x.id) };
    }
  }

  if (item.kind === 'con') {
    const c = item.ref;
    const types = ['conDef', 'defCon', 'defCon', 'conTF'];
    if (allowMatch && ctx.consLocal.length >= 6) types.push('conMatch');
    let t = pick(types);
    if (t === avoid) t = pick(types);
    const ds = conDistractors(ctx, c, 3);
    if (ds.length < 3) return null;
    const ex = { head: c.term, body: c.def };
    if (t === 'conDef') return mcq({ template: t, prompt: fill(pick(P.conDef), { term: c.term }),
      options: [{ label: c.def, small: true }, ...ds.map((d) => ({ label: d.def, small: true }))], correct: 0, explain: ex, items: [item.key] });
    if (t === 'defCon') return mcq({ template: t, prompt: pick(P.defCon), quote: c.def,
      options: [{ label: c.term }, ...ds.map((d) => ({ label: d.term }))], correct: 0, explain: ex, items: [item.key] });
    if (t === 'conTF') {
      const truth = Math.random() < 0.5;
      const def = truth ? c.def : ds[0].def;
      return { type: 'tf', template: t, prompt: 'Vero o falso?', quote: `${c.term}: ${def}`, answer: truth,
        explain: truth ? ex : { head: `Falso. ${c.term}`, body: `${c.def}. (La definizione proposta era: ${ds[0].term})` }, items: [item.key] };
    }
    if (t === 'conMatch') {
      const set = [c, ...sample(ctx.consLocal.filter((x) => x.id !== c.id), 3)];
      return { type: 'match', template: t, prompt: 'Abbina ogni concetto alla sua definizione',
        pairs: set.map((x) => ({ id: x.id, left: x.term, right: x.def })), small: true,
        explain: null, items: set.map((x) => 'con:' + x.id) };
    }
  }

  if (item.kind === 'cx') {
    const x = item.ref;
    const [text, col] = x.facts[item.fact];
    const canOdd = !blitz && x.facts.filter((f) => f[1] === col).length >= 3 && x.facts.some((f) => f[1] !== col);
    const t = canOdd && Math.random() < 0.3 ? 'cxOdd' : 'cxSort';
    if (t === 'cxSort') return fixedOrder(x, text, col, item);
    // Intruso: 3 fatti di una colonna + 1 di un'altra
    const other = pick(x.facts.filter((f) => f[1] !== col));
    const mates = sample(x.facts.filter((f) => f[1] === col && f[0] !== text), 2);
    const colName = x.cols[col];
    const oi = x.facts.indexOf(other);
    return mcq({ template: t, prompt: fill(pick(P.cxOdd), { col: colName }),
      options: [{ label: other[0], small: true }, { label: text, small: true }, ...mates.map((m) => ({ label: m[0], small: true }))], correct: 0,
      explain: { head: `L'intruso si riferisce a: ${x.cols[other[1]]}`, body: `«${other[0]}». Gli altri riguardano ${colName}.` },
      items: [item.key, `cx:${x.id}:${oi}`] });
  }

  if (item.kind === 'tf') {
    const t = item.ref;
    return { type: 'tf', template: 'tf', prompt: pick(P.tf), quote: t.s, answer: t.v,
      explain: { head: t.v ? 'Vero' : 'Falso', body: t.why }, items: [item.key] };
  }

  if (item.kind === 'case') {
    const c = item.ref;
    return mcq({ template: 'case', prompt: c.q, quote: c.text,
      options: [{ label: c.ok, small: true }, ...c.no.map((n) => ({ label: n, small: true }))], correct: 0,
      explain: { head: c.ok, body: c.why }, items: [item.key] });
  }

  if (item.kind === 'seq') {
    if (blitz) return null;
    const s = item.ref;
    let order = shuffle(s.steps);
    if (order.every((v, i) => v === s.steps[i])) order = order.reverse();
    return { type: 'seq', template: 'seq', prompt: s.prompt, title: s.title, steps: s.steps, shuffled: order,
      explain: { head: s.title, body: s.steps.map((x, i) => `${i + 1}. ${x}`).join('\n') }, items: [item.key] };
  }
  return null;
}

// Nei confronti le opzioni restano nell'ordine delle colonne (più facile da leggere)
function fixedOrder(x, text, col, item) {
  return { type: 'mc', template: 'cxSort', prompt: x.title, quote: text,
    options: x.cols.map((c, i) => ({ label: c, ok: i === col })),
    explain: { head: `Si riferisce a: ${x.cols[col]}`, body: `«${text}»` }, items: [item.key] };
}

// ---------- XP, serie, livelli ----------
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayDiff(a, b) {
  const da = new Date(a + 'T12:00:00'), db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / DAY);
}

export function addXP(state, amount) {
  const t = todayKey();
  if (state.daily.date !== t) state.daily = { date: t, xp: 0 };
  state.daily.xp += amount;
  state.xp += amount;
  state.history[t] = (state.history[t] || 0) + amount;
}

// Da chiamare a fine sessione: aggiorna la serie di giorni consecutivi.
export function touchStreak(state) {
  const t = todayKey();
  const s = state.streak;
  if (s.last === t) return { changed: false };
  let usedFreeze = false;
  if (s.last) {
    const gap = dayDiff(s.last, t);
    if (gap === 1) s.count++;
    else if (gap === 2 && s.freezes > 0) { s.freezes--; s.count++; usedFreeze = true; }
    else s.count = 1;
  } else s.count = 1;
  s.last = t;
  s.best = Math.max(s.best, s.count);
  let earnedFreeze = false;
  if (s.count % 7 === 0 && s.freezes < 2) { s.freezes++; earnedFreeze = true; }
  return { changed: true, usedFreeze, earnedFreeze };
}

// La serie è "viva" se l'ultimo giorno è oggi o ieri (o l'altroieri con un salvagente)
export function liveStreak(state) {
  const s = state.streak;
  if (!s.last) return 0;
  const gap = dayDiff(s.last, todayKey());
  if (gap <= 1) return s.count;
  if (gap === 2 && s.freezes > 0) return s.count;
  return 0;
}

export function levelInfo(xp) {
  // soglie crescenti: 100, 250, 450, 700, ...
  let lvl = 1, need = 100, acc = 0;
  while (xp >= acc + need) { acc += need; lvl++; need = 100 + (lvl - 1) * 50; }
  return { level: lvl, into: xp - acc, need };
}

export const RANKS = ['Matricola', 'Uditore', 'Praticante', 'Cultore della materia', 'Dottore in legge', 'Avvocato', 'Magistrato', 'Consigliere di Cassazione', 'Giudice costituzionale'];
export function rankFor(level) { return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))]; }
