// Caricamento contenuti. Ogni esame è un "corso" diviso in capitoli (file separati).
// Un articolo può comparire in più capitoli: le occorrenze vengono unite in un solo elemento.

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Impossibile caricare ${url}`);
  return res.json();
}

export async function loadCatalog() {
  const data = await getJSON('data/courses.json');
  return data.courses;
}

export async function loadCourse(meta) {
  const base = meta.path.replace(/[^/]+$/, '');
  const course = await getJSON(meta.path);
  const chapters = await Promise.all(course.chapters.map((f) => getJSON(base + f)));
  return buildCourse(course, chapters);
}

export function buildCourse(course, chapters) {
  const articles = new Map();
  const concepts = new Map();
  const contrasts = new Map();
  const truefalse = new Map();
  const sequences = new Map();
  const cases = new Map();
  const lessons = [];

  chapters.sort((a, b) => a.num - b.num);

  for (const ch of chapters) {
    const secTitle = Object.fromEntries(ch.sections.map((s) => [s.id, s.title]));
    const where = (sec) => ({ ch: ch.id, sec, chNum: ch.num, secTitle: secTitle[sec] || '' });

    for (const a of ch.articles || []) {
      const loc = where(a.sec);
      const prev = articles.get(a.id);
      if (!prev) {
        articles.set(a.id, { ...a, tags: [...(a.tags || [])], links: [...(a.links || [])], locs: [loc] });
      } else {
        for (const k of ['ref', 'fonte', 'tema', 'desc', 'es']) if (a[k] && (!prev[k] || a.override)) prev[k] = a[k];
        for (const t of a.tags || []) if (!prev.tags.includes(t)) prev.tags.push(t);
        for (const l of a.links || []) if (!prev.links.some((x) => x.to === l.to)) prev.links.push(l);
        if (!prev.locs.some((x) => x.ch === loc.ch && x.sec === loc.sec)) prev.locs.push(loc);
      }
    }
    const put = (map, list) => {
      for (const x of list || []) map.set(x.id, { ...x, locs: [where(x.sec)] });
    };
    put(concepts, ch.concepts);
    put(contrasts, ch.contrasts);
    put(truefalse, ch.truefalse);
    put(sequences, ch.sequences);
    put(cases, ch.cases);
    for (const l of ch.lessons || []) lessons.push({ ...l, ch: ch.id, chNum: ch.num });
  }

  // Articoli incompleti (solo riferimento senza definizione) vengono scartati.
  for (const [id, a] of articles) if (!a.ref || !a.tema) articles.delete(id);

  // Collegamenti bidirezionali
  const linkMap = new Map();
  for (const a of articles.values()) {
    for (const l of a.links) {
      if (!articles.has(l.to)) continue;
      const add = (from, to) => {
        if (!linkMap.has(from)) linkMap.set(from, new Map());
        if (!linkMap.get(from).has(to)) linkMap.get(from).set(to, l.why);
      };
      add(a.id, l.to); add(l.to, a.id);
    }
  }
  for (const a of articles.values()) {
    a.allLinks = [...(linkMap.get(a.id) || new Map())].map(([to, why]) => ({ to, why }));
  }

  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    version: course.version,
    tags: course.tags || {},
    chapters: chapters.map((c) => ({ id: c.id, num: c.num, title: c.title, source: c.source, sections: c.sections })),
    lessons,
    articles,
    concepts,
    contrasts,
    truefalse,
    sequences,
    cases,
    fascicoli: course.fascicoli || [{ num: 1, title: course.title, chapters: chapters.map((c) => c.id), status: 'done' }]
  };
}
