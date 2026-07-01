# Maal — Mobile App Architecture (Expo React Native)

Design document, v1 — 2026-07-01. Scope: complete Expo app design. Backend contract assumed from the companion backend design (Django monolith, JWT via simplejwt, REST under `/api/v1/`).

---

## 1. Version matrix (verified via web search, 2026-07-01)

**SDK decision: pin Expo SDK 56** (stable since 2026-05-21, RN 0.85.3, React 19.2.3). Expo SDK 57 shipped **yesterday** (2026-06-30, RN 0.86, "small, focused release, no breaking changes") — too fresh for third-party lib verification (Lottie, NativeWind, bottom-sheet). Plan a trivial SDK 57 bump mid-project once the ecosystem catches up (reanimated 4.3→4.5, gesture-handler 2.31→2.32).

Two SDK 56 facts that shape this design:
- **SDK 56 is New-Architecture-only** (old arch dropped in SDK 55). All chosen libs must be new-arch ready (all below are).
- **SDK 56's expo-router forked React Navigation internals.** Do **not** import `@react-navigation/*` in app code; import navigation types/helpers from `expo-router` entry points only.

| Package | Version | Notes |
|---|---|---|
| `expo` | `~56.0.x` | Install everything Expo-managed via `npx expo install` so the SDK pins exact versions |
| `react-native` | `0.85.3` (bundled) | |
| `react` | `19.2.3` (bundled) | |
| `expo-router` | bundled with SDK 56 (v56-forked router) | File-based routing; typed routes on |
| `react-native-reanimated` | `~4.3.1` | Requires `react-native-worklets ~0.8.3`; babel plugin is `react-native-worklets/plugin` (replaces the old reanimated plugin) |
| `react-native-gesture-handler` | `~2.31.1` | |
| `react-native-svg` | `15.15.4` (bundled) | Map connectors, progress ring |
| `lottie-react-native` | SDK-bundled (`npx expo install`, 7.x line) | Use `.json` Lottie (not `.lottie` — known Android issues in Expo) |
| `@tanstack/react-query` | `^5.101.2` | v5 stable |
| `zustand` | `^5.0.x` | |
| `i18next` | `^25.x` | |
| `react-i18next` | `^16.x` | |
| `expo-localization` | SDK-bundled | Device locale detection only |
| `expo-secure-store` | SDK-bundled | Tokens |
| `expo-haptics` | SDK-bundled | |
| `expo-notifications` | SDK-bundled | Local notifications v1; test in a dev build (Expo Go notification support is limited since SDK 53) |
| **`expo-audio`** | SDK-bundled | **This is the current one.** `expo-av` is deprecated and removed — do not install it. Gotcha: `expo-audio` does not auto-rewind on finish; call `seekTo(0)` before replaying an SFX |
| `expo-font` + `@expo-google-fonts/nunito` + `@expo-google-fonts/dm-sans` | latest | |
| `lucide-react-native` | `^0.5xx` | Icons (needs react-native-svg, present) |
| `@gorhom/bottom-sheet` | `^5.x` | Feedback sheet. Verify Reanimated-4 compat at install; fallback = custom Reanimated sheet (spec in §4b) |
| `axios` | `^1.x` | Refresh-interceptor ergonomics |
| `@react-native-async-storage/async-storage` | SDK-bundled | Query persistence + zustand persist |
| `expo-application`, `expo-constants`, `expo-splash-screen`, `expo-status-bar` | SDK-bundled | |
| Dev: `jest-expo`, `@testing-library/react-native ^13`, `typescript ~5.9`, `eslint-config-expo` | | |

### Styling: **StyleSheet + typed theme tokens — not NativeWind.** Justification:
1. Claymorphism is a *shadow/radius/layer* system, not a utility-class system: each clay surface is 2–3 stacked views (outer shadow, surface, inner highlight). These are reusable **components with token props**, not class strings; NativeWind adds nothing there.
2. Per-subject accent colors are **runtime-dynamic** (subjects are data-driven from the API). Tailwind class generation is build-time; dynamic accents force style-prop escape hatches anyway.
3. Animations are Reanimated `useAnimatedStyle` — style objects, not classes.
4. NativeWind v5 (needed for Tailwind 4) is still a **preview** on SDK 56; v4 stable means being stuck on Tailwind 3. Zero-churn StyleSheet wins for a solo dev.

---

## 2. Repo folder structure (`app/` workspace of the Maal monorepo)

