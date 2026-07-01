# Maal — Backend Architecture Design Document

Django 5.2 (LTS) monolith serving the gamified USJ-concours prep app. Server-authoritative for all economy/progress mutations; the client is a renderer.

---

## 1. Stack & pinned versions

| Package | Version | Purpose |
|---|---|---|
| Python | 3.12 (slim Docker image) | Runtime |
| Django | `~=5.2` (LTS, security fixes ≥3 yrs) | Framework |
| djangorestframework | `~=3.16` | API |
| djangorestframework-simplejwt | `~=5.5` (`[token_blacklist]`) | JWT auth |
| psycopg[binary] | `~=3.2` | Postgres driver |
| django-environ | `~=0.12` | Env-driven settings |
| drf-spectacular | `~=0.28` | OpenAPI schema (`/api/v1/schema/`) |
| django-cors-headers | `~=4.7` | Expo dev origin |
| django-filter | `~=25.1` | List filtering |
| Pillow | `~=11.0` | Image fields/validation |
| whitenoise | `~=6.9` | Static files (admin) in container |
| gunicorn | `~=23.0` | Prod server (runserver in dev) |
| pytest, pytest-django, factory-boy | `8.x / ~=4.11 / ~=3.3` | Tests |
| django-storages[s3] | `~=1.14` | **Deferred** — added when moving media off-disk |

PostgreSQL **16-alpine** in Docker Compose. No Redis, no Celery in MVP (see §4 hearts, §5 leagues — both designed to work without background workers).

---

## 2. Project layout

```
backend/
├── manage.py
├── Dockerfile
├── entrypoint.sh                  # LF-only (see §9)
├── requirements/
│   ├── base.txt
│   ├── dev.txt                   # + pytest, factory-boy, ipython
│   └── prod.txt                  # + gunicorn
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── base.py               # everything env-driven via django-environ
│   │   ├── dev.py                # DEBUG, CORS allow-all, console email
│   │   ├── prod.py               # S3 hooks, secure cookies, sentry later
│   │   └── test.py               # fast hasher, in-memory-ish
│   ├── urls.py                   # admin/, api/v1/ include, media serving in dev
│   ├── api_v1_urls.py            # aggregates app routers under /api/v1/
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── common/                   # TimeStampedModel, pagination, throttles, validators
│   ├── accounts/                 # User, Profile, auth endpoints
│   ├── content/                  # Subject/Unit/Level/Question/Choice/Exam/Passage + import
│   │   └── management/commands/
│   │       ├── import_exam.py
│   │       └── seed_demo.py
│   ├── progress/                 # LevelProgress, attempts, grading engine
│   │   └── services/grading.py   # THE core domain service
│   ├── gamification/             # PlayerState, XP ledger, hearts, streaks, leagues, achievements
│   │   ├── services/
│   │   │   ├── economy.py        # xp/hearts/streak mutations
│   │   │   └── leagues.py        # cohort assignment, close_week
│   │   └── management/commands/close_league_week.py
│   ├── social/                   # Friendship, Challenge
│   └── billing/                  # Entitlement, RevenueCat webhook stub
│       └── webhooks.py
├── seed/
│   ├── demo_content.json         # French demo subjects/levels/questions (canonical import format)
│   └── images/
└── pytest.ini
```

Each app: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `services.py` (or `services/` pkg), `tests/`. Rule: **views never mutate the economy directly** — they call services; services own `transaction.atomic`.

Settings via `django-environ`: `DATABASE_URL`, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `TIME_ZONE=Asia/Beirut` (see streaks), `MEDIA_ROOT=/data/media`, `REVENUECAT_WEBHOOK_AUTH`, `HEARTS_MAX=5`, `HEARTS_REGEN_MINUTES=30`, `LEAGUE_GROUP_SIZE=30`, `FREE_LEVELS_PER_SUBJECT=3`.

`AUTH_USER_MODEL = "accounts.User"` from the first migration (non-negotiable for greenfield).

---

## 3. Data models (full field lists)

### 3.1 accounts

**User** (`AbstractUser` subclass)
- Keep `username` (login identifier, case-insensitive unique via `UniqueConstraint(Lower("username"))`), `email` (optional but unique-when-set, for recovery), `password`.
- No extra fields here; everything else lives on Profile.

