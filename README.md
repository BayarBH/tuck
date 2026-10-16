# Excerpts

Copy to capture: while reading articles or AI replies, **double-tap or hold Ctrl+C** to append the selected text to a Markdown file without breaking your reading flow. A single Ctrl+C is completely unaffected and never recorded.

Windows only (source-app name and focus restore rely on user32). On other platforms `src/win32.js` returns null/false everywhere, so the source app is omitted and long-press input is refused; untested.

```
npm install
npm start
npm test      # node --test: keyDetector / notesWriter unit tests
npm run lint  # node --check on every .js under src/ test/ scripts/ plus config.js
```

## Usage

Select some text, then:

| Action | Result |
|---|---|
| Single Ctrl+C | Normal copy, nothing captured |
| **Double Ctrl+C** (two separate presses, 2nd keydown < 1000 ms after the 1st, each held < 600 ms) | Silent capture. A small capsule with the first 20 characters is "sucked" from the mouse position into a bar at the bottom of the screen, the bar glows and collapses. Focus is never taken. |
| **Hold Ctrl+C** (C held >= 600 ms with Ctrl still down) | After the fly-in the bar expands into an input with focus. Enter saves (text + thought; empty = text only); Shift+Enter newline (auto-grows to 4 lines); Esc saves nothing. Switching to another window or clicking outside the bar = cancel. Focus then goes back to the original window. |

Not captured: Ctrl+Shift+C / Ctrl+Alt+C / Ctrl+Win+C; clipboard empty, whitespace-only or not text; identical to the last saved entry within 3 s (dedupe); paused; a new trigger while a long-press input is still open. OS auto-repeat while holding never triggers twice, and auto-repeated keys are not typed into the thought box. Enter during IME composition only commits the composition.

A long press in the first few seconds after launch (while the PowerShell helper is still starting) shows a tray balloon "Not ready yet" and saves nothing; try again.

### Tray menu

- **Pause capture / Resume capture**: while paused every trigger is ignored; the icon turns gray.
- **Open notes**: opens the md file with the default app (creates it with its header if missing).
- **Open folder**
- **Start at login** (checkbox): `app.setLoginItemSettings({ openAtLogin })`. Under `npm start` the entry is registered as `electron.exe <app dir>`; it breaks if you move the project folder, so prefer the packaged build.
- **Quit**

Tooltip "Excerpts (paused)" / "Excerpts (key hook unavailable)" means paused / the global hook failed to load. Closing windows never quits; a second launch exits immediately (single-instance lock).

### Output format

Appended to `%USERPROFILE%\Documents\Excerpts\excerpts.md` (UTF-8 without BOM; folder and file created if missing; header `# Excerpts` on first write):

```markdown
### 2026-10-16 23:10 · chrome.exe
> first line of the text
> second line

**My thought**: this is about #right_problem and #product
**Tags**: #right_problem #product

---
```

- Local time `YYYY-MM-DD HH:mm`; ` · chrome.exe` is the foreground process at trigger time, omitted if unknown.
- Every text line gets `> `, empty lines become `>`, trailing newlines are dropped.
- `#tags` in the thought (letters/digits/underscore in any script, Chinese included) are copied to the Tags line and kept in the thought. No tags = no Tags line; no thought = neither line.

### config.js

| Key | Default | Meaning |
|---|---|---|
| `LONG_PRESS_MS` | 600 | How long C must be held for a long press |
| `DOUBLE_GAP_MS` | 1000 | Max keydown-to-keydown gap for a double tap |
| `DEDUPE_MS` | 3000 | Identical text within this window is not saved again |
| `CLIPBOARD_DELAY_MS` | 120 | Wait before reading the clipboard so the copy can finish |
| `NOTES_DIR` | `~/Documents/Excerpts` | Notes folder |
| `NOTES_FILE` | `excerpts.md` | File name |
| `BAR_WIDTH` / `BAR_HEIGHT` / `BAR_BOTTOM` | 360 / 44 / 48 | Bar width, height, distance from the screen bottom (CSS px) |
| `BAR_MAX_LINES` | 4 | Max auto-grow lines of the input |
| `CAPSULE_CHARS` | 20 | Characters shown in the capsule (`…` appended if longer) |

