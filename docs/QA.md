# Tuck manual QA checklist

These checks need a real Windows machine. Unit tests and the dev smoke run cannot cover them. Run them before every release, on the **installed** build (`npm run dist` → install), not on `npm start`.

## Before you start

1. Quit Tuck from the tray. Delete or rename `%APPDATA%\Tuck\logs\tuck.log` so the log only holds this session.
2. Start Tuck. Open **Settings → Diagnostics** and check:
   - Key hook: **loaded** (green)
   - Capture: **active**
   - Running as administrator: **no** (the normal case)
   - Displays: every monitor listed with its scale (100%, 125%, 150% …)
   - Notes folder writable: **yes**
3. Click **Copy diagnostics** and paste the text into the test record. It must not contain any note text or window titles.
4. Keep the log open in a text editor that reloads files (VS Code). Tray → **Open log** opens it.

Where to look:

| What | Where |
|---|---|
| Log | `%APPDATA%\Tuck\logs\tuck.log` (older log: `tuck.log.1`) |
| Notes | the path shown under Settings → Storage |
| Backups | `%APPDATA%\Tuck\backups\` |
| Crash dumps (local only) | `%APPDATA%\Tuck\Crashpad\` |
| Last trigger time | Settings → Diagnostics → Last trigger (click **Refresh**) |

"Double-tap" = Ctrl+C twice within the double-tap gap. "Long-press" = hold Ctrl+C past the long-press duration, type a thought, press Enter.

Log lines you should see:
- `INFO [app] start <version>`: every launch.
- `INFO [capture] skipped: excluded`: a capture was blocked by the exclusion lists. It never names the app or the title.
- `ERROR [save] …`: the notes file could not be written. Also shows a tray balloon.
- `ERROR [hook] …`: the key hook could not start.
- `ERROR [win32] …`: the foreground/focus helper (PowerShell) failed.
- `ERROR [renderer] gone: …` / `ERROR [child] gone: …`: a window or helper process crashed.

**Privacy check, every run:** search the log for a word from a note you captured during the test and for a window title you used. Neither may appear.

---

## 1. Elevated windows (UIPI)

Windows blocks a normal process from reading input from, or focusing, an elevated (administrator) window. Tuck is not elevated, so the target is "fails cleanly", not "works".

| # | Steps | Expected |
|---|---|---|
| 1.1 | Open **Command Prompt as administrator**, select text, double-tap Ctrl+C. | Either the note is saved (Diagnostics → Last trigger updates), or nothing happens at all. No error dialog, no stuck overlay. If nothing happens, Last trigger does **not** update: the hook gets no keys while an elevated window has focus. Record which one you see. |
| 1.2 | Same window, long-press Ctrl+C. | Either the thought bar opens and Enter saves and returns focus to the admin window, or a balloon says "Could not take input focus, nothing was saved." The overlay must never stay on screen. |
| 1.3 | Open **Task Manager** (it runs elevated), then double-tap in a normal Notepad window. | Normal capture works. |
| 1.4 | Right-click Tuck.exe → Run as administrator. Diagnostics → Running as administrator. | Shows **yes** (amber). Captures in admin and normal windows both work. Quit it afterwards. |

## 2. Multiple monitors and mixed DPI

Set up two monitors with different scaling (for example 100% and 150%) and use Settings → Diagnostics to confirm that **mixed scaling** is shown.

| # | Steps | Expected |
|---|---|---|
| 2.1 | Double-tap in a window on the primary monitor. | The capsule flies to the bar on **that** monitor. It is crisp and correctly sized. |
| 2.2 | Same on the secondary monitor (other scale). | The bar shows on the secondary monitor at the right size (not 1.5× too big or small, not offset). |
| 2.3 | Alternate 2.1 and 2.2 five times quickly. | The bar always lands on the monitor under the mouse. It never appears half on one monitor. |
| 2.4 | Long-press on the secondary monitor, type, Enter. | The input bar is on the secondary monitor, the text is readable, and focus returns to the original window. |
| 2.5 | Monitor left of / above the primary (negative coordinates). | Same as 2.2. Diagnostics shows a negative origin. |
| 2.6 | Change a monitor's scale while Tuck runs, then capture. | Correct size after the change, without restarting Tuck. |
| 2.7 | Unplug the secondary monitor while Tuck runs, then capture. | The bar shows on the remaining monitor. No crash in the log. |

## 3. Security software

Test each product on a clean VM or spare PC with default settings. Install Tuck **after** the security product.

| # | Product | Steps | Expected / record |
|---|---|---|---|
| 3.1 | Microsoft Defender + SmartScreen | Download the installer through a browser and run it. | Record whether SmartScreen warns ("Windows protected your PC"). An unsigned build will warn; a signed build should not. Defender must not quarantine `Tuck.exe` or `uiohook_napi.node`. |
| 3.2 | 360 Total Security / 360安全卫士 | Install, launch, double-tap in Notepad. | Record any prompt such as "键盘记录" or "keylogger". If 360 blocks the hook, Diagnostics shows Key hook **failed** or captures silently stop (Last trigger never updates). Record the exact prompt text and choice. |
| 3.3 | Huorong / 火绒 | Same as 3.2. | Same as 3.2. Also check Huorong's log for blocked actions on `powershell.exe` (Tuck uses it for the foreground window name). If it is blocked, the log shows `ERROR [win32]` and notes have no app name. |
| 3.4 | Any product | Start at login enabled, reboot. | Tuck starts. Diagnostics shows Key hook **loaded**. |

## 4. Focus restore after long-press

For each app: put the caret in a text field, select some text, long-press Ctrl+C, type `qa`, press Enter, then type `x` right away.

Expected: the note is saved with the thought `qa`, and `x` lands back in the same app and field. No Alt menu opens and no "ding" sounds. Esc instead of Enter saves nothing and focus also returns.

| App | Result |
|---|---|
| Notepad | |
| Word | |
| Chrome (page text and the address bar) | |
| Edge | |
| Firefox | |
| VS Code | |
| Windows Terminal | |
| File Explorer (rename box) | |
| WeChat / 微信 | |
| QQ | |
| Feishu / DingTalk | |
| Obsidian | |
| Adobe Acrobat / PDF reader | |
| A full-screen app (F11 browser, a video player) | |
| A UWP app (Settings, Mail) | |

Also check: during long-press input, Alt+Tab to another app cancels the bar (nothing saved), and the bar does not stay on screen.

## 5. Input methods (IME)

| # | Steps | Expected |
|---|---|---|
| 5.1 | Microsoft Pinyin on. Long-press, type `nihao`, choose 你好 with Space, press Enter. | Thought saved as 你好. The first Enter only commits the IME candidate and does not submit too early. |
| 5.2 | Sogou Pinyin, same steps. | Same as 5.1. |
| 5.3 | Japanese IME, same steps with `konnichiha`. | Same as 5.1. |
| 5.4 | IME on, in Chinese mode, select text in Notepad and double-tap Ctrl+C. | Captured normally. The IME does not swallow Ctrl+C. |
| 5.5 | Mongolian keyboard layout, long-press, type traditional Mongolian. | Text saved correctly (check the .md file as UTF-8). |

## 6. Exclusions (privacy)

| # | Steps | Expected |
|---|---|---|
| 6.1 | Open a page whose title contains "Login" (for example a sign-in page) and double-tap. | Nothing saved, no animation. Log: `INFO [capture] skipped: excluded`, with no title. |
| 6.2 | Settings → Privacy → Running apps… → pick `notepad.exe`. Double-tap in Notepad. | Not saved. Remove the chip and try again: saved. |
| 6.3 | Within 3 s of starting Tuck, double-tap on a "Login" page. | Nothing is saved: either it is excluded, or the helper is still starting and a "Not ready yet" balloon appears (fail-closed). |

## 7. Settings and storage

| # | Steps | Expected |
|---|---|---|
| 7.1 | Move the long-press slider to 1200 ms, then hold Ctrl+C for about 800 ms. | Nothing opens. At about 1.3 s the bar opens. No restart needed. |
| 7.2 | Animation: Slower, then double-tap. | Slower fly-in. Faster is visibly quicker. |
| 7.3 | Storage → Change folder… → pick a OneDrive folder → **Move**. | The file is in the new folder. The old file is gone, and a copy `moved/tuck.md-<time>.md` is in the backups folder. The notebook shows the same notes. The next capture goes to the new file. |
| 7.4 | Change folder… → a folder that already has `tuck.md`. | Asked "Use that file / Cancel". Neither file is changed. |
| 7.5 | Change folder… → a read-only folder (for example `C:\Windows`). | "Tuck cannot write to this folder." Nothing changes. |
| 7.6 | Point the folder at a USB drive, unplug it, double-tap. | Balloon "Could not write notes…". Log: `ERROR [save]`. Tuck keeps running. Plug the drive back in: captures work again. |

## macOS

Not run yet on real hardware. Use the CI artifact (`Tuck-<version>-arm64.dmg` or `-x64.dmg`). Note the
Mac model, chip (Apple Silicon / Intel), macOS version and whether the menu bar is light or dark.

| # | Steps | Expected |
|---|---|---|
| M.1 | Install from the dmg, double-click Tuck in Applications. | Gatekeeper blocks it ("cannot be opened" / "unidentified developer"), **not** "is damaged". Right-click > Open > Open starts it; or System Settings > Privacy & Security > Open Anyway. |
| M.2 | First run: the tutorial opens. Step 2 is "Allow Tuck to notice ⌘C". | Traffic lights top-left do not overlap the brand. Next is disabled; status "Waiting for access…". |
| M.3 | Click **Grant access**. | The system prompt and/or System Settings > Privacy & Security > Accessibility opens. Turn Tuck on. Back in the tutorial, without clicking anything, the status flips to "Access granted" and Next is enabled. |
| M.4 | Quit, revoke Accessibility, start Tuck, open the tutorial from the menu-bar icon, click **Skip tutorial**. | The tutorial closes; "Show tutorial" in the menu still opens it. Settings > Privacy shows "Accessibility access: Not granted" and **Open System Settings** opens the right pane. Granting it there flips the status to Granted live. |
| M.5 | ⌘C double-tap and long press in **Safari**, **Chrome**, **Notes** and **VS Code**. | Each saves; the note header shows the app name (for example `Safari`). Long press opens the thought bar; Enter saves, Esc cancels. A single ⌘C is not captured. Ctrl+⌘+C and ⌘⇧C capture nothing. |
| M.6 | Focus return: long press in each app from M.5, then Enter, then type. | Typing lands in the original app and window, not in Tuck. Repeat with Esc. |
| M.7 | An app in full-screen (green button), long press, Enter. Then the same with two desktops (Spaces) and the source app on Space 2. | The bar appears on the current Space over the full-screen app; afterwards you are back on the same full-screen app / Space, with no jump to another Space. |
| M.8 | Two displays (one Retina, one not): double-tap and long press on each. | Animation and bar on the display under the mouse, sharp on both. |
| M.9 | Secure Input: Terminal > Secure Keyboard Entry on, ⌘C double-tap in Terminal. Also in a Safari password field. | Nothing captured (macOS hides the keys); Tuck keeps running and works again once Secure Keyboard Entry is off. Log has no errors. |
| M.10 | Password managers: copy a password from 1Password / Bitwarden / Keychain Access with a ⌘C double-tap (or their copy button, then a double-tap elsewhere). | Concealed clipboard is never saved. Adding the app name in Settings > Privacy (placeholder "App name") excludes it entirely. |
| M.11 | Title exclusion: open a page titled "Login" in Safari and double-tap. | First time macOS may ask whether Tuck can control "System Events": allow → skipped (excluded). Deny → only app names are checked; no repeated prompts. |
| M.12 | Settings > Start at login on (if offered), log out and in. | Tuck starts, menu-bar icon present, no Dock icon. System Settings > General > Login Items lists Tuck. |
| M.13 | Menu-bar icon in light and dark appearance (System Settings > Appearance), and with a colourful wallpaper ("tinted" menu bar). | The icon is a template image: black in light mode, white in dark, never a coloured square. Clicking it opens the menu. |
| M.14 | Notebook on macOS: ⌘F focuses search, ⌘Z undoes a delete, ⌘⌫ deletes the focused card, ⌘Enter saves an edit. Settings > Storage path uses `/`. | All work; labels show ⌘, not Ctrl. |
| M.15 | Install a newer CI build over the old one. | Check whether Accessibility is still granted. If not (expected with ad-hoc signing), the tutorial / Settings status says so; removing and re-adding Tuck in the list fixes it. |