Note: the Expo project lives at `Maal/app/`; inside it, expo-router's route dir is `src/app/` (using the `src/` app directory convention supported by expo-router).

```
app/
├── app.config.ts
├── package.json
├── tsconfig.json                  # strict, paths: "@/*" -> "./src/*"
├── babel.config.js                # preset: babel-preset-expo; plugins: [react-native-worklets/plugin]  (LAST)
├── metro.config.js
├── jest.config.js                 # preset: jest-expo
├── .env.example                   # EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
├── eas.json                       # dev / preview / production profiles (stub until store accounts)
├── assets/
│   ├── fonts/                     # (via @expo-google-fonts, none needed here)
│   ├── images/icon.png, splash.png, adaptive-icon.png    # placeholders
│   ├── lottie/
│   │   ├── mascot-idle.json  mascot-celebrate.json  mascot-sad.json  mascot-thinking.json
│   │   ├── confetti.json  flame.json  trophy-pop.json
│   └── sounds/
│       ├── correct.mp3  wrong.mp3  level-complete.mp3  combo.mp3  xp-tick.mp3
└── src/
    ├── app/                       # EXPO-ROUTER ROUTES (thin files: compose feature screens)
    │   └── (see §3 for full tree)
    ├── api/
    │   ├── client.ts              # axios instance + auth/refresh interceptors
    │   ├── endpoints.ts           # path constants
    │   ├── types.ts               # DTOs mirrored from DRF serializers
    │   └── queries/               # one file per domain: hooks + query keys
    │       ├── keys.ts            # central queryKey factory
    │       ├── auth.ts  subjects.ts  map.ts  session.ts  profile.ts
    │       ├── leaderboard.ts  friends.ts  achievements.ts  stats.ts  monetization.ts
    ├── features/                  # screen-level components + feature logic
    │   ├── auth/        (WelcomeScreen, LoginForm, RegisterForm, ForgotPassword)
    │   ├── map/         (LevelsMap, LevelNode, UnitHeader, MapConnector, SubjectSwitcherSheet, useMapLayout.ts)
    │   ├── session/     (SessionScreen, QuestionRenderer/, AnswerOption, FeedbackSheet,
    │   │                 SessionHeader, ComboBadge, ResultsScreen, useSessionEngine.ts)
    │   ├── leagues/     (LeagueScreen, LeaderboardList, LeagueBadge, PromotionZones)
    │   ├── quests/      (QuestsScreen, QuestCard, DailyQuestProgress)
    │   ├── profile/     (ProfileScreen, StatsScreen, AchievementsGrid, SettingsScreen)
    │   ├── friends/     (FriendsList, FriendSearch, RequestsList, ChallengeSheet)
    │   ├── streak/      (StreakScreen, StreakCalendar, StreakSavedModal)
    │   └── paywall/     (PaywallScreen, entitlements.ts  # abstraction; RevenueCat later)
    ├── components/                # design-system primitives (see §6)
    │   ├── clay/ (ClayButton, ClayCard, ClayIconButton, ClaySurface, ClayInput)
    │   ├── feedback/ (Toast, ToastProvider, EmptyState, ErrorState, Skeleton, OfflineBanner)
    │   ├── game/ (HeartCounter, XPBadge, StreakFlame, ProgressBar, StarRating, GemCounter)
    │   ├── mascot/ (Mascot.tsx, mascotStates.ts)
    │   └── layout/ (Screen.tsx, BottomSheet.tsx, PressableScale.tsx)
    ├── stores/
    │   ├── sessionStore.ts        # zustand — in-session game state (persisted for crash recovery)
    │   ├── settingsStore.ts       # zustand/persist — sound, haptics, reduced motion override, locale
    │   └── uiStore.ts             # ephemeral: active toast, subject switcher open, etc.
    ├── theme/
    │   ├── tokens.ts              # colors, spacing, radii, shadows, typography (see §6)
    │   ├── subjectAccents.ts      # slug -> accent palette mapping + fallback generator
    │   └── ThemeProvider.tsx      # light-first; dark tokens wired but disabled v1
    ├── i18n/
    │   ├── index.ts               # i18next init, expo-localization detection, fr fallback
    │   └── locales/fr/{common,auth,map,session,leagues,profile,errors,paywall}.json
    │   └── locales/en/…           # same namespaces, stubs
    ├── lib/
    │   ├── haptics.ts             # wrapper honoring settingsStore.hapticsEnabled
    │   ├── sounds.ts              # expo-audio player pool, honors soundEnabled, seekTo(0) rewind
    │   ├── notifications.ts       # streak reminder scheduling
    │   ├── format.ts              # Intl number/date with active locale
    │   └── analytics.ts           # no-op stub v1
    └── test/                      # test utils: renderWithProviders, msw-style API mocks
```

