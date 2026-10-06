# v1 engineering review → v2 changes

I reviewed v1 the way a senior engineer would before shipping: I read every module, ran an end-to-end browser test at iPhone size (21 checks, with a fake camera showing a real QR code), and profiled it against two years of synthetic training data. Every item below is something I **observed** in v1, not a hypothetical. Each one is fixed in v2 unless it is marked *deferred*.

Severity: 🔴 must fix · 🟠 should fix · 🟡 polish

## Bugs found in testing
| # | Sev | Finding (v1) | v2 fix |
|---|---|---|---|
| B1 | 🟠 | The chart crosshair is "hidden" by parking it at x = −10, but the SVG has `overflow: visible`, so a **stray vertical line** shows left of the bodyweight chart. | Hide it with `visibility` instead of moving it off-plot. |
| B2 | 🟠 | The forecast line starts from the *regression* value, not your last real point. The tooltip on today shows "161 lb e1RM" **and** "157 lb Forecast". | Anchor the forecast at the last actual value. |
| B3 | 🟠 | Me tab: the inputs inside the collapsible sections are `width: 100%` **plus** side margins, so they **overflow the card** on the right. | Pad the section instead of the children. |
| B4 | 🟠 | The rest-timer pill and toasts **cover content** (forecast text, the last set) on every tab. | Reserve bottom space while the timer runs; stack the toast above the pill. |
| B5 | 🔴 | **Race:** the router navigates via async `hashchange`, which closes any open sheet. After a weigh-in from Today/Me with Apple Health on, the "Send to Health" sheet opens and is **closed instantly**. The scale-QR flow relies on a 50 ms `setTimeout` to dodge the same race. | `go()` navigates synchronously (`pushState` + render). No timers. |
| B6 | 🟡 | `fmtSet()` escapes the cardio level, then callers escape it again (`&` → `&amp;amp;`). | Return plain text; escape once at the edge. |
| B7 | 🟠 | The RPE choice **resets after every set**, so sets 2–3 were logged without RPE. RPE is the main safety signal Coach Claude uses for a cardiac-care plan. | Carry the previous set's RPE forward, preselected. |
| B8 | 🟡 | Light mode: the activity-ring tracks are the same hue as the gradient behind them, so the rings almost **disappear**. | Darker backdrop disc + stronger tracks. |

## Security
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| S1 | 🔴 | `/api/coach` **fails open**: if `COACH_PASSCODE` isn't set, anyone who finds the URL can spend your Anthropic credits. The repo is public, so the URL is guessable. | Fail closed. The passcode is required unless `COACH_ALLOW_OPEN=1`, and it's compared in constant time. |
| S2 | 🟠 | The machine's "Training video" link goes straight into `href`. A `javascript:` URL typed into Edit, or inside a crafted backup file, would run script. | Allow only `http(s)` links, both on save and at render. |
| S3 | 🟡 | CSV export: a note starting with `=`, `+`, `-` or `@` becomes a **formula** in Excel/Numbers. | Neutralise formula-leading cells. |
| S4 | 🟠 | Restore writes any JSON into storage with no shape check. A wrong file can brick the app. | Validate types per key before writing anything. |

## Reliability & your data
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| R1 | 🔴 | Any unexpected stored value (e.g. `wh_log` not an array) **throws during render, leaving a white screen**, with no way to rescue your data. | Typed loaders, plus a render error boundary that shows a "Download my data" rescue button. |
| R2 | 🟠 | iOS can evict web-app storage under pressure, and nothing nudges you to back up. | Ask for persistent storage (`navigator.storage.persist()`). Show a backup reminder when the last backup is over 14 days old. |
| R3 | 🔴 | The service worker is **cache-first with a hand-bumped version**. Forget one bump and every iPhone runs the old app forever. | Network-first for app files, cache as offline fallback. New deploys show up on the next open. |
| R4 | 🟠 | The camera keeps running when you switch apps, and the video is frozen when you come back. | Stop when hidden, restart when visible. |

## Performance
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| P1 | 🟠 | Storage is re-parsed on almost every call: `exById()` rebuilds the whole exercise catalog **per lookup**, and `getLog()` re-parses ~0.5 MB after 2 years. Measured: Strength page **242 ms** at 4× CPU throttle. | In-memory cache, invalidated on write. |
| P2 | 🟠 | QR decoding runs jsQR on the **full 720 px frame with both colour inversions every 150 ms**. That's heavy on an iPhone's battery and CPU, and small codes are harder to read. | Decode the centre square (the on-screen frame) and try a normal pass first. |
| P3 | 🟡 | The Progress views compute the exercise history twice (once in render, once in mount). | Compute once per render. |

## Coaching quality
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| C1 | 🔴 | The strength forecast extrapolates linearly: *+6.2 lb/week → 206 lb in 8 weeks*. That's unrealistic, and it contradicts the app's own safety rule (≤ 1 increment per week). | Cap the projected rate at one increment per week and label it honestly. |
| C2 | 🟡 | Coach Claude's next-session targets live only on the Coach screen, not at the machine where you need them. | The logger shows Coach's target when a report from the last 14 days has one. |

## UX
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| U1 | 🟡 | "Create an exercise" uses the browser's `prompt()`. | A proper sheet (name + how it's logged). |
| U2 | 🟡 | Weigh-ins can only be for *today*. | Date field (defaults to today). |
| U3 | 🟡 | The scan beep never plays on iPhone: Safari only allows audio after a tap, and the decode isn't one. | Unlock audio on the first tap. |
| U4 | 🟡 | Sheets don't return focus to the button that opened them (VoiceOver/keyboard). | Restore focus on close. |

## Tests & maintainability
| # | Sev | Finding | v2 fix |
|---|---|---|---|
| T1 | 🔴 | **No automated tests.** Migration and forecast math are exactly the code that silently corrupts data or misleads. | `node --test` suites for util, analytics, store migration/import and the API handler, plus GitHub Actions CI on every PR. |
| T2 | 🟡 | Dead `setup` field written on every machine (setup notes live in `wh_setup`). | Removed. |

## Deferred (worth doing, not in v2)
- **Cloud sync/backup (Supabase).** Needs accounts and a schema. The JSON backup covers it for now.
- **Live verification of Coach Claude against the real API.** The request shape is checked against the SDK and the handler's error paths are tested. A real call needs your API key in Vercel.
- **Log sets for a past date.** Weigh-ins get a date field in v2; sets are next.
- **`color-mix()` needs iOS 16.2+.** Fine for current iPhones; older iOS would need fallbacks.
