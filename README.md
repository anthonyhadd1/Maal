# ACE — Prépa Concours, en mode jeu

Gamified exam-prep app for the USJ (Université Saint-Joseph, Beirut) medicine/dentistry entrance concours. Past exam questions become Duolingo-style levels: XP, hearts, streaks, weekly leagues, friend challenges, trophies, and a freemium premium tier.

**Monorepo:**

| Path | What |
|---|---|
| `backend/` | Django 5.2 + DRF + PostgreSQL monolith (API + Django-admin CMS) |
| `app/` | Expo (React Native, TypeScript) mobile app — iOS + Android |
| `docs/` | Design documents + `CONTENT_SCHEMA.md` (how to format exam data) |
| `docker-compose.yml` | Local dev: Postgres + backend |

## Quick start — backend

```bash
cp .env.example .env          # adjust if needed
docker compose up --build     # migrates + seeds French demo data + serves :8000
```

> Port taken? Set `BACKEND_PORT=18000` (or any free port) in `.env` — another
> local project may already hold `:8000`.

- API: `http://localhost:8000/api/v1/` (OpenAPI docs at `/api/v1/docs/` in dev)
- Admin CMS: `http://localhost:8000/admin/` — dev login `admin` / `Admin123!`
- Demo data: 4 subjects (Biologie, Chimie, Physique, Culture Générale) with units, levels, French MCQs, demo users, leagues, achievements.

## Quick start — mobile app

```bash
cd app
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL (see below)
npx expo start
```

### Testing on a real phone (Windows dev machine)

`localhost` will NOT work from your phone. Use the PC's LAN IP:

1. `ipconfig` → note the IPv4 address (e.g. `192.168.1.42`).
2. In `app/.env`: `EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1`
3. **Windows Defender Firewall**: add an inbound rule allowing TCP 8000 (Docker-published ports are still blocked for LAN peers by default).
4. Phone and PC must be on the same Wi-Fi.

Alternatives: Android emulator → `http://10.0.2.2:8000/api/v1`; USB Android → `adb reverse tcp:8000 tcp:8000` then `http://localhost:8000/api/v1`.

> Lottie animations, sounds, and notifications behave differently in Expo Go — use a **dev build** (`npx expo run:android`) for full fidelity.

## Importing real exam content

Format the data per [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md), then:

```bash
docker compose exec backend python manage.py import_exam /data/import/chimie.json --media-dir /data/import/media --dry-run
docker compose exec backend python manage.py import_exam /data/import/chimie.json --media-dir /data/import/media
```

Re-imports are idempotent (upsert by `external_id`, unchanged questions skipped by content hash). Content is editable afterwards in the admin.

## Design docs

- [`docs/PLAN.md`](docs/PLAN.md) — the approved build plan (source of truth)
- [`docs/design_backend.md`](docs/design_backend.md) — backend architecture
- [`docs/design_mobile.md`](docs/design_mobile.md) — mobile architecture
- [`docs/design_gameplay.md`](docs/design_gameplay.md) — game rules, economy numbers, brand, French copy kit

## Tests

```bash
docker compose exec backend pytest          # backend
cd app && npm test                          # mobile
cd app && npx tsc --noEmit                  # types
python scripts/e2e_smoke.py http://localhost:8000/api/v1   # full loop over HTTP
```

## Feature status (v1)

**Working end-to-end** — auth + onboarding (goal/rhythm/notifications), subjects → units → levels map with per-user progress, server-graded question sessions (single/multi/vrai-faux/image/passage, LaTeX via KaTeX), immediate feedback with explanations + exam provenance, hearts economy (regen 1/4h, 3-day grace, practice earn-back), XP ledger with combo/perfect/first-clear bonuses + replay caps, boss levels («examen blanc», 15 questions sampled from the unit), legendary runs (≥9/10, gold crown, +40 XP), streaks with freezes (Beirut days) + local reminders, Révision intelligente (Leitner 1/3/7 days), weekly leagues (Bronze→Cèdre, top 10 up / bottom 5 down, anti-grind daily cap), 21 trophies, daily quests, friends + search + level challenges (48h, snapshot, VS results), freemium gates (unit 1 free per subject), premium entitlements, full French UI (i18n-ready EN), Django-admin CMS + idempotent content import.

**Stubbed until accounts/credentials exist**
- Payments: paywall UI is live but `purchase()`/`restore()` show «Bientôt disponible» — drop in RevenueCat + App Store/Play products (webhook endpoint already implemented: `POST /api/v1/billing/revenuecat/webhook/`).
- Password reset email: needs an SMTP provider (until then, recovery via support).
- Push notifications (challenge received, league end): local notifications only in v1.

**Before store submission** — real exam data (see `docs/CONTENT_SCHEMA.md`), branded mascot/icon/splash art (placeholders ship), EAS build profiles + store accounts, RevenueCat products, `close_league_week` weekly cron on the host, production settings (S3-compatible media, gunicorn, real SECRET_KEY).