---

## 3. Navigation map (expo-router, `src/app/`)

```
src/app/
├── _layout.tsx                    # Root: fonts, ThemeProvider, QueryClientProvider, i18n,
│                                  #  GestureHandlerRootView, BottomSheetModalProvider, ToastProvider,
│                                  #  auth gate (redirect (auth) vs (tabs)), splash hold
├── (auth)/
│   ├── _layout.tsx                # stack, headerShown:false
│   ├── welcome.tsx                # PUSH  /welcome — mascot hero, "Commencer" / "J'ai déjà un compte"
│   ├── register.tsx               # PUSH  /register
│   ├── login.tsx                  # PUSH  /login
│   └── forgot-password.tsx        # PUSH  /forgot-password
├── (tabs)/
│   ├── _layout.tsx                # 4 tabs, custom clay tab bar
│   ├── index.tsx                  # TAB 1 "Apprendre" — LEVELS MAP (hero screen §4a)
│   ├── leagues.tsx                # TAB 2 "Ligue" — weekly league + leaderboard
│   ├── quests.tsx                 # TAB 3 "Quêtes" — daily/weekly quests + achievements entry
│   └── profile.tsx                # TAB 4 "Profil" — stats summary, friends entry, settings entry
├── session/
│   ├── _layout.tsx                # fullScreenModal stack, gestureEnabled:false (no swipe-dismiss)
│   ├── [levelId].tsx              # MODAL /session/:levelId — question loop (hero screen §4b)
│   └── results.tsx                # PUSH within session stack — celebration; only exit = CTA buttons
├── subject/
│   └── switcher.tsx               # MODAL (formSheet) — subject grid switcher
├── friends/
│   ├── index.tsx                  # PUSH — friends list + requests badge
│   ├── search.tsx                 # PUSH — user search
│   └── challenges.tsx             # PUSH — sent/received challenges
├── profile/
│   ├── stats.tsx                  # PUSH — detailed stats (premium-gated sections)
│   ├── achievements.tsx           # PUSH — trophies grid
│   └── settings.tsx               # PUSH — account, sound/haptics, language, logout, delete account
├── streak.tsx                     # MODAL (transparent) — streak day-earned overlay
├── paywall.tsx                    # MODAL (pageSheet) — premium upsell; opened from locks everywhere
├── leaderboard/[leagueId].tsx     # PUSH — full leaderboard (from Leagues tab)
└── +not-found.tsx
```

**Modal vs push rules:** anything that interrupts flow (session, paywall, streak celebration, subject switcher) is a modal; anything drill-down (friends, stats, settings, achievements) is a push inside the tabs stack. The session stack disables swipe-back so hearts can't be dodged; quitting mid-session goes through a "Tu vas perdre ta progression" confirm dialog.

**Auth gate:** root `_layout` reads token presence from secure store (bootstrapped into a tiny `authStore`); `<Redirect>` between `(auth)` and `(tabs)`. Deep links: scheme `maal://` — `maal://session/:levelId` (from challenge notifications later).

---

## 4. Hero screens

### 4a. LEVELS MAP (`(tabs)/index.tsx` → `features/map/`)

**Implementation choice: virtualized FlatList of node rows with deterministic sine-curve offsets + short per-gap SVG connectors.** Rejected: one absolute-positioned canvas with a single giant SVG path — with 8 subjects × dozens of units it means thousands of mounted views, full-height layout, and giant-path re-renders on any state change. FlatList gives virtualization, `getItemLayout` (fixed row height = trivially computable), and `scrollToIndex` for free.

