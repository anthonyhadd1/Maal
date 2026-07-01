# ACE — Gamified USJ Concours Prep App (Full Greenfield Build)

## Context

The owner wants a store-quality mobile app modeled on **Cultmax** (Lebanese app: past USJ medicine/dentistry entrance-exam questions turned into Duolingo-style gamified levels with mascot, leaderboards, friend challenges, trophies, freemium) — but covering **ALL subjects of the USJ concours**, not just culture générale. Repo `anthonyhadd1/Maal` is empty. Real past-exam data arrives from the owner "tomorrow"; we hand them a canonical JSON schema and build with French demo content so the app is fully demoable now.

**Decisions locked with owner**: Expo React Native (TS) · backend my choice → Django 5.2 + DRF + Postgres monolith · full feature set ("everything we need") · French-first (tutoiement) with i18n · brand name **ACE** (owner's pick) · payments = entitlement abstraction now, RevenueCat later (Apple IAP required for digital goods).

Three detailed design docs were produced by a design workflow (backend / mobile / gameplay+brand). They are the source of truth for fine detail and MUST be copied into the repo at Phase 0:
- `C:\Users\Anthon\AppData\Local\Temp\claude\C--Users-Anthon-Desktop-YVE-PN--claude-worktrees-awesome-raman-d9dbbc\0422fadb-6369-4519-bb4b-b1f20aa8ada7\scratchpad\design_backend.md`
- `...\scratchpad\design_mobile.md`
- `...\scratchpad\design_gameplay.md`

## Repo & environment

- Clone `https://github.com/anthonyhadd1/Maal.git` → `C:\Users\Anthon\Desktop\Maal` (work there, NOT in the YVE@PN worktree). Branch `main`.
- Monorepo: `backend/` (Django) · `app/` (Expo) · `docs/` (the 3 design docs + CONTENT_SCHEMA.md) · `docker-compose.yml` · `README.md`.
- **First commit must include `.gitattributes`**: `*.sh text eol=lf` (owner hit CRLF-breaks-Docker before, YVE@PN commit 5f1aac3).
- Brand: display name "ACE", slug `ace`, scheme `ace`, placeholder bundle IDs `com.aceconcours.app` (changeable pre-store). Mascot: violet phoenix (placeholder CC Lottie files until branded assets exist).

## Reconciled contract decisions (where the 3 docs diverged)

1. **Grading = per-question, server-authoritative** (immediate Duolingo feedback; correct answers never shipped to client):
   - `POST /api/v1/levels/{id}/attempts/` → create attempt (validates unlocked + free-or-premium + hearts≥1), returns `{attempt_id, questions[...]}` **without** `is_correct`/explanations.
   - `POST /api/v1/attempts/{id}/answers/` `{question_id, selected_choice_ids, time_ms}` → grades ONE question atomically → `{is_correct, correct_choice_ids, explanation_text, explanation_media_url, hearts_remaining, next_heart_at, combo}`. Wrong answer deducts a heart here.
   - `POST /api/v1/attempts/{id}/complete/` → closes attempt: stars, XP breakdown, streak, unlock next level, achievements, league xp_week — one `transaction.atomic` with `select_for_update` on PlayerState. Returns the results payload (see backend doc §4 submit response shape).
   - `POST /api/v1/attempts/{id}/abandon/`. One active attempt per user (partial unique index). Re-answer of an answered question → 409.
   - **No wrong-answer re-queue in v1** (exam-realistic scoring: score = correct/10).
2. **Hearts economy** (gameplay doc wins): max 5, −1 per wrong in levels, regen +1/4h server-side lazy (`HEARTS_REGEN_MINUTES=240`), practice-to-earn (+1 for ≥8/10 révision, max 2/day), 3-day signup grace = unlimited, premium = unlimited. Client renders countdown from `next_heart_at`.
3. **League tiers** (gameplay doc wins): Bronze → Argent → Or → Diamant → **Cèdre**; cohort 30, promote top 10, demote bottom 5, week = Mon 00:00 Beirut, lazy cohort join on first weekly XP, `close_league_week` idempotent command + lazy self-heal guard. Daily league-XP soft cap 1500 (excess kept but excluded from board).
4. **Question types**: `single | multi | true_false` (import maps gameplay-doc names). `multi` = exact set match, all-or-nothing v1.
5. **Formulas**: text fields = markdown subset + LaTeX (`$...$`, mhchem `$\ce{}$`). Mobile renders via **KaTeX in react-native-webview** only when `$` detected (else plain `<Text>`); every text slot has optional image fallback.
6. **Content schema**: gameplay doc §9 nested JSON (subjects→units→levels→questions, `external_id` upsert, `correct` = array of keys, media/ folder) + backend behaviors (`--dry-run`, content-hash skip, validation). Import creates bank Questions + LevelQuestion links; admin can re-curate.
7. **Streak**: qualifying day = ≥1 completed level OR révision, fixed Asia/Beirut boundary. Streak freeze v1: lazy consumption (on next activity, gap of exactly 1 missed day + freeze held → preserve), free users hold 1 (granted at 7-day milestone), premium 2.
8. **Quests tab v1** = daily goal ring (XP goal from onboarding: 20/40/60) + 3 static daily quests computed from day's XpEvents (earn N XP / complete N levels / 1 révision) + achievements entry. No rotating quest engine.
9. Boss levels (15q, ×1.5 XP) and Legendary mode (≥9/10, 40 XP, gold crown) ship in v1 but are sequenced last (additive).

## Backend (full detail in docs/design_backend.md)

Django `~=5.2` LTS, DRF `~=3.16`, simplejwt `~=5.5` (+token_blacklist, rotation), psycopg3, django-environ, drf-spectacular, cors-headers, Pillow, whitenoise, pytest-django + factory-boy. Postgres 16-alpine. **No Redis/Celery** (lazy hearts regen, lazy league join, lazy week self-heal).

- Apps under `backend/apps/`: `common` (TimeStampedModel, throttles), `accounts` (custom **User** from first migration, Faculty, Profile), `content` (Subject/Unit/Level/Exam/Passage/Question/Choice/LevelQuestion + `import_exam`/`seed_demo` commands), `progress` (LevelProgress, LevelAttempt with `question_ids` JSON, QuestionAttempt, UserQuestionStat + ReviewItem Leitner boxes [1,3,7 days], `services/grading.py`), `gamification` (PlayerState, XpEvent ledger + F() counters, LeagueTier/Week/Group/Membership, Achievement/UserAchievement, `services/economy.py`, `services/leagues.py`), `social` (Friendship ordered-pair unique, Challenge with question snapshot, 48h expiry, win/lose/tie XP 20/5/10, ≤5 scored/day), `billing` (Entitlement — `is_premium_override or premium_until>now`; RevenueCatEvent webhook stub verifying `Authorization` header, idempotent by event_id).
- Settings env-driven; `TIME_ZONE=Asia/Beirut`; game constants in env/GameConfig (see appendix of gameplay doc). `AUTH_USER_MODEL` custom from migration 0001.
- Endpoints: as listed in backend doc §4 (auth register/login/refresh/logout, `/me/` GET/PATCH/DELETE (App Store requirement), `/me/stats/`, `/subjects/`, `/subjects/{slug}/map/`, attempts trio above, `/practice/mistakes/` + practice attempts (no hearts, replay XP), `/me/game/`, `/league/`, `/leaderboard/friends/`, `/achievements/`, `/quests/today/`, friends/challenges set, `/me/entitlement/`, RevenueCat webhook). Throttles: register 5/h, answers 60/min, user 120/min.
- Django admin = owner's CMS: QuestionAdmin with ChoiceInline + image previews + "assign to level" action, LevelAdmin with sortable LevelQuestionInline + shortage highlight, Entitlement flip on UserAdmin, LeagueWeek "close week now" action.
- `seed_demo`: 4 subjects (Biologie/Chimie/Physique/Culture G, colors+lucide icons), 2 units × 3 levels × 8 questions each, realistic French MCQs incl. LaTeX + image + passage samples, LeagueTiers, ~20 achievements (gameplay doc §5 list), demo users with XP, admin/Admin123! (dev env only).
- Docker Compose at repo root (db healthcheck + backend, entrypoint: migrate → seed if `DEMO_SEED=1` → runserver 0.0.0.0:8000). `ALLOWED_HOSTS=*`+CORS-all in dev only.

## Mobile (full detail in docs/design_mobile.md)

**Expo SDK 56** (new-arch only; do not import `@react-navigation/*` directly — expo-router only). Reanimated `~4.3` + `react-native-worklets/plugin` babel plugin (LAST). TanStack Query v5 + AsyncStorage persister (map/subjects/me offline-browsable; **session start blocked offline**). Zustand v5 (sessionStore persisted for crash recovery, settingsStore, uiStore). axios + expo-secure-store with single-flight 401 refresh mutex. i18next/react-i18next fr-default, 8 namespaces. **expo-audio** (NOT expo-av — deprecated; `seekTo(0)` before SFX replay). lottie-react-native (.json only), @gorhom/bottom-sheet v5 (verify Reanimated-4 compat at install; fallback = custom sheet), lucide-react-native, expo-haptics/notifications/font (+ @expo-google-fonts nunito & dm-sans). **StyleSheet + typed tokens, NOT NativeWind** (runtime per-subject accents, clay = layered components).

- Project at `Maal/app/`, routes in `src/app/` per mobile doc §3: `(auth)` welcome/register/login/forgot · `(tabs)` Apprendre(map)/Ligue/Quêtes/Profil with custom clay tab bar · `session/[levelId]` fullScreenModal (gesture-dismiss off, quit-confirm) + results · modals: subject switcher (formSheet), paywall (pageSheet), streak (transparent) · pushes: friends*, profile/stats|achievements|settings, leaderboard.
- **Levels map**: virtualized FlatList, deterministic sine-offset nodes (`useMapLayout`, row 108px, exact `getItemLayout`, `scrollToIndex` to current), per-gap SVG bezier connectors, node states locked/active(bobbing tooltip + mascot)/completed-stars/legendary-gold/premiumLocked(crown→paywall), sticky header (subject + hearts + streak + XP).
- **Session**: `useSessionEngine` state machine (loading→question→submitting→feedback→next|outOfHearts→results); QuestionRenderer per type (Single/Multi/TrueFalse/Image-zoomable/Passage-collapsible, discriminated union); AnswerOption states with claymorphism colors + haptics + SFX + shake/pop springs; segmented progress bar; combo badge ≥3 with escalating flame; FeedbackSheet (non-dismissable bottom-sheet: verdict strip, explanation, 9:16 media slot, mascot mini-pose, Continuer); out-of-hearts modal (timer/révision/premium pitch); Results choreography (stars punch-in → XP count-up + tick SFX → confetti Lottie + mascot → stat rows → streak modal if earned).
- Design tokens per mobile doc §6 (violet primary scale, xpGold/streakOrange/heartsRed/success, neutrals, subjectAccents map + hash fallback, spacing 4-base, radii 12–32, clayRaised/clayPressed/clayFloating shadow presets, Nunito 800/900 headings + DM Sans body). `PressableScale` base = spring scale 0.95 + shadow swap + light haptic. Reduced-motion: global helper (durations 0, static Lottie frames, skip confetti, instant count-ups).
- Copy: French tutoiement starter table from gameplay doc §12 goes straight into `locales/fr/*.json`. Notifications v1 = local streak reminders (19:30 + 22:00 conditional), pre-permission clay modal after first completed session, Android channel; test in dev build not Expo Go.
- Windows dev note for README: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000/api/v1`, Windows Firewall inbound TCP 8000 rule, `10.0.2.2` for emulator, `adb reverse` option.

## Game constants (single source: backend GameConfig/env — gameplay doc appendix)

10 q/level · boss 15 · stars 60/80/100% · XP = 2/correct + 10 perfect + combo (run k≥3 → k−2) + 10 first-clear; replays 1/correct +5 perfect, ≤3 scored/day; boss ×1.5; legendary ≥9/10 → 40 XP once · hearts 5, −1/wrong, +1/4h, grace 3 days, révision ≥8/10 → +1 (≤2/day) · streak Beirut-midnight, freezes 1 free/2 premium · league 30-cohort, +10/−5, cap 1500/day · challenge 48h, 20/5/10 XP, ≤5/day · Leitner boxes 1/3/7 days · pricing anchor $4.99/mo, $34.99/yr, 7-day trial (RevenueCat later).

## Freemium gates

Free: Unit 1 of every subject, 5 hearts + earn-back, 1 révision/day (free content only), basic stats, leagues/friends/challenges included. Premium: all units, unlimited hearts, unlimited révision + weak-area targeting, detailed stats, 2 exclusive trophies, 2 streak freezes. Everything checks `user.entitlement.is_premium` only.

## Build order (phases; commit + test per phase)

0. **Scaffold**: clone repo to `Desktop\Maal`, `.gitattributes` (LF), README, `docs/` (copy 3 design docs + write `CONTENT_SCHEMA.md` for the owner from gameplay doc §9 incl. owner questions), docker-compose, `.env.example`.
1. **Backend foundation**: config/settings split, requirements, Dockerfile+entrypoint(LF), custom User + accounts app + JWT endpoints, common app, pytest bootstrap. Verify: compose up, register/login via curl, tests green.
2. **Content**: models + admin (inlines/previews/actions) + `import_exam` (JSON+CSV, dry-run, hash-skip) + `seed_demo` French demo data. Verify: seed, browse admin, `/subjects/` + `/map/` respond.
3. **Progress & economy core**: attempts trio (start/answer/complete/abandon), grading service, hearts lazy regen, XP ledger + counters, streak logic (+freeze), LevelProgress/unlocks, UserQuestionStat + ReviewItem, practice endpoints. Heaviest test phase (backend doc §10 list: grading, hearts math w/ freezegun, streak boundaries, idempotency/tamper/atomicity).
4. **Gamification & social & billing**: leagues (lazy join, leaderboard query, close-week command + tests), achievements engine + seeds, quests/today, friends, challenges (snapshot/resolve/expiry), entitlement + RevenueCat webhook stub, `/me/stats/`, account deletion.
5. **Mobile foundation**: Expo scaffold (SDK 56, app.config name "ACE"), theme tokens + clay component kit, i18n fr, API client + auth flow + secure-store, (auth) screens, tab shell + custom tab bar, Toast/Skeleton/Empty/Error/Offline primitives, Mascot component with placeholder Lotties.
6. **Hero screens**: levels map (layout hook, nodes, connectors, switcher) + full session flow (engine, renderers incl. KaTeX WebView, feedback sheet, results choreography, out-of-hearts, crash recovery) + streak modal.
7. **Remaining screens**: Ligue tab + leaderboard, Quêtes tab, Profil + stats + achievements + settings (incl. delete account, toggles), friends/search/requests/challenges, paywall (entitlement-driven, purchase buttons stubbed "bientôt disponible" behind flag), onboarding steps (goal/rhythm/notif pre-prompt).
8. **Polish & game feel**: SFX set, haptics pass, notifications scheduling, animations tuning, reduced-motion audit, boss levels + legendary mode, ui-ux-pro-max pre-delivery checklist pass (touch targets, contrast, safe areas).
9. **Verification & handoff**: full pytest suite; jest suite; `tsc --noEmit`; end-to-end API script (register→map→attempt→answers→complete→league→challenge); compose cold-start from scratch; README dev guide (Windows LAN/firewall, Expo Go vs dev build); final commit + push to GitHub `main`.

Execution note: implement with phased subagent workflows (ultracode), one workflow per 1–2 phases with adversarial review of the grading/economy code (money-adjacent logic), committing per phase.

## Verification (how we know it works)

- Backend: pytest per phase (grading engine cases enumerated in backend doc §10 are the acceptance bar); OpenAPI schema loads; e2e curl script exercises the whole loop against compose; idempotent `seed_demo` + `import_exam --dry-run` on a sample file in the canonical schema.
- Mobile: jest (session engine transitions, requeue-less scoring, 401 refresh single-flight, map layout determinism, fr plurals/number format), `tsc` strict, `expo start` bundles clean; manual device pass by owner via Expo dev build (documented).
- Cross: demo data makes every screen non-empty on first run (map, league with demo users, achievements, friends search).

## Needed from owner (tracked in docs/CONTENT_SCHEMA.md)

Real exam data in canonical schema (+ the 7 open questions from gameplay doc §9: multi-correct/negative marking? official answer keys? years covered + copyright? languages? passages? image quality? unit mapping) · faculty list · store accounts + RevenueCat when ready · SMTP for password reset (until then username-only recovery) · branded mascot/icon assets (placeholders ship) · confirm ACE pricing.