**Faculty** — data-driven onboarding target
- `name` CharField(80) · `slug` SlugField unique · `order` PositiveSmallInt
- Seed: Médecine, Médecine dentaire (owner confirms list).

**Profile** (OneToOne `user`, created via signal on register)
- `display_name` CharField(40)
- `avatar_id` CharField(32) — preset avatar catalog shipped in the app (no photo upload in MVP; avoids moderation)
- `target_faculty` FK Faculty null
- `exam_year` PositiveSmallInt null (which concours session they're prepping)
- `locale` CharField(8) default `"fr"`
- `timezone` CharField(48) default `"Asia/Beirut"` (stored for future; MVP logic uses app TZ)
- `onboarding_completed` Bool default False
- `created_at/updated_at`

### 3.2 content

**Subject**
- `name` CharField(80) · `slug` SlugField unique · `color_hex` CharField(7) · `icon` CharField(40) (Lucide icon name) · `order` PositiveSmallInt · `is_active` Bool
- `free_level_count` PositiveSmallInt default 3 (freemium gate, per-subject overridable)

**Unit** — chapter within a subject
- `subject` FK · `title` CharField(120) · `description` TextField blank · `order` PositiveSmallInt · `is_active` Bool
- `unique_together (subject, order)`

**Level**
- `unit` FK · `title` CharField(120) · `order` PositiveSmallInt · `is_active` Bool
- `xp_reward` PositiveSmallInt default 20 (base XP on completion)
- `question_count_target` PositiveSmallInt default 10 (how many to serve; if bank is larger, sample)
- `unique_together (unit, order)`
- *Free/premium is computed*: a level is free iff its global order within the subject `< subject.free_level_count`. No flag to keep in sync.

**Exam** — provenance
- `year` PositiveSmallInt · `session` CharField(40) blank (e.g. "juillet", "septembre") · `faculty` FK Faculty null · `notes` TextField blank
- `unique_together (year, session, faculty)`

**Passage** — shared stimulus (text/image a question group refers to)
- `subject` FK · `external_ref` CharField(120) unique null · `title` CharField(200) blank · `body` TextField blank · `image` ImageField null (upload_to `passages/`)

**Question**
- `subject` FK (a question belongs to the bank, not to a level — see LevelQuestion)
- `qtype` CharField choices: `single` | `multi` | `true_false` (T/F is rendered specially but stored as two choices)
- `text` TextField
- `image` ImageField null (upload_to `questions/`)
- `passage` FK Passage null
- `exam` FK Exam null · `exam_question_number` PositiveSmallInt null
- `explanation_text` TextField blank
- `explanation_media` FileField null (upload_to `explanations/`) · `explanation_media_type` CharField choices `image|video|lottie` blank — the "TikTok-style visual aid"
- `difficulty` PositiveSmallInt 1–5 default 3
- `external_ref` CharField(120) unique null — **idempotency key for import**
- `content_hash` CharField(64) blank — sha256 of normalized content, lets re-import skip unchanged rows
- `is_active` Bool · `created_at/updated_at`
- Indexes: `(subject, is_active)`, `(exam)`

**Choice**
- `question` FK related_name `choices` · `text` TextField blank · `image` ImageField null · `is_correct` Bool · `order` PositiveSmallInt
- Constraint enforced in service/admin clean: `single`/`true_false` ⇒ exactly one `is_correct=True`.

**LevelQuestion** (through table — bank questions are reusable across levels and mistakes-practice)
- `level` FK · `question` FK · `order` PositiveSmallInt · `unique_together (level, question)` and `(level, order)`

**Media storage**: dev = `MEDIA_ROOT` volume served by Django (`static()` helper in dev only); prod path = flip `DEFAULT_FILE_STORAGE` to django-storages S3 (any S3-compatible: Cloudflare R2 recommended for zero egress). Serializers always emit absolute URLs so the app never cares.

### 3.3 progress

**LevelProgress** — per-user per-level state
- `user` FK · `level` FK · `unique_together (user, level)`
- `status` CharField: `locked | unlocked | completed` (rows only created once unlocked/interacted — absence = locked; first level of each subject is implicitly unlocked)
- `stars` PositiveSmallInt 0–3 · `best_score_pct` PositiveSmallInt · `attempts_count` PositiveSmallInt
- `first_completed_at` DateTime null · `updated_at`
- Index `(user, level)`

**LevelAttempt**
- `user` FK · `level` FK · `status` CharField `active | submitted | abandoned`
- `question_ids` JSONField (ordered list served at start — grading validates against exactly this set)
- `started_at` · `submitted_at` null
- Results (filled at grading): `correct_count`, `total_count`, `score_pct`, `stars_awarded`, `xp_awarded`, `hearts_lost`, `duration_ms`
- `is_practice` Bool default False (mistakes practice reuses the same pipeline, no stars/hearts)
- Index `(user, level, status)`; partial unique index on `(user)` where `status='active'` — one active attempt at a time.

**QuestionAttempt** — per-question answer record (stats + review)
- `attempt` FK · `user` FK (denorm) · `question` FK
- `selected_choice_ids` JSONField (list of ints)
- `is_correct` Bool · `time_ms` PositiveInt null · `created_at`
- Indexes: `(user, question)`, `(user, is_correct, created_at)`

**UserQuestionStat** — rollup powering "révision des erreurs" cheaply
- `user` FK · `question` FK · `unique_together`
- `seen_count`, `correct_count` PositiveSmallInt · `last_is_correct` Bool · `last_seen_at` DateTime
- Mistakes practice query: `filter(user=u, last_is_correct=False)` — indexed `(user, last_is_correct, last_seen_at)`. Updated inside the grading transaction.

### 3.4 gamification

**PlayerState** (OneToOne `user`, created at register)
- `xp_total` PositiveInt default 0 — **denormalized counter**; the ledger below is the audit source
- `hearts` PositiveSmallInt default 5 · `hearts_updated_at` DateTime
- `streak_current` PositiveSmallInt · `streak_longest` PositiveSmallInt · `streak_last_day` DateField null
- `updated_at`

**XpEvent** — ledger (decision: **ledger + cached counter**, not pure event-sourcing)
- `user` FK · `amount` PositiveSmallInt
- `event_type` CharField: `level_complete | perfect_bonus | first_clear_bonus | streak_bonus | challenge_win | achievement`
- `attempt` FK LevelAttempt null · `meta` JSONField blank · `created_at`
- Index **`(user, created_at)`** — this single index powers weekly-league sums, stats charts, and audit. Counter (`xp_total`, `xp_week`) updated with `F()` expressions in the same transaction, so reads never aggregate the ledger on hot paths.

**Hearts — server-side lazy regen (decision + why)**: no cron, no Redis. `hearts` + `hearts_updated_at` stored; every read/spend computes `effective = min(HEARTS_MAX, hearts + elapsed_minutes // HEARTS_REGEN_MINUTES)` and persists on mutation. Server-side because hearts gate content (freemium pressure) — client-side regen is trivially cheated by clock changes. Client renders a countdown from `next_heart_at` returned by the API. Premium ⇒ unlimited (server skips deduction).

**Streaks — timezone decision**: all streak day-boundaries computed in **`Asia/Beirut`** (settings `TIME_ZONE`), regardless of device TZ — the audience is Lebanese students; one national day-boundary makes leagues/streaks fair and removes TZ-spoofing. `profile.timezone` is stored for a future international pass. A qualifying day = ≥1 submitted non-practice attempt. Grading service compares `streak_last_day` to today-in-Beirut: same day → no-op; yesterday → +1; older → reset to 1. Streak-freeze item deferred (owner decision).

**LeagueTier** (seeded rows, data-driven)
- `name` (Bronze/Argent/Or/Saphir/Diamant) · `order` PositiveSmallInt unique · `icon` CharField · `color_hex`

**LeagueWeek**
- `starts_at` / `ends_at` DateTime (Mon 00:00 Beirut → Sun 23:59:59) · `iso_year`, `iso_week` · `is_closed` Bool · unique `(iso_year, iso_week)`

**LeagueGroup**
- `week` FK · `tier` FK · `member_count` PositiveSmallInt (denorm, capped `LEAGUE_GROUP_SIZE=30`)

**LeagueMembership**
- `group` FK · `user` FK · `xp_week` PositiveInt default 0 (F()-incremented on every XpEvent in the same txn)
- `joined_at` · `final_rank` PositiveSmallInt null · `outcome` CharField `promoted | stayed | demoted` null
- unique `(user, group)`; **index `(group, -xp_week)`** — the leaderboard query
- Cohort assignment is **lazy**: first XP-earning action in a week joins the user to the open group of their tier for that week (fill groups to 30, then open a new one). No signup-time job needed.

**Achievement** (definition table)
- `code` SlugField unique · `title` · `description` · `icon` CharField · `order`
- `rule_type` CharField: `xp_total | streak_days | levels_completed | perfect_levels | subject_levels_completed | friends_count | challenges_won`
- `threshold` PositiveInt · `subject` FK null (for per-subject rules) · `is_premium_only` Bool
- Checked in `economy.check_achievements(user)` after grading — pure counter comparisons, no cron.

**UserAchievement**
- `user` FK · `achievement` FK · `unlocked_at` · unique together

### 3.5 social

**Friendship**
- `requester` FK User · `addressee` FK User · `status` CharField `pending | accepted | declined | blocked`
- `created_at` · `responded_at` null
- Constraints: `CheckConstraint(requester != addressee)`; unique on `(least(requester,addressee), greatest(...))` via two `UniqueConstraint`s on ordered pair (enforce single edge in service layer).

**Challenge** (minimal viable: async score duel on one level)
- `challenger` FK · `opponent` FK · `level` FK
- `status` CharField `pending | accepted | completed | declined | expired`
- `challenger_attempt` FK LevelAttempt null · `opponent_attempt` FK LevelAttempt null
- `winner` FK User null (null on tie) · `xp_reward` PositiveSmallInt default 15
- `created_at` · `expires_at` (=created+72h)
- Flow: challenger must have completed the level; opponent accepts → both (re)play; when both attempts submitted, grading service resolves winner by `score_pct` then `duration_ms`, awards `challenge_win` XpEvent. Expiry resolved lazily on read.

### 3.6 billing

**Entitlement** (OneToOne `user`, created at register with defaults)
- `is_premium_override` Bool default False (admin kill-switch/grant)
- `premium_until` DateTime null (from RevenueCat expirations)
- `source` CharField `none | admin | revenuecat | promo`
- `rc_app_user_id` CharField(120) blank · `rc_product_id` CharField(120) blank
- `updated_at`
- Property `is_premium` = `is_premium_override or (premium_until and premium_until > now())`. **Everything in the codebase checks `user.entitlement.is_premium` — nothing ever references RevenueCat directly.**

**RevenueCatEvent** (webhook audit + idempotency)
- `event_id` CharField unique · `event_type` CharField · `payload` JSONField · `processed` Bool · `error` TextField blank · `received_at`

### 3.7 common
- `TimeStampedModel` abstract (`created_at`, `updated_at`) mixed into all of the above.

---

## 4. API design — `/api/v1/`

Auth: simplejwt. `Authorization: Bearer <access>`. Access 60 min, refresh 30 days, rotation + blacklist on. Pagination: `PageNumberPagination`, `page_size=20`. Throttles: anon `30/min`, user `120/min`; scoped: `register 5/hour`, `attempt_submit 30/min`, `webhook` unauthenticated-but-secret-header.

### accounts
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register/` | `{username, password, email?, display_name}` → `{user, tokens:{access,refresh}}` (creates Profile, PlayerState, Entitlement) |
| POST | `/auth/token/` | login `{username, password}` → `{access, refresh}` |
| POST | `/auth/token/refresh/` | |
| POST | `/auth/logout/` | blacklist refresh |
| GET/PATCH | `/me/` | profile + entitlement + player state summary |
| DELETE | `/me/` | account deletion — **App Store review requirement**, anonymize + cascade |
| GET | `/me/stats/` | per-subject accuracy, XP over time (from ledger/UserQuestionStat) |
| GET | `/faculties/` | onboarding picker |

### content + gameplay (server-authoritative core)
| Method | Path | Notes |
|---|---|---|
| GET | `/subjects/` | active subjects with color/icon/order + per-user completion % |
| GET | `/subjects/{slug}/map/` | units → levels with merged `{status, stars, is_free_for_me}`; single query w/ prefetch + LevelProgress join |
| POST | `/levels/{id}/attempts/` | **start**: validates unlocked + free-or-premium + `hearts ≥ 1`; creates LevelAttempt, returns `{attempt_id, questions:[{id, qtype, text, image_url, passage?, choices:[{id,text,image_url}]}]}` — **`is_correct` and explanations are never serialized here** |
| POST | `/attempts/{id}/submit/` | `{answers:[{question_id, selected_choice_ids, time_ms}], duration_ms}` → graded result (below) |
| GET | `/practice/mistakes/` | up to N questions where `UserQuestionStat.last_is_correct=False` |
| POST | `/practice/attempts/` + submit | same pipeline, `is_practice=True`: no hearts, no stars, small flat XP |

**Submit response** (the one payload the whole game loop hangs on):
```json
{
  "score_pct": 80, "correct_count": 8, "total_count": 10,
  "stars": 2, "passed": true,
  "xp": {"base": 20, "perfect_bonus": 0, "first_clear_bonus": 10, "streak_bonus": 5, "total": 35},
  "hearts": {"lost": 2, "remaining": 3, "next_heart_at": "2026-07-01T18:40:00+03:00"},
  "streak": {"current": 4, "extended_today": true},
  "unlocked_level_id": 124,
  "achievements_unlocked": [{"code": "streak_3", "title": "En feu !"}],
  "review": [{"question_id": 9, "is_correct": false, "correct_choice_ids": [31],
              "explanation_text": "...", "explanation_media_url": "...", "explanation_media_type": "video"}]
}
```
Grading rules (in `progress/services/grading.py`, one `transaction.atomic` with `select_for_update` on PlayerState + LevelProgress): validate attempt is `active`, owned, questions match `question_ids`; grade (`multi` = exact set match); stars = ≥60%→1, ≥80%→2, 100%→3; `passed` = stars ≥1; hearts −1 per wrong answer (floor 0, premium exempt); XP only via XpEvent rows + F() counter bumps (incl. `LeagueMembership.xp_week`); streak update; unlock next level on first pass; upsert UserQuestionStat; check achievements. Re-submission of a submitted attempt → 409. Client XP is never read — ever.

### gamification
| Method | Path | Notes |
|---|---|---|
| GET | `/me/game/` | `{xp_total, hearts, next_heart_at, streak_current, streak_longest, league:{tier, rank, xp_week}}` |
| GET | `/league/` | my group's leaderboard (≤30 rows, no pagination): `[{rank, username, display_name, avatar_id, xp_week, is_me}]` + promotion/demotion cutoffs |
| GET | `/leaderboard/friends/` | friends ranked by `xp_week` |
| GET | `/achievements/` | definitions merged with my unlock state |

### social
| Method | Path |
|---|---|
| GET | `/users/search/?q=` (username prefix, throttled) |
| GET | `/friends/` · POST `/friends/requests/` `{username}` · GET `/friends/requests/` · POST `/friends/requests/{id}/accept/` · `/decline/` · DELETE `/friends/{user_id}/` |
| GET/POST | `/challenges/` (create: `{opponent_id, level_id}`) · POST `/challenges/{id}/accept/` · `/decline/` · GET `/challenges/{id}/` |

### billing
| Method | Path | Notes |
|---|---|---|
| GET | `/me/entitlement/` | `{is_premium, premium_until, source}` |
| POST | `/billing/revenuecat/webhook/` | **stub now**: verifies `Authorization` header == `REVENUECAT_WEBHOOK_AUTH`, stores RevenueCatEvent idempotently by `event_id`, maps `INITIAL_PURCHASE/RENEWAL/EXPIRATION/CANCELLATION` → `premium_until`/`source`. Ships day 1 so RevenueCat is config-only later. |

`/api/v1/schema/` + Swagger UI via drf-spectacular (dev only).

---

## 5. Weekly leagues in pure Postgres

- **Leaderboard read**: `SELECT ... FROM leaguemembership WHERE group_id=? ORDER BY xp_week DESC, joined_at ASC` — covered by index `(group_id, xp_week DESC)`; group ≤30 rows so rank computed in Python. No Redis needed at any realistic scale (rank window = one group).
- **Write path**: `xp_week` F()-incremented inside the grading transaction (same row-lock scope as PlayerState).
- **Week close**: management command `close_league_week` (idempotent; run manually or via host cron/scheduled task — flagged in §12): for each group of the ended week, rank members, top 7 `promoted`, bottom 7 `demoted` (clamped at top/bottom tier), write `final_rank`/`outcome`, mark week closed. Next week's membership is created lazily on first XP action at the adjusted tier. A **lazy guard** in the league read path also detects "current week has no LeagueWeek row" and creates it, so the system self-heals even if cron is late.

---

## 6. Content import pipeline

**Canonical JSON schema to hand the owner** (one file per subject per exam; UTF-8; images referenced relative to a sibling `images/` folder):

```json
{
  "format_version": 1,
  "subject": "chimie",
  "exam": { "year": 2023, "session": "juillet", "faculty": "medecine" },
  "passages": [
    { "ref": "2023-jul-chimie-P1", "title": "Document 1", "body": "Texte du document…", "image": "images/p1.png" }
  ],
  "questions": [
    {
      "ref": "2023-jul-chimie-Q12",
      "type": "single",                       // "single" | "multi" | "true_false"
      "passage_ref": null,                     // or "2023-jul-chimie-P1"
      "number": 12,
      "text": "Quelle est la masse molaire de H2O ?",
      "image": null,                           // or "images/q12.png"
      "difficulty": 2,                         // 1–5, optional (default 3)
      "choices": [
        { "text": "18 g/mol", "correct": true },
        { "text": "16 g/mol", "correct": false },
        { "text": "20 g/mol", "correct": false },
        { "text": "22 g/mol", "correct": false }
      ],
      "explanation": "M(H2O) = 2×1 + 16 = 18 g/mol.",
      "explanation_media": null                // or "media/q12_explainer.mp4"
    }
  ]
}
```
CSV fallback (if the owner's data is tabular): columns `ref,subject,year,session,type,number,text,image,choice_a,choice_b,choice_c,choice_d,choice_e,correct(e.g. "A" or "A;C"),explanation,difficulty` — the command accepts both.

**Command**: `python manage.py import_exam path/to/chimie_2023.json --media-dir path/to/ --dry-run`
- Upserts by `external_ref` (`ref`); skips rows whose `content_hash` is unchanged; replaces choices wholesale on change (safe because grading stores choice IDs per attempt — changed questions get new stats naturally).
- Validates: exactly one correct for `single`/`true_false`, ≥2 choices, referenced image files exist; `--dry-run` prints a diff summary (`created/updated/skipped/errors`) without writing.
- Copies media into `MEDIA_ROOT` under deterministic paths.
- Level assignment is a separate deliberate step (admin), not part of import — the owner curates which bank questions form each level.

---

## 7. Seed / demo data

`python manage.py seed_demo` (idempotent, reuses the import pipeline + fixtures):
- 4 subjects: **Biologie** (green `#22C55E`, icon `dna`), **Chimie** (blue `#3B82F6`, `flask-conical`), **Physique** (orange `#F97316`, `atom`), **Culture Générale** (violet `#8B5CF6`, `globe`).
- 2 units per subject, 3 levels per unit, 8 questions per level — realistic French MCQs (tutoiement in explanations: « Retiens que… »), a couple of image questions + one passage group, fake Exam rows (2022/2023).
- LeagueTiers, ~10 Achievements, demo users (`elie`, `maya`, …) with varied XP so leagues/leaderboards render, superuser `admin/Admin123!` (dev only, from env).

---

## 8. Django admin (owner's CMS)

- **QuestionAdmin**: `ChoiceInline` (TabularInline, min 2), image thumbnail preview (`format_html`), explanation-media preview, `list_filter` = subject/qtype/exam/is_active/difficulty, `search_fields` = text/external_ref, `list_editable` = is_active, actions: *activate/deactivate*, *duplicate question*, *assign to level…* (intermediate form page).
- **LevelAdmin**: `LevelQuestionInline` (sortable via `order`), computed column "questions assigned vs target" with red highlight when short.
- **SubjectAdmin/UnitAdmin**: ordered lists, color swatch preview.
- **ExamAdmin**: question count column, link to filtered question list.
- **Profile/PlayerState/Entitlement inlines on UserAdmin**: owner can flip `is_premium_override`, adjust hearts/XP for support cases (writes an XpEvent of type `achievement`/manual for audit).
- **LeagueWeekAdmin**: read-only + "close week now" action (calls the service).

---

## 9. Docker Compose + Windows gotchas

```yaml
# docker-compose.yml (repo root)
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_DB: maal, POSTGRES_USER: maal, POSTGRES_PASSWORD: maal }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U maal"], interval: 5s, retries: 10 }
    ports: ["5432:5432"]
  backend:
    build: ./backend
    env_file: .env
    volumes: ["./backend:/app", "media:/data/media"]
    ports: ["8000:8000"]
    depends_on: { db: { condition: service_healthy } }
    command: ["/app/entrypoint.sh"]   # migrate → seed_demo (if DEMO_SEED=1) → runserver 0.0.0.0:8000
volumes: { pgdata: {}, media: {} }
```
- **`.gitattributes` at repo root, first commit**: `*.sh text eol=lf` and `entrypoint.sh text eol=lf` — the owner has hit CRLF-breaks-Docker before (same fix as YVE@PN commit `5f1aac3`).
- Expo device testing: phone hits the dev machine's LAN IP → `ALLOWED_HOSTS=*` in dev, `CORS_ALLOW_ALL_ORIGINS=True` in dev only. Document `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000/api/v1`.
- `.env.example`: `SECRET_KEY, DEBUG=1, DATABASE_URL=postgres://maal:maal@db:5432/maal, ALLOWED_HOSTS=*, TIME_ZONE=Asia/Beirut, HEARTS_MAX=5, HEARTS_REGEN_MINUTES=30, LEAGUE_GROUP_SIZE=30, FREE_LEVELS_PER_SUBJECT=3, DEMO_SEED=1, REVENUECAT_WEBHOOK_AUTH=changeme`.

---

## 10. Testing strategy (pytest-django, priority order)

1. **Grading engine** (highest value): correct/incorrect/multi-set-match, stars thresholds, hearts floor-at-zero, premium heart exemption, XP composition (base/perfect/first-clear/streak), idempotency (double-submit → 409), question-set tampering rejected, atomicity (forced mid-txn failure leaves counters untouched).
2. **Hearts regen math**: lazy compute across boundaries, cap at max, `next_heart_at` correctness, clock-freeze via `freezegun`.
3. **Streaks**: same-day, consecutive, gap-reset, Beirut-midnight boundary cases.
4. **League lifecycle**: lazy join fills groups to 30 then opens new, `xp_week` increments, `close_league_week` promotion/demotion ranks + idempotent re-run, tier clamping.
5. **Import command**: dry-run, idempotent re-import (hash skip), validation failures, CSV path.
6. **Freemium gates**: free-level computation, premium unlock, entitlement expiry.
7. **Auth/permissions smoke**: register creates the 3 satellite rows; every mutating endpoint 401s anonymously; users can't read others' attempts.
Factories via factory-boy in `apps/*/tests/factories.py`; `settings/test.py` uses MD5 hasher + eager media in tmp dir.

---

## 11. Deliberate decisions (recap, don't relitigate downstream)

- XP = **ledger + denormalized counters** (audit + fast reads, one index serves leagues/stats).
- Hearts = **server-side lazy regen**, no scheduler; deducted at grading.
- Streak day-boundary = **fixed Asia/Beirut** for MVP.
- Questions live in a **bank**; levels reference them through `LevelQuestion` (enables mistakes-practice + challenges reuse).
- Free tier computed from `subject.free_level_count`, never stored per-level.
- Payments = **entitlement abstraction + RevenueCat webhook stub** from day 1.

## 12. Owner must decide / provide (flagged)

1. **Real exam data** in the §6 schema (or raw dump — pipeline adapts, but the schema is the ask). Confirm images/passages exist and **copyright posture** on past USJ questions.
2. **Faculty list** + whether questions differ per faculty (affects Exam.faculty usage and possible per-faculty maps).
3. Economy tuning: hearts max/regen minutes, star thresholds, XP amounts, league size + tier count, promotion/demotion counts, free levels per subject (all env/data-driven — defaults above).
4. **Scheduler host** for `close_league_week` (weekly) — cron on the eventual VPS, or manual admin action until launch.
5. RevenueCat account + App Store/Play accounts (webhook auth secret when created); subscription price points.
6. SMTP provider for password reset emails (until then: username-only recovery via support).
7. Final brand name (affects package IDs, not this design).
8. Whether Arabic (RTL) is in scope — content models are ready (plain text fields), i18n of content would need a translation-columns pass.

Sources: [Django 5.2 release notes](https://docs.djangoproject.com/en/6.0/releases/5.2/), [djangorestframework-simplejwt on PyPI](https://pypi.org/project/djangorestframework-simplejwt/), [simplejwt releases](https://github.com/jazzband/djangorestframework-simplejwt/releases)