The env var `ZHAILU_NOTES_DIR` overrides `NOTES_DIR`. It exists **only for tests / E2E** so they never touch the real file.

## Packaging (never run)

```
npm run dist        # = electron-builder --win nsis
```

`build` in `package.json`:

- `appId: com.bayar.zhailuben`, `productName: Excerpts` (appId matches `app.setAppUserModelId`).
- `win.target: nsis`, `nsis.oneClick: false` + `allowToChangeInstallationDirectory: true`: wizard installer with a choosable install dir.
- `files: src/**, config.js, package.json`: only runtime files (electron-builder adds production `node_modules` itself).
- `asarUnpack: node_modules/uiohook-napi/**`: uiohook-napi ships a native `.node` binary that cannot load from inside an asar archive.

In the packaged build `config.js` lives inside the asar; changing settings means rebuilding.

## Privacy

- The global hook (uiohook-napi) is used only to see the down/up timing of C and Ctrl/Shift/Alt/Win. Every other key is mapped to `'other'` before reaching the state machine and only breaks a double-tap sequence. **No key is logged, stored or printed.**
- uiohook listens without intercepting, so Ctrl+C still copies.
- The clipboard is read only after a double / long trigger, never on a single Ctrl+C.
- No network: `session.defaultSession.webRequest.onBeforeRequest` cancels every non-`file:` / `devtools:` request; page CSP is `default-src 'self'`; renderer has `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; navigation and new windows are blocked. No telemetry, no external fonts.
- The only file written is the notes file (plus Electron's own user-data folder `%APPDATA%\Excerpts`).

## How focus is handed back, and its limits

**Background:** Windows has a foreground lock: `SetForegroundWindow` only really switches the foreground for the current foreground process, the process that received the last input, and a few other cases; otherwise it just flashes the taskbar button. Our overlay is in the background and the keys went to another window, so neither Electron's `win.focus()` nor "the OS gives focus back when we hide" is reliable.

**Implementation (`src/win32.js`):** one persistent hidden `powershell.exe -NoProfile -NonInteractive -Command -` child, started lazily (and warmed up at app start), receives one command per line on stdin. At startup it `Add-Type`s a user32 P/Invoke class once (PowerShell source is ASCII-only to avoid gb2312 code-page parsing issues; output is UTF-8). Every command has an id and an 800 ms timeout (8 s for the first start + compile); failures resolve `null` / `false`, never throw.

- `getForeground()`: `GetForegroundWindow` + `GetWindowThreadProcessId` -> `{ hwnd, processName }`.
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

### uiohook-napi fails to load

Symptom: an error dialog "Global key hook unavailable" at startup, tooltip "key hook unavailable", Ctrl+C never triggers; everything else works.

- uiohook-napi is an N-API module with a prebuilt Windows x64 binary; it should not depend on the Electron ABI or need a compiler. `not a valid Win32 application` / missing `.node` usually means an incomplete install or the wrong architecture (e.g. deps installed by a 32-bit Node).
- Delete `node_modules` and run `npm install` again (a full disk or an antivirus deleting files mid-install leaves a broken package).
- `The specified module could not be found` while the file exists: install the Microsoft Visual C++ Redistributable (x64).
- Only in the packaged build: check `asarUnpack` contains `node_modules/uiohook-napi/**` and that `resources/app.asar.unpacked/node_modules/uiohook-napi` contains the `.node` file.
- Self-check: `set ELECTRON_RUN_AS_NODE=1` then `node_modules\electron\dist\electron.exe -e "require('uiohook-napi')"`.

### Antivirus / security software blocks the global hook

On Windows uiohook uses a `WH_KEYBOARD_LL` low-level keyboard hook, the classic keylogger technique, so 360, Huorong and others may silently block it, warn, or quarantine files. It can look like a load failure, or load fine but never receive events. Fix: whitelist `electron.exe` (dev) or the installed `Excerpts.exe` plus `uiohook_napi.node`; restore from quarantine and reinstall deps if needed. The app only looks at C/Ctrl timing, see Privacy.

### The original window did not get focus back after a long press

- See "How focus is handed back". Check Task Manager for a `powershell.exe` child under the app; if missing, group policy or security software may block it.
- The original window runs as admin -> see the next item.
- Some fullscreen games, Remote Desktop and UWP windows may refuse `SetForegroundWindow`.
- Workaround: click the original window once.

### Does not work in programs running as administrator (UIPI)

User Interface Privilege Isolation forbids lower-integrity processes from injecting into or hooking input of higher-integrity windows: a non-elevated Excerpts **does not receive keys sent to elevated windows**, so Ctrl+C there never triggers, and focus cannot be handed back to them. Either run Excerpts as administrator (it then sees all windows, but the login item does not start elevated), or accept the limitation. Not actually tested.

### DPI scaling shifts the animation start point

The start point: `screen.getCursorScreenPoint()` (DIP) -> `getDisplayNearestPoint` -> `setBounds(display.bounds)` -> `x, y = cursor - bounds origin`, used as CSS px. With one display or equal scaling these agree.

With multiple displays at different scales (e.g. 100% + 150%) Electron's DIP space is discontinuous at the edges, and moving a window across displays can apply the old display's scale. The code re-applies `setBounds` once if `getBounds()` differs from the target, which handles the common size mismatch, but this is untested. To debug, set all displays to the same scale and see if it still happens; a fuller fix would convert with `screen.screenToDipPoint` / `dipToScreenPoint`. Offsets only affect the animation, never the saved text.

## Known limits (honest list)

Verified (one Windows 11 machine, synthetic-key E2E, keys injected only into the test script's own window, before the latest review fixes): unit tests and lint pass; single-instance lock works; double-tap captures multi-line text with the process name; repeated double-tap within 3 s is deduped; single Ctrl+C captures nothing; Ctrl+Shift+C double-tap captures nothing; long press + Esc saves nothing; long press + empty Enter saves text only; long press + thought + `#tags` is written correctly; focus returns to the original window after Enter/Esc; switching windows during input cancels and double-tap still works afterwards; file is UTF-8 without BOM with a header. Each item passed 2 consecutive rounds.

**Not verified / known issues:**

- The latest fixes (long press refused during cold start, click-through off only after focus, auto-repeat swallowing in the input, click-outside cancel, shorter double-tap animation ~580 ms, login item args under `npm start`, mixed-DPI second `setBounds`) passed unit tests, lint and a startup smoke test only, no interactive E2E.
- **Packaging (`npm run dist`) was never run**; the dev `npm install` once ended early on a full disk (Electron was patched in by hand), so reinstall `node_modules` before trying.
- Animation look and timing, the tray menu and start-at-login were never checked by a human eye.
- Multi-monitor / mixed-DPI overlay position and start point are untested.
- Elevated windows, fullscreen games and Remote Desktop are untested.
- Focus restore passed on one machine for a few rounds after being flaky before the fix; other machines or Windows builds may differ.
- uiohook reports `ctrlKey` etc. as false on the first modifier press after start, so `main.js` tracks modifiers itself: a keydown (incl. auto-repeat) within the last 2 s counts as held. If the OS drops a modifier keyup (secure desktop, lock screen) that key may count as held for up to 2 s; "the very first combo after start is Ctrl+Shift+C" is untested.
- With a Chinese IME active, E2E typed text via unicode `SendInput` to bypass the IME; with a real IME only "Enter during composition does not submit" was verified.
- Almost no logging (errors only, to the console, never key data), so problems on user machines are hard to diagnose.
- Non-Windows platforms are untested.
