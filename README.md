# CSSLP Flashcards

A focused, offline-capable study app for the ISC2 **CSSLP** exam: flip cards with
narrated audio, plus practice exams — one deck and one question pool per domain.
No accounts, no tracking, no build step.

**188 cards** (each with pre-generated neural-voice audio for the question and
the answer) and **120 practice exam questions** across the 8 domains.

## Features

### Flashcards

- **Flip cards** — tap (or press Space) to reveal the answer.
- **Audio** — play the question or answer aloud (edge-tts `en-US-AndrewNeural`).
- **Autoplay** — plays question, then answer, then advances, hands-free.
- **Shuffle** and keyboard navigation (`←` `→`, Space to flip, `P` to play).

### Practice exams

- **Domain quiz** — 10 questions drawn from that domain's pool.
- **Full mock exam** — 100 questions, 150 minutes, timed, 70% to pass.
- **Study mode vs exam mode** (quizzes) — study mode gives immediate feedback
  and a tip after each answer; exam mode withholds everything until the review
  screen. The mock exam always runs in exam mode.
- **Randomized every attempt** — questions are sampled from a larger pool and
  the answer options are reshuffled, so no two runs are identical.
- **Review screen** — per-question explanations and a per-domain score breakdown.
- Once you've been through every flashcard, the app offers a mock exam once
  (dismissible, and remembered).

### Both

- **Installable (PWA)** and works **offline** once loaded.
- Light and dark themes.

## Domains

| # | Domain | Cards | Exam pool |
|---|--------|-------|-----------|
| 1 | Secure Software Concepts | 40 | 15 |
| 2 | Secure Software Lifecycle Management | 20 | 15 |
| 3 | Secure Software Requirements | 20 | 15 |
| 4 | Secure Software Architecture and Design | 26 | 15 |
| 5 | Secure Software Implementation | 25 | 15 |
| 6 | Secure Software Testing | 20 | 15 |
| 7 | Secure Deployment, Operations, Maintenance | 19 | 15 |
| 8 | Secure Software Supply Chain | 18 | 15 |
| | **Total** | **188** | **120** |

The mock exam draws 100 questions from the 120-question pool, so repeat attempts
are not identical.

## Run locally

**Windows:** double-click `start.bat`. It serves the folder and opens your
browser at <http://localhost:8000/>. Close the console window to stop.

**Anything else:** it is a static site, so any static server works:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` will not load `cards.json` due to
browser fetch rules; use a local server.)

## Deploy

Hosted with **GitHub Pages** from the `main` branch (root). Any static host
(Netlify, Vercel, Cloudflare Pages) works too — just serve the folder.

## Android app (offline APK)

A native Android build wraps the deck with [Capacitor](https://capacitorjs.com/).
It is **fully offline** (all cards, audio, and exam questions are bundled in the
APK), **locked to landscape**, and runs **immersive full-screen** (status and
navigation bars hidden). Domains, practice exams, and the theme switch live in a
slide-in menu; the stage shows only the card and its controls with the card
number.

Download the ready-built APK from the repo's
[**Releases**](../../releases) and install it (enable "install from unknown
sources" when prompted).

### Build it yourself

Requires **JDK 21** (Android Studio's bundled JBR works) and the Android SDK.

```bash
npm install
node scripts/sync-assets.mjs          # copy cards.json + audio/ + exam files into app/
npx cap sync android
cd android && ./gradlew assembleDebug  # -> app/build/outputs/apk/debug/app-debug.apk
```

The APK shell (`app/index.html`, `app/styles.css`, `app/app.js`) is separate from
the web version at the repo root, which is left unchanged. The exam engine
(`exam.js`, `exam.css`) and all deck data are shared: a single source of truth
lives at the repo root and `scripts/sync-assets.mjs` copies it into `app/` at
build time, so those copies are gitignored.

## Structure

```
index.html              web app shell (portrait, GitHub Pages)
styles.css              web design system (teal on slate, light/dark)
app.js                  web: flip / audio / autoplay / navigation
exam.js                 quiz + mock exam engine (shared by web and APK)
exam.css                exam UI styles (shared by web and APK)
cards.json              the 188 cards + audio paths (source of truth)
exams.json              the 120 exam questions + quiz/mock config (source of truth)
audio/d1..d8/*.mp3      narrated question (-q) and answer (-a) clips
manifest.webmanifest    PWA metadata
sw.js                   offline service worker (web)
app/                    APK web assets (landscape + immersive UI)
android/                Capacitor Android project
scripts/sync-assets.mjs copies cards.json + audio/ + exam files into app/ for the APK
```

### Editing the exam pool

`exams.json` holds the config and the per-domain question pools:

```jsonc
{
  "passMark": 0.7,                        // 70% to pass
  "quiz":  { "count": 10 },               // questions per domain quiz
  "mock":  { "count": 100, "minutes": 150 },
  "domains": [
    {
      "id": "d1", "num": 1, "name": "Secure Software Concepts",
      "pool": [
        {
          "q": "…question text…",
          "options": ["A", "B", "C", "D"],
          "correct": [2],                 // zero-based; >1 entry = multi-select
          "explanation": "…why…",
          "tip": "…one-line takeaway…"
        }
      ]
    }
  ]
}
```

`quiz.count` and `mock.count` are clamped to the available pool size at runtime,
so the app never asks for more questions than exist — but keep the pool larger
than `mock.count` if you want attempts to differ from each other.

## Content

All cards and exam questions are original study material written against the
public CSSLP exam outline. Not affiliated with or endorsed by ISC2.
