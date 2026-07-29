# Deploying ACE

Everything below is required for a first production release. Items marked
**BLOCKER** will produce a broken or insecure app if skipped — the code fails
loudly for the ones it can detect, but most are configuration only you can set.

---

## 1. Backend (Django)

Run with `DJANGO_SETTINGS_MODULE=config.settings.prod`.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **BLOCKER** | Fresh random value. Never the dev one in `.env.example`. |
| `DATABASE_URL` | **BLOCKER** | Managed Postgres. Not the compose-local `db` host. |
| `ALLOWED_HOSTS` | **BLOCKER** | Your real domain(s). `*` is a dev convenience. |
| `DEBUG` | **BLOCKER** | Must be unset/`0` — `prod.py` forces `False`, don't fight it. |
| `MEDIA_ROOT` | yes | Persistent volume, or switch to S3 (see the note at the end of `prod.py`). Question figures live here; an ephemeral disk loses them on redeploy. |
| `DEMO_SEED` | yes | **Set to `0`.** Left on, every boot seeds demo users including `admin/Admin123!`. |
| `UNLOCK_ALL_LEVELS` | yes | Must be unset/`0`. It is a manual-testing switch that opens every level *and* the premium gate. Defaults to `False`; just don't set it. |
| `CORS_ALLOW_ALL_ORIGINS` | yes | `0` in production; list real origins instead. |
| `REVENUECAT_WEBHOOK_AUTH` | **BLOCKER** once billing is live | High-entropy random secret. It is the webhook's *only* gate, on an unauthenticated unthrottled endpoint that grants Premium by user id — anyone who guesses it can make themselves premium. Empty fails closed; never ship the old `changeme`. |
| `EMAIL_HOST` + `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | **BLOCKER** | Without it, password-reset codes fall back to the *console* backend — they get printed to the server log and no user ever receives one. See `config/settings/prod.py`. |
| `SECURE_SSL_REDIRECT` | no | Defaults to `True`. Only set `0` if something upstream already handles it. |
| `SECURE_HSTS_PRELOAD` | no | Defaults to `False` on purpose — see below. |

### HSTS preload

`prod.py` sends HSTS for one year with `includeSubDomains`, but leaves the
`preload` directive off. Turning it on (`SECURE_HSTS_PRELOAD=1`, then
submitting the domain) is effectively **irreversible for months**: browsers
will refuse plain HTTP to the domain and every subdomain regardless of what the
server later says. Flip it only once every subdomain is known to serve HTTPS.

This is the one remaining warning in `manage.py check --deploy`; it is expected.

### Health check

Point the platform's health probe at `GET /healthz` (unauthenticated, opens a
DB cursor, returns `503` if the database is unreachable). It is exempt from the
HTTPS redirect so a plain-HTTP probe gets `200` rather than a `301`.

### Scheduled job

One weekly cron, Monday 00:05 Beirut:

```bash
python manage.py close_league_week
```

It is idempotent and catches up on every overdue week at once, and the league
read path self-heals a missing current week — so a late or missed run degrades
gracefully rather than breaking leagues. Nothing else needs a scheduler: hearts
regenerate lazily on read and achievements are checked at grading time.

### Before the first release

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser        # do NOT rely on the demo admin
python manage.py check --deploy         # expect only security.W021 + drf_spectacular noise
```

---

## 2. Mobile app (Expo / EAS)

### `EXPO_PUBLIC_API_URL` — **BLOCKER**

A release build with this unset now **throws at startup** with a message
naming the fix. It used to fall back to `http://127.0.0.1:8000/api/v1`, which
shipped an app pointing at the phone itself: no crash, no log, nothing ever
loaded. `src/api/client.ts` guards this and `src/api/__tests__/client.test.ts`
locks it.

`eas.json` reads it per profile from EAS environment variables, so set these
once in the EAS dashboard (or `eas env:create`):

- `EXPO_PUBLIC_API_URL_PRODUCTION` → `https://api.<your-domain>/api/v1`
- `EXPO_PUBLIC_API_URL_STAGING` → staging equivalent (used by the `preview` profile)

### Legal page URLs — **BLOCKER**

Set both in the same EAS environment (they are wired into the `preview` and
`production` profiles):

