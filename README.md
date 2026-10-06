# 5am Workout 🏋️‍♂️📷

An iPhone web app (installs to your home screen) for **Crunch Stratford**: scan the QR sticker on any machine, log your sets, track the gym scale, and let **Coach Claude** analyze your training and forecast the best path to your goal.

- **Scan → log.** Every machine's QR code (the one that opens the training video) becomes that machine's ID. First scan: name it once. After that, a scan jumps straight to the logger, with a ▶ button for the video.
- **Set logger.** Big weight/rep steppers, RPE chips, a rest timer, last-time numbers, "today's target" (conservative double progression), PR confetti 🎉, and remembered seat/pin setup per machine.
- **Scale tracking.** Log weigh-ins from the Crunch scale (lb or kg, optional body fat and muscle). You get a 7-day average, the trend per week, and an ETA to your goal weight.
- **Progress charts.** Estimated 1-rep max per lift, plus bodyweight, each with a dashed forecast line.
- **Coach Claude.** Claude reads a snapshot of your log and returns an assessment, a dated forecast, exact targets for next session, a 4-week plan, habits, safety flags, and questions for your doctor. Your cardiologist limits are built into its instructions.
- **Apple Health bridge.** Sends weigh-ins and workouts to Health through two tiny Apple Shortcuts.
- **Safety first.** The ⚠ Safety panel, doctor checklist, cleared limits and supplement clearance from the original 5am app all carry over. Your old logs migrate automatically.

---

## GitHub vs Vercel vs Supabase: who does what 🧠

| Tool | Think of it as | What it does for this app | Needed now? |
|---|---|---|---|
| **GitHub** | The filing cabinet 🗄️ | Stores the code and its history. Claude pushes changes here as *branches* and *pull requests* (PRs). You review and press **Merge**. | ✅ Yes (already set up) |
| **Vercel** | The shop front 🏪 | Turns the code in GitHub into a live `https://…vercel.app` website your iPhone can open. Also runs the tiny server function that holds your **secret Claude API key**. Every push redeploys automatically. | ✅ Yes, for iPhone camera + Coach Claude |
| **Supabase** | An online vault 🔐 | A cloud database. We **don't use it yet**: your data lives on your phone. It's the next step if you want sync between devices or automatic cloud backup. | ❌ Not yet |

The flow is: **Claude edits code → GitHub (PR) → you Merge → Vercel redeploys → your iPhone app updates.**

---

## Put it on your iPhone (one-time, ~10 minutes)

### 1. Deploy on Vercel
1. Go to **vercel.com** and sign in **with GitHub**.
2. **Add New… → Project** and pick **SpencerHoskin/Workout-Helper** → **Import**.
3. Framework Preset: **Other**. Leave Build Command and Output Directory **empty**.
4. Open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY`: create one at **console.anthropic.com → API Keys** (it starts with `sk-ant-`).
   - `COACH_PASSCODE`: any secret phrase you make up (e.g. `brother-5am-2026`). **Required**: without it Coach Claude stays locked, because the repo is public and an open endpoint would let strangers spend your Claude credits.
5. Click **Deploy**. You get a URL like `https://workout-helper-xyz.vercel.app`.

> **Branches & previews:** Vercel's *production* site follows the repo's default branch. Every other branch (like the PR branches Claude makes) gets its own **Preview URL**, which you can test on your phone *before* merging. Preview links may ask you to log in to Vercel first; that's normal.

### 2. Install on the iPhone
1. Open your Vercel URL in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open **5am Workout** from the home-screen icon (not from Safari). Tap **Scan** and **Allow** the camera.
4. Go to **Me → ✨ Coach Claude setup** and enter the same `COACH_PASSCODE`.

### 3. (Optional) Apple Health
Go to **Me → ❤️ Apple Health** in the app for the step-by-step: you make two Shortcuts (`WH Log Weight`, `WH Log Workout`) and turn the switch on. An iPhone web app can't write to Health directly; Shortcuts is Apple's official bridge.

---

## Test at home (no gym needed)
Open **`/test-qr/`** on your deployed site (e.g. `https://…vercel.app/test-qr/`) on a laptop and scan those codes with the app on your phone. They're fake machines (leg press, cable station, chest press, scale) for trying the whole flow.

## Your data
- Everything is stored **on your phone** (in the browser's storage for this app). Nothing leaves it except when you press **Analyze**: that sends a training snapshot to *your* Vercel function, which forwards it to Claude.
- Back up now and then: **Me → ⚙️ Settings & data → Backup** (a JSON file; save it to Files/iCloud Drive). **Restore** loads it back after checking the file. **CSV** exports for spreadsheets. The Today screen reminds you when your last backup is over 2 weeks old.
- Prefer zero setup? **Progress → Coach → "Copy for the Claude app"** copies your data as a prompt you can paste into the Claude app.

## Cost
- Vercel Hobby: free.
- Claude API: pay-as-you-go. One analysis is roughly **5–10 cents**.

---

## For developers
```
index.html            app shell (tabs, sheet, safety overlay)
css/app.css           design tokens (light + dark), components, charts
js/app.js             boot, router wiring, event delegation
js/store.js           localStorage keys (STABLE), schema migration, backup
js/analytics.js       e1RM, trends, forecasts, progression (pure, unit-tested)
js/util.js            pure helpers (dates, parsing, QR normalising)
js/charts.js          dependency-free SVG line chart + activity rings
js/scanner.js         camera QR scanning (BarcodeDetector → jsQR fallback)
js/coach.js           builds the training snapshot, calls /api/coach
js/health.js          Apple Shortcuts bridge
js/views/*.js         Today, Machines, Scan, Logger, Progress, Me
api/coach.js          Vercel function → Claude (structured output, safety prompt)
sw.js                 offline cache
vendor/jsQR.min.js    QR decoder (Apache-2.0)
test-qr/              printable test codes
tests/                node --test suites
docs/REVIEW-v1.md     v1 engineering review → v2 change list
```
- Run locally: `npm install`, then `npm run dev` and open http://localhost:5173. The camera works on `localhost`; on a phone it needs https, so use a Vercel preview.
- Coach locally: `npx vercel dev` (after `npx vercel link`), with `ANTHROPIC_API_KEY` in `.env.local`.
- Tests: `npm test` (Node's built-in runner; covers util, analytics, storage migration/restore, the API function). GitHub Actions runs them on every PR.
- Storage keys in `js/store.js` are **stable**: never rename them; add a migration instead.
- `docs/REVIEW-v1.md` is the engineering review that drove v2.
