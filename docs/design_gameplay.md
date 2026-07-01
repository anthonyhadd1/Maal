# Maal — Game Design, Content Model & Brand Specification

**Scope:** product/game layer for the USJ med/dental concours prep app (React Native + Expo frontend, Django monolith backend — decided elsewhere). Every number below is a v1 default; all constants should live in a server-side `GameConfig` (remote-configurable) so tuning never requires an app release.

---

## 1. Core Loop Spec

### 1.1 Session structure

| Concept | Value |
|---|---|
| **Level ("Niveau")** | 10 questions, fixed order defined by content (server may shuffle choice order per attempt, never question order for v1) |
| **Boss level ("Examen blanc de l'unité")** | Last node of each unit: 15 questions sampled from the whole unit (10 fixed + 5 random from unit pool) |
| **Feedback** | Immediate per question: correct/incorrect + explanation card + provenance chip ("Concours 2019") |
| **Session flow** | Question → answer → feedback (tap to continue) → … → results screen (score, stars, XP breakdown, hearts lost) |

### 1.2 Stars (per level, persisted as best-ever)

| Stars | Criterion (correct/total) |
|---|---|
| ⭐⭐⭐ | 100% |
| ⭐⭐ | ≥ 80% |
| ⭐ | ≥ 60% (= "passed") |
| 0 (échec) | < 60% — level not passed, replay required |

### 1.3 XP formula (server-computed, always)

**First completion of a level (any star count ≥1):**

```
XP = (2 × correct_answers)              # max 20
   + 10 if score == 100%                # perfect bonus
   + combo_bonus                        # +1 XP per answer from the 3rd of any
                                        # consecutive-correct run (run of k ≥ 3 → k−2 XP;
                                        # perfect 10-run → +8)
   + 10 first-completion bonus
```

- Typical first pass (7/10, best run 4): 14 + 2 + 10 = **26 XP**
- First-time perfect: 20 + 10 + 8 + 10 = **48 XP**

**Replay of a passed level:** 1 XP per correct (max 10), +5 if perfect. No completion/combo bonus. **Max 3 scored replays per level per day** (further replays give 0 XP — anti-grind for leagues).

**Boss level:** same formulas × 1.5, rounded up.

### 1.4 Unlock rules

- Level *n+1* unlocks when level *n* has ≥ 1 star.
- Unit *N+1* unlocks when **all** levels of unit *N* (incl. boss) have ≥ 1 star **and** the user is premium (or unit *N+1* is in the free tier, §7).
- Subjects are all visible from day one; each subject's unit 1 / level 1 is always unlocked (no forced subject order).

### 1.5 Legendary replay value ("Niveau Légendaire" — crown)