- `EXPO_PUBLIC_PRIVACY_URL` → your privacy policy, **https**
- `EXPO_PUBLIC_TERMS_URL` → your terms of use, **https**
  (Apple's standard EULA is acceptable and is the fast option:
  <https://www.apple.com/legal/internet-services/itunes/dev/stdeula/>)

Apple needs these reachable from INSIDE the app, not only from the store
listing, and the privacy-policy URL is a mandatory App Store Connect field —
you cannot submit without it. `src/lib/legal.ts` hides the in-app Legal rows
and the paywall's point-of-purchase links until both are set, so a build
without them ships no dead links; it just cannot be submitted. Cleartext
`http://` is rejected by the same module because ATS blocks it on device.

Use **https**. iOS App Transport Security blocks cleartext HTTP by default, so
an `http://` origin fails on device even when the server is reachable.

### Store metadata

- `app.config.ts` — `version` is `1.0.0`; build numbers auto-increment
  (`autoIncrement` on the production profile, `appVersionSource: "remote"`).
  Export compliance is pre-answered (`ios.config.usesNonExemptEncryption: false`).
- Bundle id / package: `com.aceconcours.app` on both platforms.
- Web output is **demo-only** (`app.config.ts` says so) — native is the product.

### Before submitting

```bash
npx tsc --noEmit
npx jest
eas build --profile production --platform all
```

---

## 3. Content

Production content ships from `backend/seed/concours/*.json` plus the figure
crops in `backend/seed/concours/media/`. Import with:

```bash
python manage.py replace_concours_content
```

### Provenance — read before answering any question about rights

Measured from the database, not assumed:

- **3 785 / 3 785 questions carry a real `Exam` row** (year + session, spanning
  2011–2026). None are synthetic. **185 questions ship a figure and 23 more
  have their four answer options as graphs** — every one a verbatim crop of the
  original paper, and every one looked at before it was attached.
- **Provenance audited against the PDFs on 2026-07-29**, question by question:
  locate the stem in the paper it claims, fall back to rare-word overlap across
  *every* paper, then read the residue by hand. Four maths questions stamped
  "2011 mars" were **deleted**: no such paper exists (the 2011 file is
  `fm11.pdf`, January) and their text appears in none of the 16 PDFs — they were
  paraphrase-variants of real questions. Everything else traces to its paper.
  Corroboration: maths is now 237 questions, and an independent per-paper sweep
  counts exactly **237 maths MCQs printed** across the 15 papers.
- Two extraction traps make source searches silently return nothing, and both
  produced false "this question isn't in the paper" readings before being
  caught: accents extract as a standalone U+00B4 (`int´egrale`), and **the
  integral sign `∫` extracts as a bare capital `Z`**. Flatten to `[a-z0-9]`
  before comparing anything with these PDFs.
- **1 question ships `is_active: false`** (`biologie-2019-janvier-q5`): its
  schema is missing from the source PDF entirely. Two further questions printed
  in *janvier 2019* physique were left unimported for the same reason rather
  than given an invented answer key. Both cases are recorded in
  `seed/concours/FIGURES_TODO.md`.
- Coverage was checked against the papers themselves, per subject section, not
  against the seed's own numbering: **every question printed in every paper is
  in the app.** Five chimie questions were rebuilt on 2026-07-29 (2022-juillet
  14 and 32, 2024-janvier 33 and 34, 2026-janvier 46). Only **q32 was truly
  absent**; the other four were present all along under the external_id
  `…-q0-…`, where the importer had failed to read a question number and taken
  the GRAPH'S AXIS TICK LABELS as the opening of the stem — "01 0 0 10 20 30 40
  50 60 70 80 90 100 Temps (min) Le temps de demi-réaction est égal à :" — with
  no figure attached. Two of those four also carried a wrong answer key,
  unavoidably, since they had been keyed with no curve to read. The corrupt
  rows were deleted and replaced by clean transcriptions with their graphs.
- Beware the three traps that produced false readings while checking this:
  subject sections restart numbering at 1, so pooling a paper's subjects
  collides `biologie q9` with `physique q9`; maths/chimie ids are
  chapter-relative, so an id-based check cannot see those questions at all; and
  a question whose id lost its number (`-q0-`) is invisible to a
  numbering-gap check even though it is sitting in the database.
- One more row was deleted: `physique-2017-fevrier-q4` was not an MCQ. Its stem
  was a free-response instruction and its four "options" were the opening lines
  of later sections of the paper ("IV. OPTIQUE GÉOMÉTRIQUE (3 points)").
- The spécialité track was removed on 2026-07-28; the app is concours-only.

An earlier version of this file said the concours content was "synthetic except
where a question carries real provenance". That is now backwards and would
misinform anyone relying on it.

**Rights to the concours papers are undetermined.** `docs/CONTENT_SCHEMA.md`,
`docs/design_gameplay.md`, `docs/design_backend.md` and `docs/PLAN.md` each raise
the question and none answers it. Resolve it before a public release — see the
"business/legal decisions" section of any App Store readiness review.

Whatever is decided, the standing rule holds: **never let synthetic content
carry fabricated provenance**.

---

## Appendix — testing on your own phone

**Expo Go does not work with this project.** Expo Go only ever ships the single
latest SDK, and this app is on **SDK 57**; scanning a QR gives
"version is incompatible". Verified on a real device 2026-07-28 — an earlier
version of this appendix wrongly claimed Expo Go was enough.

You need a **development build**: the app's own native runtime, which then
connects to Metro exactly like Expo Go did. Built once, reused for every
subsequent JS change.

### iPhone (physical device)

Requires the **Apple Developer Program ($99/yr)**. There is no free route from
Windows — the free personal-team signing path needs Xcode on a Mac. You need
this account for the App Store anyway.

```bash
cd app
npx eas-cli login          # free Expo account
npx eas-cli init           # links the project, writes the EAS project id
npx eas-cli device:create  # registers your iPhone's UDID (QR → install profile)
npx eas-cli build --profile development --platform ios
```

Install the finished build from the link EAS prints, then:

```bash
npx expo start --dev-client
```

Open the installed **ACE** app (not Expo Go) and scan the QR.

### Android (free, no Apple account)

```bash
npx eas-cli build --profile development --platform android
```

Download the APK from the link, sideload it, then `npx expo start --dev-client`.

### Networking

No IP editing. `resolveBaseURL` derives the API host from Metro's own host in
dev builds, so it follows whatever network you are on; `app/.env` is empty on
purpose. If the phone cannot reach the laptop, the router is isolating clients
— use Windows Mobile Hotspot instead. Firewall rules for TCP 8081 (Metro) and
18000 (API) already exist on this laptop.

Known dev-only gaps: remote push notifications need a real build + APNs setup
(local streak reminders work), and in-app purchases are stubbed regardless.