- **Data:** `GET /api/v1/subjects/{id}/map/` → `{ units: [{ id, title, order, levels: [{ id, order, status, stars, isLegendary }] }] }`. Flatten to a render list: `[{type:'unitHeader'}, {type:'node'}, ...]`.
- **Layout math (`useMapLayout.ts`):** row height 108; node x-offset = `centerX + amplitude * sin(globalIndex * 0.9)` with amplitude ≈ 34% of screen width, clamped to padding. Deterministic → `getItemLayout` exact → instant `scrollToIndex` to current level on mount (with `viewPosition: 0.5`).
- **Connectors:** each node row renders one `<Svg>` quadratic-bezier segment from its own center to the *previous* node's center (previous offset is computable from index — no measurement). Completed segments in subject accent, upcoming in `neutral300`, dashed for locked.
- **Node states** (`LevelNode`, 76px clay sphere):
  - `locked` — grey clay, lucide `Lock`, 60% opacity, press = clay-shake + toast "Termine le niveau précédent !"
  - `active` — subject accent, floating "COMMENCE" tooltip bobbing (Reanimated loop), pulsing outer ring, mascot peeks beside it
  - `completed` — accent fill + 1–3 gold star overlay under the node
  - `legendary` — gold gradient clay + trophy icon (perfect/no-heart-lost re-clear)
  - `premiumLocked` — violet clay + `Crown` icon → opens `/paywall`
- **Unit headers:** full-width clay banner: unit title, `n/m` progress pill, subject accent background. A sticky compact header (subject name + hearts + streak + XP) sits above the list; tapping subject name opens `/subject/switcher`.
- **Subject switcher:** formSheet modal, grid of subject clay cards (icon, accent, % complete ring). Selected subject persisted in `settingsStore.activeSubjectId`; map query keyed by it.

### 4b. QUESTION SESSION (`session/[levelId].tsx` → `features/session/`)

**Flow:** `POST /sessions/ {levelId}` → server returns session id + ordered questions (without correct answers). Each answer: `POST /sessions/{id}/answers/ {questionId, selected}` → returns `{correct, correctAnswer, explanation, mediaUrl, heartsLeft, comboCount}`. Server-authoritative grading (anti-cheat); UI reveals state from the response. `POST /sessions/{id}/complete/` → XP, stars, streak delta, achievements unlocked.