- Unlocks on a level once it has ⭐⭐⭐.
- Rules: 10 questions (the level's 10, re-shuffled choices), **≥ 9/10 required**, no explanations shown until the end, costs 1 heart to attempt (free for premium).
- Reward: **40 XP** (one-time) + gold crown skin on the map node + counts toward "Perfectionniste" trophy. Re-attempts after earning: replay XP rates.

---

## 2. Hearts Economy

| Rule | Value |
|---|---|
| Max hearts (free) | **5** |
| Cost | −1 per wrong answer **in levels only** (review mode, friend challenges, legendary results screen never double-charge — legendary charges 1 up front instead) |
| 0 hearts | Cannot start/continue a level; can still do Révision, challenges, browse |
| Regen | **+1 per 4 h**, server-side timestamps (0→5 in 20 h). Timer starts when a heart is spent. |
| Practice-to-earn | Complete a "Révision" session with ≥ 8/10 → **+1 heart**, max **2 earned/day** |
| Grace period | First **3 days** after signup: unlimited hearts ("période de grâce" — onboarding retention) |
| Premium | Unlimited hearts (UI shows infinity heart) |

Rationale: Duolingo uses 5 hearts / 1-per-4h; for stressed 15–19-year-olds cramming a real exam we stay at Duolingo generosity but add the earn-back loop (which doubles as the spaced-repetition hook) and the 3-day grace window.

---

## 3. Streaks

- **Definition:** ≥ 1 completed level **or** Révision session per calendar day, **Asia/Beirut** timezone, day boundary 00:00. Server-evaluated on each completion; a nightly job (00:05 Beirut) breaks streaks / consumes freezes.
- **Streak freeze ("Gel de série"):** auto-applied item. Free users can hold **1** (first one granted at the 7-day milestone; re-earnable via trophies/milestones). Premium holds **2**, auto-refilled monthly.
- **Milestones (celebration screen + share card):** 3, 7, 14, 30, 50, 100, 200, 365. Trophies at 7/30/100/365 (§5).
- **Reminder notifications (French, tutoiement):**
  - 19:30 local, if no qualifying activity: « 🔥 Ta série de {n} jours t'attend ! Un niveau et c'est réglé. »
  - 22:00 local, only if streak ≥ 3: « Dernière chance ! Ta série de {n} jours expire à minuit. 5 minutes, pas plus. »
  - Freeze consumed (morning after): « Ouf ! Ton Gel de série a sauvé ta série de {n} jours. Reviens aujourd'hui pour la continuer. »
  - Streak lost: « Ta série s'est éteinte… mais {mascot} croit en toi. On en recommence une aujourd'hui ? »

---

## 4. Weekly Leagues

| Rule | Value |
|---|---|
| Tiers (bottom→top) | **Ligue Bronze → Ligue Argent → Ligue Or → Ligue Diamant → Ligue Cèdre** (Lebanese cedar as the summit — French-friendly, locally resonant) |
| Cohort | ~30 users, same tier, filled in join order (cohort assigned on first XP earned that week) |
| Week window | Monday 00:00 → Sunday 23:59:59 **Asia/Beirut** |
| Promotion | Top **10** move up (except Cèdre) |
| Demotion | Bottom **5** move down (except Bronze) |
| Rewards | Top 3 of any cohort: badge on profile for the week; Cèdre top 1: "Cèdre éternel" trophy |
| Opt-out | Settings toggle "Participer aux ligues" (some students hate competition — cheap retention save) |

**Anti-cheat (mandatory):** the client **never sends XP** — it sends per-question answers against a server-issued attempt ID; the server grades and computes XP. Additional guards: answer-timing sanity (per-question < 1.5 s median flags the attempt), scored-replay caps (§1.3), challenge-XP caps (§6), daily league-XP soft cap **1,500** (excess XP is kept for the user but excluded from the leaderboard and flagged).

---

## 5. Trophies / Achievements (v1 list)

| # | Nom (FR) | Trigger | Notes |
|---|---|---|---|
| 1 | Première victoire | Finish first level with ≥1⭐ | |
| 2 | Sans-faute | First 10/10 level | |
| 3 | Sur ta lancée | 7-day streak | grants 1 Gel de série |
| 4 | Inarrêtable | 30-day streak | |
| 5 | Centurion | 100-day streak | |
| 6 | Une année de feu | 365-day streak | |
| 7 | Semaine parfaite | Daily goal met every day Mon–Sun | |
| 8 | Noctambule | Complete a level 00:00–05:00 | |
| 9 | Lève-tôt | Complete a level 05:00–08:00 | |
| 10 | Marathonien·ne | 10 levels in one day | |
| 11 | Touche-à-tout | ≥1 level completed in every subject | |
| 12 | Expert·e {Matière} | ⭐⭐⭐ on every level of one unit of that subject | One trophy family, auto-generated per subject (Expert Bio, Expert Chimie, …) |
| 13 | Grimpeur·se | First league promotion | |
| 14 | Podium | Finish top 3 of a league week | |
| 15 | Cèdre éternel | Finish #1 in Ligue Cèdre | |
| 16 | Défi relevé | Win first friend challenge | |
| 17 | Rival·e redoutable | Win 10 friend challenges | |
| 18 | Papillon social | Add 5 friends | |
| 19 | Perfectionniste | 10 legendary crowns | |
| 20 | **Mémoire d'éléphant** (premium) | Graduate 100 questions from Révision | Révision at that volume is premium-only |
| 21 | **Collectionneur·se d'or** (premium) | ⭐⭐⭐ on an entire subject (all units) | Requires premium content access |

All trophies: name, description, Lucide icon name, `is_premium`, trigger stored server-side; awarded server-side on the relevant event; push + in-app celebration.

---

## 6. Friend Challenges (v1)

**Flow:** challenger opens a level they've completed → "Défier un ami" → server snapshots the exact question IDs + order into the challenge → friend gets push + inbox entry → friend plays that snapshot (no heart loss, choices shuffled) → results compared.

**States:** `pending` → (`declined` | `expired` after **48 h** | `accepted`) ; `accepted` → `completed` when the challenged player finishes. Challenger's score = their best score on that level at send time (frozen in the snapshot).

**Scoring:** higher correct count wins; tiebreak = total answer time (stored per attempt). Rewards: winner **+20 XP**, loser **+5 XP**, tie **+10 XP** each. Max **5 challenges/day** count for XP (both directions combined). No hearts involved on either side.

**Notifications (FR):**
- Received: « ⚔️ {name} te défie sur "{level}" ! Tu as 48 h pour riposter. »
- Won: « 🏆 Tu as battu {name} {a}–{b} ! Bien joué. »
- Lost: « {name} t'a battu·e {a}–{b}. Revanche ? »
- Expiring (T−6h): « Ton défi contre {name} expire dans 6 h ! »

---

## 7. Freemium Gating

**One subscription tier** (two billing periods). Two tiers add choice paralysis for teens; keep one.

| | Gratuit | Premium |
|---|---|---|
| Content | **Unit 1 of every subject** (≈ 4–6 levels × 8 subjects ≈ 40 free levels — a real taster of every subject) | All units, all levels |
| Hearts | 5, regen + earn-back | Unlimited |
| Révision (mistakes review) | 1 session/day, free-unit questions only | Unlimited, all content, weak-area targeting |
| Stats | Score/stars per level | Detailed: per-subject accuracy, coverage vs full concours program, trends, percentile |
| Concours blanc (full mixed mock exam mode, v1.1) | — | ✔ |
| Streak freezes | hold 1 | hold 2, monthly refill |
| Trophies | all except premium-exclusive | + 2 exclusives |
| Leagues, friends, challenges | ✔ | ✔ |

**Pricing anchor (Lebanon, USD):** **$4.99/month**, **$34.99/year** (~42% off, positioned as "moins qu'une séance de soutien scolaire"), 7-day free trial on annual. Implement via the entitlement abstraction (`is_premium` flag, admin-settable) now; RevenueCat products later (`maal_premium_monthly`, `maal_premium_annual`). Keep prices as RevenueCat offerings so they're tunable without release.

---

## 8. Question Taxonomy & Smart Practice

**Question types (v1):** `qcm_single` (one correct choice), `qcm_multi` (2+ correct, all-or-nothing scoring v1), `true_false`. **v1.1 candidates:** numeric input, assertion–reason, matching. The schema's `type` enum is extensible.

**Difficulty:** integer 1–3 (`facile` / `moyen` / `difficile`), shown as dots on the question card, used by Révision and boss-level sampling.

**Provenance:** `exam_year` + `exam_session` render a chip: « Concours {year} » (e.g., "Concours 2019 · session de juillet"). Questions without provenance (owner-written drills) show no chip.

**Révision intelligente (mistakes review — Leitner-lite):**
- Every wrong answer creates/refreshes a `ReviewItem(user, question, box=1)`.
- Boxes & due dates: box 1 → +1 day, box 2 → +3 days, box 3 → +7 days.
- Answer correct → box+1; correct at box 3 → **graduated** (removed, counts toward "Mémoire d'éléphant"); wrong → back to box 1.
- Session = up to 10 due items (oldest-due first), no hearts lost, replay-rate XP (1 XP/correct), ≥8/10 → +1 heart (§2).
- Gating per §7.

---

## 9. Canonical Content Schema (hand to the owner tomorrow)

**Format:** one JSON file (UTF-8) + a `media/` folder, zipped. Import via Django management command + editable in Django admin afterwards.

**Formula rendering decision:** text fields accept a **markdown subset + LaTeX**, inline `$...$` and block `$$...$$`, chemistry via KaTeX's **mhchem** syntax (`$\ce{H2SO4}$`). The app renders these with **KaTeX inside `react-native-webview`** (Expo-compatible, no native linking; e.g. `react-native-katex` or a small custom WebView with a bundled KaTeX build — KaTeX chosen over MathJax for speed). Every question/choice/explanation also has an optional `image` field as a guaranteed fallback for anything LaTeX can't express (diagrams, graphs, structures). Plain-Unicode-only was rejected (insufficient for concours chem/math); images-only was rejected (unsearchable, unmaintainable).

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
                  "type": "qcm_single",
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
                  "explanation_image": null,
                  "tags": ["masse-molaire"],
                  "time_limit_seconds": null
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

**Field rules:** `external_id` unique & stable (re-import = upsert). `correct` is always an array of choice keys (1 item for `qcm_single`/`true_false`). `passage`, if present: `{ "text": "...", "image": "media/….png" }`, shareable across consecutive questions via identical passage object or a `passage_ref`. All image paths relative to `media/`. `language` defaults `"fr"`; English-subject questions use `"en"`. `time_limit_seconds` null = untimed (v1 untimed everywhere; field reserved for Concours blanc).

**Open questions for the owner (send with the schema):**
1. Do original concours papers use negative marking or multi-correct MCQs? (Determines whether `qcm_multi` + partial credit is needed.)
2. Are official answer keys + explanations available, or must explanations be written? (Explanations are the #1 learning feature — budget time.)
3. Which years/sessions are covered, and is redistribution of the questions legally OK?
4. Are English-test questions in English? French-test in French? Any Arabic?
5. Any passage-based clusters (reading comprehension) — how long are passages?
6. Image quality of scans — can figures be re-shot as clean PNGs (min width 1200 px)?
7. How should the syllabus map to **units** — by official program chapters? Owner defines unit titles; we slice ~10 questions/level within each unit ordered easy→hard.

---

## 10. Onboarding Flow (short — 5 screens, < 60 s)

1. **Accueil** — mascot animation + « Prêt·e à décrocher ta place en médecine ? » → CTA "C'est parti !" (+ tiny "J'ai déjà un compte").
2. **Objectif** — « Tu vises quoi ? » : Médecine / Dentaire / Je ne sais pas encore. (v1: stored, personalizes copy only.)
3. **Rythme quotidien** — daily XP goal: Tranquille (20 XP ≈ 1 niveau) / Sérieux·se (40 XP) / Intensif (60 XP). Default Sérieux·se.
4. **Notifications** — mascot pitch « Je te rappellerai de garder ta série 🔥 » → native permission prompt only after tapping "Oui, motive-moi !" (pre-permission pattern).
5. **Compte** — email + password (or continue exploring as guest with account-gate before first level result is saved — v1: require account here, simplest).

**No placement test in v1** (concours prep is coverage-driven, not level-driven; everyone starts at unit 1). Placement = post-v1 idea.

---

## 11. Brand

| # | Name | Flavor | Mascot concept | Assessment |
|---|---|---|---|---|
| 1 | **Hakim** (حكيم) | Lebanese-Arabic "doctor / wise one" — universally used in Lebanon | Young **purple phoenix** (Phoenician heritage, rebirth, flame = streak) | ★ Recommended. Short, pronounceable in FR/AR/EN, culturally *exactly* the target's word for "doctor", warm not corporate. Generic-name risk: other "Hakim" apps exist (telehealth, MENA) — differentiate as "Hakim — Prépa Concours" on stores; run a trademark check in Lebanon/France classes 9/41. |
| 2 | Docta | Lebanese street pronunciation of "docteur" | Fennec fox in a white coat | Fun, young, but a Cameroonian health app "Docta" exists; slangy tone may read unserious to parents (who pay). |
| 3 | Toubib | French slang for doctor (Arabic origin *ṭabīb*) | Toucan with stethoscope ("Toubib le toucan") | Great FR resonance; slightly dated slang for 15-year-olds; several French medical services already use it. |
| 4 | Konkour | Phonetic Lebanese-French "concours" | Kangaroo (bounding up levels) | Catchy, descriptive — **but** "Konkur" is the famous Iranian university entrance exam; ASO/search collision and confusion risk. Avoid. |
| 5 | Blouze | "Blouse blanche" + Lebanese -e ending | Chameleon in a lab coat | Cute insider nod; weak internationally, unclear meaning pre-download. |
| 6 | Cedra | Cedar + feminine -a | Cedar-sprite character | Lovely Lebanese identity but says nothing about medicine or games; multiple existing "Cedra" brands in Lebanon (bank programs, NGOs). |
| 7 | Yalla Doc | "Let's go, doctor" | Hyper-energetic cat | Instantly understood locally; "Yalla X" naming is saturated (Yalla Ludo etc.); harder to trademark. |

**Recommendation: Hakim.**
- **Mascot:** *Hakim*, a small violet phoenix chick with big eyes, tiny round glasses, and a flame-tipped crest that literally grows with your streak (Lottie states: idle, cheer, sad, sleeping, on-fire at streak ≥7). Phoenix ≠ Duolingo's owl (deliberate distance), ties Phoenician-Lebanese pride to the streak-flame mechanic, and works in the violet + orange palette already decided.
- **Tagline (FR):** « **Ton concours, en mode jeu.** » (alt: « Révise comme tu joues. »)
- **App Store name:** "Hakim — Prépa Concours Médecine".

---

## 12. French UI Copy Kit (tutoiement, starter table)

| Key | FR string |
|---|---|
| `cta.start` | C'est parti ! |
| `cta.continue` | Continuer |
| `cta.check` | Vérifier |
| `cta.next_question` | Question suivante |
| `cta.retry` | Réessayer |
| `cta.play` | Jouer |
| `cta.challenge_friend` | Défier un ami |
| `feedback.correct.1` | Bravo ! |
| `feedback.correct.2` | Exact ! |
| `feedback.correct.3` | Trop fort·e ! |
| `feedback.correct.4` | Dans le mille ! |
| `feedback.wrong.1` | Aïe... |
| `feedback.wrong.2` | Pas tout à fait. |
| `feedback.wrong.3` | Presque ! Regarde l'explication. |
| `feedback.combo` | {n} d'affilée ! 🔥 |
| `results.perfect` | Sans-faute ! Incroyable. |
| `results.passed` | Niveau réussi ! |
| `results.failed` | Pas cette fois... on remet ça ? |
| `results.xp_earned` | +{n} XP |
| `hearts.lost` | Tu as perdu un cœur |
| `hearts.empty.title` | Plus de cœurs ! |
| `hearts.empty.body` | Récupère un cœur dans {time}, gagne-en un en Révision, ou passe en illimité avec Premium. |
| `hearts.earned` | +1 cœur ! Bien joué. |
| `streak.today_done` | Série de {n} jours — c'est dans la poche pour aujourd'hui ! |
| `streak.milestone` | {n} jours de série ! {mascot} est fier de toi. |
| `streak.freeze_used` | Ton Gel de série t'a sauvé·e ! |
| `league.promoted` | Promu·e en Ligue {league} ! |
| `league.demotion_warning` | Attention, tu es dans la zone rouge... |
| `league.week_end` | La semaine se termine dimanche à minuit ! |
| `review.title` | Révision |
| `review.subtitle` | Tes erreurs, transformées en points forts. |
| `trophy.unlocked` | Trophée débloqué : {name} ! |
| `challenge.received` | {name} te défie ! |
| `challenge.won` | Victoire ! {a}–{b} contre {name} |
| `paywall.title` | Passe en Premium |
| `paywall.pitch` | Tous les niveaux. Cœurs illimités. Révision intelligente. Tout pour décrocher ta place. |
| `paywall.price_note` | Moins cher qu'une heure de soutien scolaire. |
| `paywall.cta` | Essayer 7 jours gratuits |
| `paywall.restore` | Restaurer mes achats |
| `onboarding.goal_q` | Tu vises quoi ? |
| `onboarding.notif_pitch` | Je te rappellerai de garder ta série 🔥 |
| `empty.friends` | Ajoute tes amis et montre-leur qui est le futur médecin. |

(Grammar note: use inclusive middots `·e` where gender-marked; the profile can later store a gender preference to resolve them.)

---

## Appendix — Tunable constants (single server config object)

`questions_per_level=10`, `boss_questions=15`, `star_thresholds=[0.6,0.8,1.0]`, `xp_per_correct=2`, `xp_perfect_bonus=10`, `xp_first_completion=10`, `xp_replay_per_correct=1`, `xp_replay_perfect=5`, `scored_replays_per_level_per_day=3`, `legendary_min_score=0.9`, `legendary_xp=40`, `max_hearts=5`, `heart_regen_hours=4`, `hearts_grace_days=3`, `review_heart_threshold=0.8`, `review_hearts_per_day=2`, `league_cohort=30`, `league_promote=10`, `league_demote=5`, `league_daily_xp_cap=1500`, `challenge_expiry_hours=48`, `challenge_xp_win/lose/tie=20/5/10`, `challenges_scored_per_day=5`, `review_boxes_days=[1,3,7]`, `timezone=Asia/Beirut`.

Sources: [KaTeX extensions & libraries](https://katex.org/docs/libs), [react-native-katex (WebView-based KaTeX for RN)](https://github.com/3axap4eHko/react-native-katex), [@caporeista/reactnative-math-latex](https://www.npmjs.com/package/@caporeista/reactnative-math-latex)