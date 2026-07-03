# ACE — Content Schema (how to send the exam data)

This is the format the import pipeline expects. Send **one JSON file** (UTF-8) plus a **`media/` folder** for images/videos, zipped together. One file can contain everything, or one file per subject — both work.

After import, everything is editable in the Django admin (questions, choices, level assignment, explanations, images).

## The JSON format

```json
{
  "schema_version": "1.0",
  "subjects": [
    {
      "slug": "chimie",
      "name_fr": "Chimie",
      "name_en": "Chemistry",
      "color": "#0EA5E9",
      "icon": "flask-conical",
      "order": 3,
      "units": [
        {
          "slug": "chimie-u1-stoechiometrie",
          "title_fr": "Stœchiométrie",
          "order": 1,
          "levels": [
            {
              "order": 1,
              "title_fr": "Masse molaire et moles",
              "questions": [
                {
                  "external_id": "chim-2019-q12",
                  "type": "single",
                  "language": "fr",
                  "difficulty": 2,
                  "exam_year": 2019,
                  "exam_session": "juillet",
                  "passage": null,
                  "text": "Quelle est la masse molaire de $\\ce{H2SO4}$ ? (M : H = 1, S = 32, O = 16 g/mol)",
                  "image": null,
                  "choices": [
                    { "key": "A", "text": "98 g/mol", "image": null },
                    { "key": "B", "text": "96 g/mol", "image": null },
                    { "key": "C", "text": "82 g/mol", "image": null },
                    { "key": "D", "text": "100 g/mol", "image": null }
                  ],
                  "correct": ["A"],
                  "explanation": "$M = 2(1) + 32 + 4(16) = 98$ g/mol. Pense à bien compter les 4 oxygènes !",
                  "explanation_media": null,
                  "tags": ["masse-molaire"]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Field rules

| Field | Rules |
|---|---|
| `external_id` | **Unique and stable** per question (e.g. `bio-2021-q07`). Re-sending the same file updates instead of duplicating. |
| `type` | `single` (one correct choice) · `multi` (2+ correct, all-or-nothing) · `true_false` (choices are Vrai/Faux) |
| `language` | `fr` default; use `en` for English-test questions |
| `difficulty` | 1 = facile, 2 = moyen, 3 = difficile (optional, default 2) |
| `exam_year` / `exam_session` | Provenance — shown to students as « Concours 2019 · juillet ». Leave null for self-written drill questions. |
| `passage` | For questions that share a text/document: `{ "ref": "chim-2019-doc1", "title": "Document 1", "text": "…", "image": "media/doc1.png" }`. Repeat the same `ref` on consecutive questions to share one passage. |
| `text` / `choices[].text` / `explanation` | Plain text + **LaTeX between `$…$`** for formulas (`$x^2$`, chemistry: `$\ce{H2SO4}$`). |
| `image` / `choices[].image` / `explanation_media` | Path relative to the `media/` folder (e.g. `media/q12.png`). Use for diagrams, graphs, structures — anything LaTeX can't express. `explanation_media` may also be a short vertical video (`.mp4`). |
| `correct` | Always an **array** of choice keys — `["A"]` for `single`/`true_false`, `["A","C"]` for `multi`. |
| `explanation` | The #1 learning feature — please provide one per question if at all possible. |
| Levels | ~**10 questions per level**, ordered easy → hard within a unit. If unsure how to slice, just group questions per unit and note it — levels can be arranged in the admin afterwards. |
| `kind` (on a level) | Optional: `"boss"` marks the unit's final mock-exam level («examen blanc», 15 questions — its own questions plus a random draw from the unit). Default `"normal"`. |

Image quality: minimum ~1200 px wide, clean PNG/JPG (re-shot rather than raw scan photos, if possible).

## Tracks (Concours vs Examens de Spécialité)

By default every subject belongs to the **"concours"** track (USJ medicine entrance exam) — nothing changes for existing files, `track` can simply be omitted.

To import content for the **"Examens de Spécialité"** track (per-specialty course exams, organized Year → Semester → Specialty), add 3 optional fields at the **subject** level:

| Field | Rules |
|---|---|
| `track` | `"concours"` (default) or `"specialite"`. The slug **must already exist** — tracks are seeded by migration, the importer never creates an unknown track (raises a validation error instead). |
| `program_year` | Required when `track != "concours"`. `{ "name": "M1 - 4e année", "order": 1 }` — resolved by `(track, order)`, `get_or_create`'d with `name` as the default label. |
| `program_semester` | Required when `track != "concours"`. `{ "name": "S1", "order": 1 }` — resolved by `(program_year, order)`, same `get_or_create` semantics. |

This is how later years (M2, MSc, Thèses…) get added with **zero code changes**: just send a subject with a new `program_year`/`program_semester` pair.

### Worked example — one specialty subject (Urologie, S1)

```json
{
  "schema_version": "1.0",
  "subjects": [
    {
      "slug": "specialite-urologie",
      "name_fr": "Urologie",
      "track": "specialite",
      "program_year": { "name": "M1 - 4e année", "order": 1 },
      "program_semester": { "name": "S1", "order": 1 },
      "color": "#0EA5E9",
      "icon": "droplet",
      "order": 1,
      "units": [
        {
          "slug": "urologie-u1-bases",
          "title_fr": "Bases",
          "order": 1,
          "levels": [
            {
              "order": 1,
              "title_fr": "Fondamentaux",
              "questions": [
                {
                  "external_id": "specialite-urologie-q001",
                  "type": "single",
                  "language": "fr",
                  "difficulty": 1,
                  "text": "Quel est l'examen de première intention devant une colique néphrétique ?",
                  "choices": [
                    { "key": "A", "text": "Uroscanner sans injection" },
                    { "key": "B", "text": "IRM rénale" },
                    { "key": "C", "text": "Échographie seule" },
                    { "key": "D", "text": "ASP" }
                  ],
                  "correct": ["A"],
                  "explanation": "Retiens que l'uroscanner sans injection est l'examen de référence en urgence."
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Note `exam_year`/`exam_session` are left `null` for these — they're drill questions written for the course, not tied to a specific concours session.

## CSV fallback

If the data lives in Excel/Sheets, a flat CSV also works (one row per question):

```
external_id,subject,unit,level_order,type,exam_year,exam_session,difficulty,text,image,choice_a,choice_b,choice_c,choice_d,choice_e,correct,explanation,explanation_media
chim-2019-q12,chimie,Stœchiométrie,1,single,2019,juillet,2,"Quelle est la masse molaire…",,98 g/mol,96 g/mol,82 g/mol,100 g/mol,,A,"M = 98 g/mol…",
```

`correct` = `A` or `A;C` for multi. Everything else follows the same rules as JSON.

## Questions to answer when sending the data

1. Do the original concours papers use **negative marking** or **multi-correct MCQs**? (Determines scoring rules.)
2. Are **official answer keys + explanations** available, or must explanations be written from scratch?
3. Which **years/sessions** are covered — and is redistributing these questions legally OK?
4. Are English-test questions in English and French-test in French? Any Arabic content?
5. Are there **passage-based clusters** (reading comprehension)? How long are the passages?
6. Can figures/diagrams be provided as **clean images** (≥1200 px)?
7. How should the syllabus map to **units** — official program chapters? (You define unit titles; we slice ~10 questions/level.)
8. What is the exact **faculty list** to target (Médecine, Médecine dentaire, …) and do questions differ per faculty?
