# Quiz Giurisprudenza

Web app (PWA per iPhone) per allenarsi sugli articoli e sui concetti degli esami di giurisprudenza, come un gioco.

- `data/courses.json`: elenco degli esami (corsi)
- `data/<corso>/course.json`: dati del corso e elenco capitoli
- `data/<corso>/capN.json`: articoli, concetti, confronti, vero/falso e sequenze di un capitolo

I progressi sono salvati solo sul dispositivo (IndexedDB + localStorage + snapshot) e sono legati agli ID stabili degli elementi: aggiungere o modificare contenuti non cancella i progressi.