- **`useSessionEngine.ts`** drives a state machine: `loading → question(idle) → question(submitting) → feedback(correct|wrong) → next | outOfHearts | results`. All transient state in `sessionStore` (zustand).
- **SessionHeader:** `X` (quit-confirm) · segmented **ProgressBar** (fills with spring per question; wrong answers re-queue at the end, Duolingo-style, bar accounts for it) · **HeartCounter** (5 clay hearts; loss = scale-out + desaturate + `notificationAsync(Error)` haptic).
- **QuestionRenderer/** — one component per `question.type`:
  - `SingleChoice.tsx` — MCQ, 2–5 `AnswerOption` clay cards
  - `MultiChoice.tsx` — checkbox variant + "Valider" ClayButton
  - `TrueFalse.tsx` — two big side-by-side clay buttons
  - `ImageQuestion.tsx` — zoomable image (pinch, gesture-handler) above options
  - `PassageQuestion.tsx` — collapsible passage card (scrollable, "Lire le texte" expander) + question below
  - `types.ts` discriminated union keeps this open for tomorrow's real data format.
- **AnswerOption states:** `idle` (clay neutral) → `selected` (accent border + lift, `selectionAsync` haptic) → on reveal: `correct` = success green fill + `Check` + `notificationAsync(Success)` + `correct.mp3` + spring pop; `wrong` = red fill + `X` + error haptic + horizontal shake (Reanimated `withSequence`) + `wrong.mp3`; the true answer simultaneously highlights green.
- **Combo streak:** consecutive-correct counter in `sessionStore`; at 3+ a `ComboBadge` flame pill appears by the progress bar ("x3 🔥" — flame is the Lottie/icon, not emoji), escalating color + `combo.mp3`; combo ≥5 grants bonus XP (server computes, client mirrors for display).
- **FeedbackSheet** (`@gorhom/bottom-sheet`, non-dismissable snap ~45%/90%): green/red header strip ("Excellent !" / "Pas tout à fait…"), correct answer, explanation text, and the "TikTok-style" media slot — 9:16 rounded video (`expo-video` player, muted autoplay, tap for sound) or image when the question has `media`. Footer: full-width ClayButton "Continuer" (green/red themed). Mascot mini-pose (celebrate/sad) in the corner.
- **Out of hearts:** blocking modal — mascot sad, options: "Regarde la carte" (quit) / premium pitch → `/paywall` (unlimited hearts is premium) / hearts refill timer text.
- **ResultsScreen:** staged Reanimated choreography — (1) stars punch in one-by-one with haptic ticks, (2) **XP count-up** (`useDerivedValue` + `withTiming` driving an AnimatedText, `xp-tick.mp3` loop), (3) Lottie `confetti.json` overlay + mascot celebrate, (4) stat rows (précision %, combo max, temps), (5) streak day flash → routes to `/streak` modal if a new streak day was earned, (6) CTAs: "Continuer" (back to map, map query invalidated) / "Rejouer".

---

## 5. State & data

**TanStack Query = all server state. Zustand = device/session state. Never duplicate.**

- **Query keys (`api/queries/keys.ts`):**
  ```ts
  keys.me = ['me']
  keys.subjects = ['subjects']
  keys.map = (subjectId) => ['map', subjectId]
  keys.hearts = ['hearts']
  keys.league = ['league','current']
  keys.leaderboard = (leagueId) => ['leaderboard', leagueId]
  keys.friends = ['friends']; keys.friendRequests = ['friends','requests']
  keys.achievements = ['achievements']; keys.quests = ['quests']
  keys.stats = (subjectId?) => ['stats', subjectId ?? 'all']
  ```
- **Defaults:** `staleTime: 60s` global; map/subjects `staleTime: 5min`; leaderboard `refetchInterval: 30s` while the Leagues tab is focused (poll — no websockets v1, "real-time" = fast polling). `retry: 2` except mutations `retry: 0`.
- **Optimistic hearts:** answer mutation `onMutate` decrements `keys.hearts` cache immediately when the local grader can't know correctness — actually correctness is server-decided, so hearts decrement optimistically only on *reveal-wrong* is impossible; instead: decrement on wrong response receipt (authoritative), but **optimistically restore/refetch** via `onSettled` invalidate. Hearts *regeneration timer* is client-rendered from `nextHeartAt` timestamp in the hearts payload.
- **Persistence/offline:** `@tanstack/react-query-persist-client` + AsyncStorage persister for `subjects`, `map`, `me`, `achievements` (maxAge 24h) → map browsable offline. **Decision: block session start offline.** Grading, hearts, XP and anti-cheat are server-authoritative; offline sessions would fork truth. Offline UX: `OfflineBanner` (NetInfo via `expo-network`), active node press shows "Connecte-toi à Internet pour jouer".
- **Auth/token layer (`api/client.ts`):** axios instance, `baseURL = process.env.EXPO_PUBLIC_API_URL`. Access+refresh in `expo-secure-store` (`maal.access`, `maal.refresh`). Request interceptor injects Bearer. Response interceptor on 401: single-flight refresh mutex (queue concurrent 401s behind one `POST /auth/token/refresh/`), replay originals; refresh failure → purge store, reset query cache, redirect `(auth)/welcome`. Access token also mirrored in memory to avoid SecureStore reads per request.
- **`sessionStore` (zustand):** `{ sessionId, levelId, queue, currentIndex, answers[], combo, heartsAtStart, status }` — persisted (see §10 crash recovery). `settingsStore` persisted via `zustand/middleware persist` + AsyncStorage.

---

## 6. Design system implementation

**`theme/tokens.ts`** (single source of truth, plain typed objects):

```ts
colors: {
  primary:    { 50:'#F5F3FF', 300:'#C4B5FD', 500:'#8B5CF6', 600:'#7C3AED', 700:'#6D28D9' },
  xpGold:     '#F59E0B',  streakOrange: '#F97316',  heartsRed: '#EF4444',
  success:    '#22C55E',  successDeep: '#16A34A',  danger: '#EF4444', dangerDeep:'#DC2626',
  neutral:    { 0:'#FFFFFF', 50:'#FAF9FC', 100:'#F3F1F8', 300:'#D8D4E3', 500:'#8E8AA0', 700:'#4B4763', 900:'#241F3E' },
  // dark-mode token set mirrored, unused v1
}
subjectAccents: { biology:'#10B981', chemistry:'#06B6D4', physics:'#3B82F6', math:'#8B5CF6',
  french:'#EC4899', english:'#F59E0B', culture:'#EF4444', logic:'#14B8A6', _fallback: hashToHue(slug) }
spacing: 4-base scale → { xs:4, s:8, m:12, l:16, xl:24, xxl:32, xxxl:48 }
radii: { s:12, m:20, l:24, xl:32, pill:999 }        // clay range 20–32
shadows (clay presets):
  clayRaised:  outer { color:'#241F3E', opacity:0.14, radius:16, offsetY:8, elevation:8 }
               + inner-highlight: top hairline View, rgba(255,255,255,0.65)
  clayPressed: radius:6, offsetY:2, elevation:2      // swapped in while pressed
  clayFloating (modals): radius:24, offsetY:12
typography: Nunito 800/900 → display 32/38, h1 26/32, h2 20/26;  DM Sans → body 16/24, small 14/20, caption 12/16
```

**Core components (`src/components/`):** `PressableScale` (base), `ClayButton` (variants primary/secondary/success/danger/gold; sizes m/l; loading state), `ClayCard`, `ClaySurface`, `ClayIconButton`, `ClayInput`, `ProgressBar` (segmented + continuous), `HeartCounter`, `XPBadge`, `StreakFlame` (Lottie flame ≥1, grey outline at 0), `GemCounter` (future currency, stub), `LevelNode`, `AnswerOption`, `StarRating`, `BottomSheet` (wrapper), `Toast`/`ToastProvider`, `EmptyState` (mascot + message + CTA), `ErrorState` (retry), `Skeleton` (shimmer via Reanimated), `OfflineBanner`, `Mascot`, `Screen` (safe-area + bg).

**Press pattern (`PressableScale`)** — every tappable clay element: `scale: withSpring(pressed ? 0.95 : 1, { damping: 15, stiffness: 400 })`, simultaneous shadow swap raised→pressed (translateY +4 of the surface layer), `Haptics.impactAsync(Light)` on pressIn via `lib/haptics.ts` (respects settings toggle).

**Reduced motion:** Reanimated `useReducedMotion()` OR `settingsStore.reduceMotion` → global `motion.ts` helper returns durations 0 / disables loops; Lottie components render final frame statically; confetti skipped; count-ups render final value instantly.

---

## 7. i18n

- `i18n/index.ts`: i18next + react-i18next, `lng` = persisted user choice ?? `expo-localization` device locale ?? `'fr'`; `fallbackLng: 'fr'`; `compatibilityJSON: 'v4'`. Namespaces = the 8 JSON files per locale (§2); keys like `session.feedback.correct.title`.
- **Tone: tutoiement partout**, Duolingo-France energy, short punchy lines: "C'est parti !", "Tu déchires !", "Aïe, pas tout à fait…", "Reviens demain pour garder ta série !". Interpolation for gamified values: `"+{{xp}} XP"`, plurals via i18next plural rules (`"level_one"/"level_other"`).
- Numbers/dates through `lib/format.ts` using `Intl.NumberFormat(activeLocale)` (Hermes has full Intl). XP "1 234" (fr narrow-nbsp grouping), dates via `Intl.DateTimeFormat`. English = same namespace files, machine-stubbed v1.

---

## 8. Mascot

- `components/mascot/Mascot.tsx`: `<Mascot state="idle|celebrate|sad|thinking" size loop />` wrapping `lottie-react-native`; `mascotStates.ts` maps state → `require('assets/lottie/…')`. Placeholder assets: free/CC-licensed character animations from LottieFiles (pick one consistent free character pack; attribute in README) — swapped later for the branded mascot by replacing 4 JSON files, zero code change. Reduced-motion → static first frame.
- Appears: welcome/auth hero (idle, large), map beside active node (small idle loop, `speed 0.6`), feedback sheet corner (celebrate/sad mini), results (celebrate hero), empty/error states (thinking/sad), streak modal (celebrate), out-of-hearts (sad), paywall (celebrate w/ crown).

---

## 9. Notifications (v1 — local only, no push infra)

- `lib/notifications.ts` with `expo-notifications`: one daily **streak reminder** — after each completed session, cancel + reschedule a local notification for 19:30 next day ("Ta série de {{n}} jours t'attend ! 🔥" — flame via emoji acceptable *in notification text only*, or plain text). If streak at risk (no session by 19:30), that's exactly when it fires.
- **Permission UX:** never ask at launch. Trigger after the **first completed session**, via an in-app clay pre-prompt modal ("On te prévient pour ne pas casser ta série ?") → only on "Oui" call `requestPermissionsAsync()` (one shot at the OS dialog). Denied → settings row offers deep link to OS settings.
- Android: create channel `streak` (importance default). Test in a **dev build**, not Expo Go. Push notifications (challenges, league end) = v2, `expo-notifications` push tokens ready for it.

---

## 10. Error / loading UX

- **Skeletons:** map (node placeholder column), leaderboard rows, profile header — `Skeleton` shimmer; never spinners on full screens.
- **Retry:** `ErrorState` (mascot-thinking + "Réessayer") for query errors on screen roots; inline toast for mutation errors (`ToastProvider` top clay toast, auto-dismiss 3s, error/success/info variants).
- **Global:** QueryClient `onError` → toast unless the screen handles it; 401 handled by interceptor (silent); 5xx toast "Oups, nos serveurs toussent. Réessaie."
- **Session crash recovery:** `sessionStore` persisted to AsyncStorage on every answer. On app relaunch, if a persisted session `status === 'inProgress'` and `startedAt < 30min` ago → modal "Reprendre ta partie ?" → rehydrate and resume at `currentIndex` (server session is still open; backend keeps sessions alive 30min). Refuse/expired → `POST /sessions/{id}/abandon/`, clear store.

---

## 11. App config & env

- **`app.config.ts`:** `name: "Maal"` (placeholder), `slug: "maal"`, `scheme: "maal"`, `orientation: "portrait"`, `userInterfaceStyle: "light"`, placeholder icon/adaptive-icon/splash (violet bg), `ios.bundleIdentifier: "com.maal.app"` / `android.package: "com.maal.app"` (placeholders, changeable pre-store), plugins: `expo-router`, `expo-secure-store`, `expo-notifications`, `expo-audio`, `expo-font`; `experiments: { typedRoutes: true }`. `extra.eas.projectId` added when EAS is initialized; build profiles in `eas.json` (`development` = dev client, `preview` = internal APK/TestFlight, `production`).
- **Env:** `EXPO_PUBLIC_API_URL` via `.env` (gitignored) + `.env.example`. Dev on **Windows 11 + physical phone**: `localhost` won't work — use the PC's LAN IP (`ipconfig` → `http://192.168.1.x:8000`), ensure Django/Docker binds `0.0.0.0:8000` and **add a Windows Defender Firewall inbound rule for TCP 8000** (the classic gotcha — Docker Desktop published ports are still blocked for LAN peers by firewall). Android emulator alternative: `http://10.0.2.2:8000`. Document both in README; consider `adb reverse tcp:8000 tcp:8000` for USB-connected Android.
- Workflow: **dev builds** (`npx expo run:android` / EAS dev client) from week 1 — Lottie/notifications/audio behave differently in Expo Go.

---

## 12. Testing (v1 scope — jest-expo + @testing-library/react-native v13)

Worth testing (pure logic, high regression value):
1. **`useSessionEngine` / `sessionStore`** — state machine transitions: correct/wrong requeue order, combo increment/reset, hearts-zero branch, completion payload, crash-recovery rehydration.
2. **Grading *display* logic** — given a server answer response, `AnswerOption` renders correct/wrong/reveal states (RTL render tests on `QuestionRenderer` variants incl. multi-choice validate button enablement).
3. **`api/client.ts`** — 401 → single refresh → replay queue; refresh failure → logout path (axios-mock-adapter or jest mocks).
4. **`useMapLayout`** — offset determinism, `getItemLayout` correctness, current-node index resolution.
5. **`lib/format.ts` + i18n plurals** — fr number grouping, XP/plural keys.
6. Snapshot-free component tests for `ClayButton` (disabled/loading) and `HeartCounter`.
Skip v1: E2E (Maestro later), visual regression, animation testing.

---

Sources: [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56), [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57), [Expo SDK versions reference](https://docs.expo.dev/versions/latest/), [expo-audio docs](https://docs.expo.dev/versions/latest/sdk/audio/), [expo-av (deprecated) docs](https://docs.expo.dev/versions/v54.0.0/sdk/audio-av/), [What's New in Expo SDK 56 (Onix)](https://medium.com/@onix_react/whats-new-in-expo-sdk-56-63f704fc8426), [AniUI Expo 56 compatibility matrix](https://www.aniui.dev/docs/expo-56), [NativeWind v5 installation](https://www.nativewind.dev/v5/getting-started/installation), [NativeWind v4→v5 migration discussion](https://github.com/nativewind/nativewind/discussions/1617), [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query), [lottie-react-native releases](https://github.com/lottie-react-native/lottie-react-native/releases), [.lottie files Android issue](https://github.com/expo/expo/issues/39509), [react-i18next docs](https://react.i18next.com/)