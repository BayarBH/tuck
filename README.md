# Tuck

**Copy it. Tuck it.** While reading articles or AI replies, **double-tap or hold Ctrl+C** to append the selected text to a Markdown file without breaking your reading flow. A single Ctrl+C is completely unaffected and never recorded.

Windows 10/11. **macOS is in beta** (trigger: **⌘C**); it builds and starts in CI but has not been verified on real hardware yet, see [macOS (beta)](#macos-beta). Linux is not supported.

- Landing page: [`docs/index.html`](docs/index.html) (self-contained, no external requests; ready for GitHub Pages from `/docs`, not enabled yet)
- Privacy statement: [`PRIVACY.md`](PRIVACY.md)
- Code signing options and costs: [`SIGNING.md`](SIGNING.md)
- Real-machine QA checklist: [`docs/QA.md`](docs/QA.md)

```
npm install
npm start
npm test      # node --test: unit tests under test/
npm run lint  # node --check on every .js under src/ test/ scripts/ plus config.js
npm run icons # regenerate build/icon.png + build/icon.ico from build/icon.svg (runs under Electron)
npm run dist  # build dist/Tuck-Setup-<version>.exe locally (uploads nothing)
npm run dist:mac # on a Mac: dist/Tuck-<version>-arm64|x64.dmg + .zip (unsigned unless signing env is set)
npm run dist:mas # on a Mac: Mac App Store build dist/Tuck-<version>-mas.pkg (universal; see docs/MAS.md, unverified)
```

## Usage

Select some text, then:

| Action | Result |
|---|---|
| Single Ctrl+C | Normal copy, nothing captured |
| **Double Ctrl+C** (two separate presses, 2nd keydown < 1000 ms after the 1st, each held < 600 ms; both adjustable in Settings) | Silent capture. A small capsule with the first 20 characters is "sucked" from the mouse position into a bar at the bottom of the screen, the bar glows and collapses. Focus is never taken. |
| **Hold Ctrl+C** (C held >= 600 ms with Ctrl still down) | After the fly-in the bar expands into an input with focus. Enter saves (text + thought; empty = text only); Shift+Enter newline (auto-grows to 4 lines); Esc saves nothing. Switching to another window or clicking outside the bar = cancel. Focus then goes back to the original window. |

Not captured: Ctrl+Shift+C / Ctrl+Alt+C / Ctrl+Win+C; clipboard empty, whitespace-only or not text; identical to the last saved entry within 3 s (dedupe, adjustable); the foreground app or window title is on the exclusion list (see Privacy); the clipboard data is marked private by the app that put it there (password managers do this); copied from Tuck's own notebook or Settings window; paused; a new trigger while a long-press input is still open. OS auto-repeat while holding never triggers twice, and auto-repeated keys are not typed into the thought box. Enter during IME composition only commits the composition.

A capture (double or long) in the first few seconds after launch, or right after the PowerShell helper had to restart (for example after security software killed it), shows a tray balloon "Not ready yet" and saves nothing; try again.

### First run

A 4-step tutorial window opens on first launch: what Tuck does, a live double-tap on a pre-selected sample sentence, a live long press, then where the notes live. Skipping or closing it counts as done (`onboardingDone`); tray > **Show tutorial** opens it again. The two sample captures land in your real notebook, as the tutorial says.

### Tray menu

- **Pause capture / Resume capture**: while paused every trigger is ignored; the icon turns gray.
- **Open notebook**: the notebook window (also on tray double-click / launching Tuck again).
- **Open in Obsidian**: only when the notes folder is inside an Obsidian vault; opens the notes file there.
- **Settings…**
- **Show tutorial**
- **Check for updates…**: besides the auto-update setting, the only thing that makes Tuck touch the network. In the dev build it makes no request.
- **Report a problem…**: shows the exact prefilled text first, then opens a GitHub new-issue page in your browser (nothing is sent unless you submit it there), or opens the log folder.
- **Open log**: `<userData>\logs\tuck.log`.
- **Start at login** (checkbox). Under `npm start` the entry is registered as `electron.exe <app dir>`; it breaks if you move the project folder, so prefer the installed build.
- **Quit**

Tooltip "Tuck (paused)" / "Tuck (key hook unavailable)" means paused / the global hook failed to load. Closing windows never quits; launching Tuck again opens the notebook (single-instance lock).

### Notebook

- Cards for every entry, newest first, grouped by day; search (Ctrl+F or `/`), tags and source apps in the sidebar; arrow keys or j/k move between cards.
- A note copied from a web browser shows the page's site under the quote; click it to open the page in your browser. Search also matches the link.
- **Open in Obsidian** (bottom left) appears when the notes folder is inside an Obsidian vault. The folder itself is under Settings > Storage.
- **Edit** (E, or the Edit button): quote and thought in place; Ctrl+Enter saves, Esc cancels; tags are re-derived. **Delete** (Delete key or the card's ⋯ menu), no confirmation. Both show an **Undo** toast for 8 s; Ctrl+Z undoes the last change. If the file changed underneath, the notebook reloads and asks you to retry.
- **Export** (header): Markdown of the current view (entries copied verbatim), or PDF (light print layout). Card ⋯ menu: **Copy as image** / **Save image…** (PNG with the date and a small Tuck mark).
- **Today** panel (top of All notes): one daily pick from older notes, stable for the day, plus up to 3 "On this day" notes. **This week**: counts, a Mon-Sun bar chart, top tags and sources, the week's notes.
- Optional **daily reminder** notification with the daily pick (Settings > Privacy, off by default).

### Output format

Appended to `%USERPROFILE%\Documents\Tuck\tuck.md` by default (the folder can be changed in Settings > Storage) (UTF-8 without BOM; folder and file created if missing; header `# Tuck` on first write):

```markdown
### 2026-10-16 23:10 · chrome.exe
> first line of the text
> second line

**Source**: https://example.com/essay

**My thought**: this is about #right_problem and #product
**Tags**: #right_problem #product

---
```

- Local time `YYYY-MM-DD HH:mm`; ` · chrome.exe` is the foreground process at trigger time, omitted if unknown.
- Every text line gets `> `, empty lines become `>`, trailing newlines are dropped.
- Lists keep their bullets and numbers (`- `, `1. `, nested items indented). Browsers leave them out of the plain text of a copy, so Tuck rebuilds them from the HTML the browser put on the clipboard, and uses that only when its words match the plain text exactly. Off switch: Settings > Capture > "Keep lists".
- `**Source**:` is the page the text was copied from. Browsers put it on the clipboard next to the text: Chrome, Edge, Brave, Firefox (and other Chromium browsers) on Windows; Chromium browsers on macOS (Safari and Firefox on macOS don't). Copies from other apps have no Source line. Off switch: Settings > Privacy > "Save the page link".
- `#tags` in the thought (letters/digits/underscore in any script, Chinese included) are copied to the Tags line and kept in the thought. No tags = no Tags line; no thought = neither line.

### Data safety

- Every rewrite of the notes file (notebook edit, delete, undo) first copies the current file to `<userData>\backups\<file>-YYYYMMDD-HHmmss.md`, then writes a temp file in the same folder, fsyncs it and renames it over the original (copy fallback if the rename is refused, e.g. by a sync client). A crash mid-write leaves either the old or the new file, never half of one.
- Captures still append (an append cannot destroy earlier entries; a missing final newline is fixed first) and take one backup per day (`...-daily.md`).
- Two separate pools: the newest 20 pre-edit backups, and the daily backups of the last 30 days, so a burst of edits never prunes the day-start copy. "Move" when changing the notes folder keeps the old file in `backups\moved\`, which is never pruned. Undo lives in memory only and is lost when Tuck quits; the backups are the long-term safety net. In the notebook, holding Delete or Ctrl+Z acts once, not on key repeat.
- An edit rewrites only the part of the entry Tuck understands (heading to `---`); anything you wrote below the `---` in another editor stays. If you hand-edited lines inside an entry that Tuck cannot read, the notebook refuses to edit it (use the file). Thought lines that look like `---`, `### ` or `**Tags**: ` are saved with one leading space so they cannot break the file.
- Settings are written the same atomic way. A `settings.json` with invalid JSON is renamed to `settings.json.<time>.bad` and defaults are used. If the file exists but cannot be read (locked by antivirus or a sync client), Tuck runs on defaults, never writes over it, and refuses settings changes until it can read it.

## Settings

Tray > **Settings…**. Saved to `<userData>\settings.json` (only the keys you changed) and applied live, no restart. `<userData>` is `%APPDATA%\Tuck`.

| Section | Setting | Default | Range / notes |
|---|---|---|---|
| Capture | Long-press duration (`longPressMs`) | 600 ms | slider 400-1200 |
| Capture | Double-tap gap (`doubleGapMs`) | 1000 ms | slider 500-1500 |
| Capture | Ignore repeats for (`dedupeMs`) | 3 s | slider 0-10 s, 0 = off |
| Capture | Keep lists (`keepLists`) | on | saves copied bulleted / numbered lists as Markdown lists |
| Capture | Animation speed (`animSpeed`) | Normal (1.0) | Slower 1.5 / Faster 0.7, fine slider 0.5-2 (length multiplier) |
| Storage | Notes folder (`notesDir`) | `Documents\Tuck` | "Change folder…" checks the folder is writable, then offers Move / Copy / Start a new file (never overwrites; a moved file also stays in backups). Put it in a OneDrive / Dropbox folder to get sync for free. |
| Storage | Obsidian | | Lists the vaults Obsidian knows about (from its `obsidian.json`); "Save notes in this vault" moves the notes folder to `<vault>\Tuck` with the same Move / Copy / New file choices. Obsidian indexes the file as it is: `#tags` become Obsidian tags. "Open in Obsidian" opens the file via `obsidian://open`. |
| Storage | Notes file (`notesFile`) | `tuck.md` | display only |
| Privacy | Excluded apps (`excludeApps`) | 1Password, KeePass, KeePassXC, Bitwarden, Dashlane, LastPass, Enpass, Keeper | exact process name, `.exe` optional; "Running apps…" picker |
| Privacy | Excluded title words (`excludeTitles`) | bank, banking, 网上银行, 银行, password, 密码, sign in, login, 登录 | case-insensitive substring of the window title |
| Privacy | Save the page link (`saveSourceLink`) | on | writes `**Source**: <url>` for copies from a browser |
| Privacy | Daily reminder (`dailyNotification`, `dailyNotificationTime`) | off, 09:00 | |
| Privacy | Check for updates automatically (`autoUpdate`) | off | the only setting that uses the network |
| Diagnostics | read-only | | versions, hook status, last trigger time and mode, admin or not, displays and DPI, notes path and writability, log path; Copy diagnostics / Refresh / Open log |

`config.js` still holds the built-in defaults and the constants that are not user-facing (`CLIPBOARD_DELAY_MS` 120, bar 360x44 at 48 px from the bottom, `BAR_MAX_LINES` 4, `CAPSULE_CHARS` 20, `FLY_MS` 450 / `PULSE_MS` 220 / `SAVED_HOLD_MS` 300, scaled by `animSpeed`).

Env vars for tests / QA only: `TUCK_USER_DATA` (replaces `%APPDATA%\Tuck`, applied before anything else; note that this also gives the app its own single-instance lock, so an installed Tuck can run at the same time and would capture your synthetic test keys into your real notes: **stop the installed Tuck before E2E runs**), `TUCK_NOTES_DIR` (overrides the notes folder, not persisted), `TUCK_OPEN=settings|notebook` with optional `TUCK_OPEN_SECTION=capture|storage|privacy|diagnostics` (opens that window at start).

## Privacy

Full statement: [`PRIVACY.md`](PRIVACY.md). In short:

- The global hook (uiohook-napi) is used only to see the down/up timing of C and Ctrl (and whether Shift/Alt/Win are held). Every other key is mapped to `'other'` before reaching the state machine. **No key is logged, stored or printed.** uiohook listens without intercepting, so Ctrl+C still copies.
- The clipboard is read only after a double / long trigger, never on a single Ctrl+C.
- At a trigger the foreground process name (written into the note) and window title (memory only, for the exclusion check) are read.
- **Exclusion fails closed:** if the foreground app is unknown (first ~2.5 s after launch, helper restart, or Windows does not answer within 0.5 s) nothing is saved and a "Not ready yet" balloon appears.
- Clipboard data that its owner marked private (`ExcludeClipboardContentFromMonitorProcessing`, or `CanIncludeInClipboardHistory` = 0, as KeePass, 1Password and others set) is never saved, whichever app is in front. Log line: `skipped: private clipboard`.
- The log (`<userData>\logs\tuck.log`, rotates at 1 MB, keeps `tuck.log.1`) holds lifecycle events and errors only. Note text, clipboard text, window titles and keys are never written to it; an excluded capture logs just `skipped: excluded`.
- **No network** unless you turn on auto-update or click "Check for updates…" (then only GitHub Releases of `BayarBH/tuck`). All pages block non-`file:` requests, CSP `default-src 'self'`, `contextIsolation` + `sandbox`, navigation and new windows blocked, no web fonts or CDNs. The updater runs in the main process with its own session.
- Crash dumps go to `<userData>\Crashpad` and are never uploaded (`uploadToServer: false`). "Report a problem" opens a prefilled GitHub page in your browser; nothing is sent unless you submit it.
- Files written: the notes file, and under `%APPDATA%\Tuck`: `settings.json`, `logs\`, `backups\`, `Crashpad\`, plus Electron's own cache.

## macOS (beta)

Everything above applies, with **⌘C** (Command+C) in place of Ctrl+C: double-tap ⌘C to save, hold ⌘C to add a thought. The physical Control key is ignored, so Ctrl+⌘+C does nothing. Tuck lives in the menu bar (no Dock icon). Status: **beta, not yet verified on a real Mac**. CI builds it for Apple Silicon and Intel and checks that it starts without errors; the checklist in [`docs/QA.md`](docs/QA.md#macos) has not been run by a human yet.

**Install.** Download `Tuck-<version>-arm64.dmg` (Apple Silicon) or `-x64.dmg` (Intel) from the "mac" workflow run's artifacts on GitHub Actions, or from a Release once one is published. Open the dmg and drag Tuck to Applications.

**First open (unsigned app).** The build is not signed with an Apple Developer ID or notarized (see [`SIGNING.md`](SIGNING.md)), so macOS will refuse the first double-click. Either right-click (Control-click) Tuck in Applications > **Open** > **Open**, or try to open it once, then go to **System Settings > Privacy & Security**, scroll down and click **Open Anyway**. You only need to do this once per version.

**Accessibility permission.** To notice ⌘C, Tuck needs Accessibility access (System Settings > Privacy & Security > Accessibility). The tutorial asks for it before the practice steps: click **Grant access**, turn on Tuck in the list, and the tutorial notices by itself. Settings > Privacy shows the current status and has an **Open System Settings** button. Tuck uses this only to see the timing of ⌘ and C; it never reads other keys (see [`PRIVACY.md`](PRIVACY.md)). Because the beta is only ad-hoc signed, macOS may forget the permission after you install a new version: remove Tuck from the list with "−" and add it again.

**Excluded apps** are matched by app name (for example `1Password`, `Keychain Access`), not by `.exe`. Reading the frontmost window *title* and handing focus back after a thought go through System Events, so the first capture makes macOS ask whether Tuck may control "System Events"; if you decline, only the app name is checked.

**Secure Keyboard Entry blocks Tuck.** When a password field has focus, or an app turns on Secure Keyboard Entry (Terminal and iTerm2 have it in their menu, some password managers and banking sites enable it), macOS hides key presses from every other app, Tuck included. Captures simply do not happen while it is on; that is macOS protecting you, not a Tuck bug. Turn it off in that app's menu if you want to capture from it. A copy that a password manager marks as concealed (`org.nspasteboard.ConcealedType`) is never saved either.

**Focus.** A double-tap never takes focus. A long press activates Tuck for the thought bar; when you press Enter or Esc, Tuck re-activates the app you were in (via `open` / System Events). macOS brings that app's frontmost window back, not necessarily the exact window if the app has several, and in full-screen Spaces the switch may animate.

**Updates.** In-place updates on macOS need a signed app, so on a Mac "Check for updates" opens the GitHub Releases page instead: download the new `.dmg` and replace Tuck in Applications (then re-check Accessibility, see above).

## Updates, packaging and signing

```
npm run dist        # local build: dist/Tuck-Setup-<version>.exe, nothing uploaded
npm run release     # build + upload to a GitHub Releases *draft* (needs GH_TOKEN)
npm run dist:store  # Microsoft Store package: dist/Tuck-<version>-store.appx (unsigned; the Store signs it)
```

- Microsoft Store build (no self-update, start at login through the package's startup task) and how to submit it: [`docs/STORE.md`](docs/STORE.md).
- Mac App Store build (sandboxed: listen-only key tap from `native/mac` with Input Monitoring instead of uiohook-napi and Accessibility, no window titles, a user-picked notes folder, no self-update) and how to submit it: [`docs/MAS.md`](docs/MAS.md). **Not verified: nothing of it has been compiled or run on a Mac yet.**

- **Publish each draft by hand** on GitHub (Releases > Edit > Publish release). electron-updater ignores drafts, so until then every "Check for updates" reports "up to date".

- `scripts/dist.js` picks signing from the environment: `CSC_LINK` + `CSC_KEY_PASSWORD` (certificate file), `AZURE_*` (Azure Artifact Signing), or none (unsigned, with a warning). Set `CSC_IDENTITY_AUTO_DISCOVERY=false` for a deliberately unsigned local build. Options, costs and a recommendation: [`SIGNING.md`](SIGNING.md).
- Unsigned installers trigger SmartScreen ("Windows protected your PC" > More info > Run anyway), and antivirus is more likely to flag the keyboard hook.
- Auto-update: electron-updater against GitHub Releases (`app-update.yml` in the package). Off by default. When on: first check ~10 s after start, then every 24 h; a found update shows a notification and downloads only after you click Download; it installs on quit or via "Restart now". Declined versions are not offered again by background checks.
- `build` in `package.json`: `appId com.bayar.tuck`; NSIS wizard with choosable directory, desktop + Start-menu shortcut "Tuck"; icon `build/icon.ico`; `files: src/**, config.js, package.json, build/icon.*`; `asarUnpack: node_modules/uiohook-napi/**` (the native `.node` binary cannot load from inside an asar).
- Icon source: `build/icon.svg`; `npm run icons` renders `icon.png` (512), `icon-1024.png`, a multi-size `icon.ico` and `icon.icns` (macOS, 16 to 1024 px).
- `build.mac`: separate dmg + zip for `arm64` and `x64` (not universal; `uiohook-napi` ships prebuilds for both), `LSUIElement` (menu-bar app, no Dock icon), hardened runtime with `build/entitlements.mac.plist` (JIT, unsigned executable memory, library validation off for the uiohook `.node`, Apple Events for System Events). `scripts/mac-adhoc-sign.js` (afterPack) ad-hoc signs unsigned builds so Apple Silicon does not call them "damaged". Notarization runs only when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` are set. CI: `.github/workflows/mac.yml`.

## Code signing policy

Status: Windows builds are **not signed yet**. This policy takes effect once SignPath Foundation approves Tuck for its free open-source signing program.

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- Committers and reviewers: [BayarBH](https://github.com/BayarBH)
- Approvers: [BayarBH](https://github.com/BayarBH)

Only builds made by the GitHub Actions [release workflow](.github/workflows/release.yml) from this repository are signed. Each signing request is approved by hand.

Privacy: Tuck makes no network requests except the update check, which stays off until you turn it on or click "Check for updates…". See [PRIVACY.md](PRIVACY.md).

## How focus is handed back, and its limits

**Background:** Windows has a foreground lock: `SetForegroundWindow` only really switches the foreground for the current foreground process, the process that received the last input, and a few other cases; otherwise it just flashes the taskbar button. Our overlay is in the background and the keys went to another window, so neither Electron's `win.focus()` nor "the OS gives focus back when we hide" is reliable.

**Implementation (`src/win32.js`):** one persistent hidden `powershell.exe -NoProfile -NonInteractive -Command -` child, started lazily (and warmed up at app start), receives one command per line on stdin. At startup it `Add-Type`s a user32 P/Invoke class once (PowerShell source is ASCII-only to avoid gb2312 code-page parsing issues; output is UTF-8). Every command has an id and an 800 ms timeout (8 s for the first start + compile); failures resolve `null` / `false`, never throw.

- `getForeground()`: `GetForegroundWindow` + `GetWindowThreadProcessId` + `GetWindowTextW` -> `{ hwnd, processName, title }`. The title is used only in memory for the exclusion check and is never written anywhere.
- `focusWindow(hwnd)`: returns true at once if already foreground; otherwise restores a minimized window (`ShowWindow(SW_RESTORE)`), attaches to the current foreground thread with `AttachThreadInput`, calls `BringWindowToTop` + `SetForegroundWindow`, detaches. If that fails, the **ALT trick**: `keybd_event` synthesizes an Alt key-down so our process counts as the last input and the lock lifts, tries again, then releases Alt. It returns true only when `GetForegroundWindow()` really is the target.

**Flow (`src/main.js`):**

1. On trigger, the foreground window `fg` is recorded right away (waiting at most 500 ms; during the PowerShell cold start it is skipped). Double-tap then just omits the source app; long press is refused with a "Not ready yet" balloon, because without `fg` focus could not be handed back.
2. Long press: `showInactive()` (still click-through) -> `win.focus()` -> **always** `focusWindow(overlay hwnd)` (hwnd read little-endian from `getNativeWindowHandle()`). `win.isFocused()` was seen returning true while the OS foreground had not changed, so it is not trusted. If focus fails, the session is cancelled with the balloon "Could not take input focus". Only after focus succeeds is click-through turned off and the input shown, so the invisible full-screen overlay can never block clicks while unfocused.
3. End (Enter / Esc / click outside the bar): click-through back on -> `focusWindow(fg.hwnd)` -> **then** hide the overlay (hiding first lets the OS activate the next window in z-order; seen landing on Explorer, Windows Terminal, Chrome). About 120 ms later the foreground is checked once more and focus is retried if it drifted.
4. If the overlay loses focus during input (Alt+Tab, Win key) it cancels and does not steal focus back.
5. Double-tap uses only `showInactive()` + click-through and never touches focus.

**Limits:**

- Relies on `SetForegroundWindow` plus a synthetic Alt, which are unofficial and Microsoft can tighten them at any time.
- The synthetic Alt is pressed in the old foreground window and released in the new one, so neither should see a full Alt tap (which activates a classic Win32 menu bar). This was only tested with a WinForms window and terminals; in Office / Explorer / other menu-bar apps an activated menu bar after restore is possible but unverified. If you see it, press Esc once.
- Verified on one machine for a small number of rounds (see Known limits). Elevated (admin) target windows were not tested; by UIPI rules focus most likely cannot be handed back to them from a non-elevated process.
- If the original window was closed during input (`IsWindow` fails), the OS decides where focus goes.
- Requires the built-in `powershell.exe`; if group policy blocks it, the source app is never known and every long press is refused (double-tap still works).
- During long input the whole display belongs to the overlay: a click outside the bar cancels the input and that click is swallowed (it does not reach the window underneath).

## Troubleshooting

First stop for any problem: tray > **Open log**, and Settings > **Diagnostics** (versions, hook status, admin or not, displays and scaling, whether the notes folder is writable; **Copy diagnostics** copies it without any note text).

### uiohook-napi fails to load

Symptom: an error dialog "Global key hook unavailable" at startup, tooltip "key hook unavailable", Ctrl+C never triggers; everything else works.

- uiohook-napi is an N-API module with a prebuilt Windows x64 binary; it should not depend on the Electron ABI or need a compiler. `not a valid Win32 application` / missing `.node` usually means an incomplete install or the wrong architecture (e.g. deps installed by a 32-bit Node).
- Delete `node_modules` and run `npm install` again (a full disk or an antivirus deleting files mid-install leaves a broken package).
- `The specified module could not be found` while the file exists: install the Microsoft Visual C++ Redistributable (x64).
- Only in the packaged build: check `asarUnpack` contains `node_modules/uiohook-napi/**` and that `resources/app.asar.unpacked/node_modules/uiohook-napi` contains the `.node` file.
- Self-check: `set ELECTRON_RUN_AS_NODE=1` then `node_modules\electron\dist\electron.exe -e "require('uiohook-napi')"`.

### Antivirus / security software blocks the global hook

On Windows uiohook uses a `WH_KEYBOARD_LL` low-level keyboard hook, the classic keylogger technique, so 360, Huorong and others may silently block it, warn, or quarantine files. It can look like a load failure, or load fine but never receive events. Fix: whitelist `electron.exe` (dev) or the installed `Tuck.exe` plus `uiohook-napi.node`; restore from quarantine and reinstall deps if needed. The app only looks at C/Ctrl timing, see Privacy.

### The original window did not get focus back after a long press

- See "How focus is handed back". Check Task Manager for a `powershell.exe` child under the app; if missing, group policy or security software may block it.
- The original window runs as admin -> see the next item.
- Some fullscreen games, Remote Desktop and UWP windows may refuse `SetForegroundWindow`.
- Workaround: click the original window once.

### Does not work in programs running as administrator (UIPI)

User Interface Privilege Isolation forbids lower-integrity processes from injecting into or hooking input of higher-integrity windows: a non-elevated Tuck **does not receive keys sent to elevated windows**, so Ctrl+C there never triggers, and focus cannot be handed back to them. Either run Tuck as administrator (it then sees all windows, but the login item does not start elevated), or accept the limitation. Not actually tested.

### DPI scaling shifts the animation start point

The start point: `screen.getCursorScreenPoint()` (DIP) -> `getDisplayNearestPoint` -> `setBounds(display.bounds)` -> `x, y = cursor - bounds origin`, used as CSS px. With one display or equal scaling these agree.

With multiple displays at different scales (e.g. 100% + 150%) Electron's DIP space is discontinuous at the edges, and moving a window across displays can apply the old display's scale. The code re-applies `setBounds` once if `getBounds()` differs from the target, which handles the common size mismatch, but this is untested. To debug, set all displays to the same scale and see if it still happens; a fuller fix would convert with `screen.screenToDipPoint` / `dipToScreenPoint`. Offsets only affect the animation, never the saved text.

### Captures stop working on banking / login pages, or in a password manager

That is the exclusion list working. Settings > Privacy shows the app names and title words; remove an entry or press Reset. The log line `skipped: excluded` confirms it (without saying which app).

### A note was lost or damaged

Look in `%APPDATA%\Tuck\backups\` (Settings > Storage > Open backups): a copy is taken before every edit or delete and once a day.

## Verified vs not verified (honest list)

Verified on one Windows 11 laptop (single display), with synthetic keys injected only into the test script's own window and with user data and notes in scratch folders (`TUCK_USER_DATA`, `TUCK_NOTES_DIR`):

- Unit tests (75) and lint (58 files) pass.
- Synthetic E2E, 10/10:
  - a double-tap captures multi-line text with the process name;
  - a repeat within 3 s is deduped;
  - a single Ctrl+C captures nothing;
  - a Ctrl+Shift+C double-tap captures nothing;
  - long press + Esc saves nothing;
  - long press + empty Enter saves the text only;
  - long press + thought + `#tags` is written correctly;
  - focus returns to the original window after Esc and after Enter;
  - switching away during input cancels, and the next double-tap works.
- Exclusion: with `powershell.exe` excluded, a double-tap from a PowerShell window wrote nothing and logged only `skipped: excluded`. After removing it, the same capture was written.
- After the E2E run the log contained no captured text, thought, window title or app name.
- Page link: Electron's own Chromium copy writes `SourceURL:` into the clipboard's HTML format and Tuck reads it back (credentials stripped). Synthetic E2E, 3/3: a double tap and a long press with browser-style clipboard data write the `**Source**` line; a plain-text copy writes none.
- Keep lists: Electron's own Chromium copy of a nested list drops every bullet and number from the plain text; Tuck's converter rebuilds `1. ` / `- ` from its HTML. Synthetic E2E, 3/3: a double tap and a long press with a list save it as a Markdown list; HTML whose words differ from the plain text saves the plain text.
- Obsidian: with two fake vaults in a test `obsidian.json`, Settings listed both, "Save notes in this vault" moved the notes folder to `<vault>\Tuck`, and the notebook showed "Open in Obsidian".
- Notes store: a delete first wrote a byte-identical backup, and undo restored the file byte-identically. Edit, delete, undo, export (Markdown, PDF, saved image) and the edit-conflict message were checked in the running notebook.
- No network: with auto-update off, the app and all its child processes had zero TCP connections and zero UDP endpoints after about 20 s.
- `npm run dist` builds `Tuck-Setup-0.1.0.exe` (about 83 MB, unsigned) with the new icon. `uiohook-napi` is unpacked outside the asar, and the unpacked `Tuck.exe` starts with no errors in the log.
- Settings changes apply live (seen in the log). The tutorial, notebook and settings windows render in light and dark themes.

**Not verified:**

- Real (human) key presses on other machines. Real IMEs beyond "Enter during composition does not submit".
- Elevated (admin) windows, multiple monitors and mixed DPI, fullscreen games, Remote Desktop.
- 360, Huorong and Defender behaviour with the installed build, and SmartScreen on a clean machine. See [`docs/QA.md`](docs/QA.md) for the checklist.
- Installing this build. The auto-update download and install path was never exercised, because there is no published release.
- "Copy as image" to the clipboard, the native dialogs of "Change folder…", and the daily reminder firing at its real time.
- Keep lists with real ChatGPT / Claude / Gemini pages in real browsers, and on macOS.
- Page link from real Chrome / Edge / Firefox windows, and from Chromium browsers on macOS. Clicking "Open in Obsidian" with a real vault.
- Animation look and timing, the tray menu and start-at-login, checked by a human eye.
- uiohook reports `ctrlKey` as false on the first modifier press after start, so `main.js` tracks modifiers itself (a keydown in the last 2 s counts as held). A dropped keyup (secure desktop, lock screen) can make a modifier count as held for up to 2 s.
- macOS: everything in [macOS (beta)](#macos-beta) beyond "it builds and starts in CI". Linux: not supported.
