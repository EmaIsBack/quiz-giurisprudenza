# Quiz Giurisprudenza: istruzioni per Claude

App PWA (vanilla JS, nessun build) per iPhone, pubblicata con GitHub Pages da `main`:
https://emaisback.github.io/quiz-giurisprudenza/

L'utente scrive in italiano, studia giurisprudenza e usa l'app solo su iPhone. Non usare mai il trattino lungo "—" nei messaggi.

## Regole fondamentali

1. **Mai perdere i progressi.** I progressi stanno sul telefono (`js/store.js`) e sono legati agli ID degli elementi (`art:<id>`, `con:<id>`, `cx:<id>:<n>`, `tf:<id>`, `seq:<id>`, `case:<id>`). Non cambiare mai l'ID di un elemento esistente e non cambiare l'ordine dei `facts` di un confronto esistente (l'indice fa parte dell'ID). Si possono aggiungere elementi o correggere testi.
2. Ogni volta che si cambiano i contenuti, aumentare `version` in `data/<corso>/course.json`. Ogni volta che si cambia il codice, aumentare `VERSION` in `sw.js`.
3. Gli articoli già definiti in un altro capitolo si richiamano con una voce minima `{ "id": "cc-2043", "sec": "24" }` (vengono uniti); un articolo si definisce per intero (`ref`, `fonte`, `tema`, `desc`, `tags`) una sola volta. ID: `cc-1218`, `cost-3-1`, `dp-12-2`, `cpc-113-2`, `cp-575`, `tfue-288-2`, `codcons-52`, ecc.
4. Priorità per l'utente: numero dell'articolo, argomento, collegamenti tra argomenti, **esempi e casi pratici**. Scrivere poco nell'app: solo domande a tocco.
5. Il testo degli articoli non va inventato: `desc` è una parafrasi fedele basata sui file dell'utente.

## Struttura contenuti

- `data/courses.json`: elenco esami (corsi).
- `data/privato/course.json`: tag, elenco file capitolo, **fascicoli**.
- `data/privato/capN.json`: `sections`, `lessons`, `articles` (con `links` e `es` = esempio), `concepts`, `contrasts`, `truefalse`, `sequences`, `cases` (casi pratici: `text`, `q`, `ok`, `no`[3], `why`).

Quando arrivano nuovi file: leggerli tutti, creare il/i file capitolo, aggiungerli a `chapters` in `course.json` e agli `chapters` del fascicolo giusto, aggiornare `status`/`note` del fascicolo, validare i JSON (ID unici, `sec` esistenti, `links` verso articoli definiti, tag presenti in `tags`), provare l'app con Playwright su iPhone 13, poi commit e push su `main`.

## Diritto privato (prof. Dellacasa): i fascicoli fisici

L'app raggruppa i capitoli per fascicolo, come i fascicoli cartacei dell'utente:

1. **Il diritto e le fonti** (Capp. 1-4): fatto, nell'app (`cap1`-`cap4`).
2. **I soggetti** (§ 32 + Cap. 7): studiato, file definitivi 5 e 7 ancora da caricare.
3. **Situazioni, beni, fatti e atti** (Capp. 6, 8, 9): completo, 3 file definitivi da caricare.
4. **Diritti reali, possesso, trascrizione**: da fare, tutto spiegato (slide 10, 11, 12 + appunti):
   - introduzione ai diritti reali, § 131 (pp. 237-239)
   - proprietà, diritti reali di godimento, comunione, condominio, §§ 132-173 (pp. 239-308): studio individuale, niente slide né appunti
   - possesso, §§ 174-188 (pp. 309-332)
   - trascrizione, Cap. 81 (esclusi §§ 686, 687, 691)
5. **Obbligazioni e garanzia patrimoniale**: appena iniziato. §§ 189-200 con slide 13, mancano gli appunti; il resto (inadempimento, mora, responsabilità patrimoniale, garanzie) non ancora spiegato.
6. **Responsabilità extracontrattuale** (Cap. 55): su Panopto o sul manuale.
7. **Tutela dei diritti, prove, prescrizione e decadenza** (Capp. 10-12): non ancora spiegato.

Nota: i file capitolo dell'utente sono numerati come i capitoli del manuale (es. "Privato_Cap._7"). Per i capitoli fuori ordine (§ 32, Cap. 55, Cap. 81) usare comunque `num` = numero del capitolo del manuale e ID file tipo `cap7.json`, `cap55.json`.
