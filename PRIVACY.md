# Tuck privacy statement

Short version: **Tuck sees only Ctrl and C. Nothing leaves your computer.** The one exception is
checking for updates, which is off until you turn it on or click "Check for updates…".

This statement describes what the code in this repository does. If the code and this text ever
disagree, that is a bug; please report it.

## What Tuck observes

- **Keyboard.** Tuck installs a global keyboard hook (uiohook-napi) to notice a double tap or a long
  press of Ctrl+C. Every key event is reduced in memory to one of three values: `ctrl`, `c` or
  `other`, plus its timestamp and whether Shift/Alt/Win were held. Nothing else about the key is kept.
  Key events are never written to disk, never logged and never sent anywhere. Other keys are only used
  to tell "Ctrl+C" apart from "Ctrl+Shift+C" and similar.
- **Clipboard.** Tuck reads the clipboard text only right after a double tap or long press of Ctrl+C,
  that is, only when you just copied something on purpose. A single Ctrl+C is never read or recorded.
- **Foreground window.** At the moment of a capture Tuck asks Windows for the foreground app's process
  name (for example `chrome.exe`) and window title. The process name is written into the note so you
  know where a quote came from. The window title is used only in memory, to check it against your
  exclusion list (for example "bank" or "password"), and is never written anywhere.
- **Exclusion list.** If the foreground app or window title matches the exclusion list in Settings,
  the capture is skipped silently. If the app cannot be determined (the first seconds after Tuck starts,
  a restart of its helper, or Windows does not answer within 0.5 s), nothing is saved either.
- **Private clipboard.** If the app that put text on the clipboard marked it private (password managers
  do this with standard Windows clipboard formats), Tuck never saves it, whichever app is in front.
- **Running apps list (only when you ask).** The "Running apps…" picker in Settings > Privacy asks
  Windows once for the process names of apps that have a visible window, so you can add one to the
  exclusion list. The names are shown in that dropdown only; they are not stored or logged.

## What Tuck stores, and where

All files stay on your computer. `<userData>` is `%APPDATA%\Tuck`.

| What | Where | Contains |
|---|---|---|
| Your notes | `Documents\Tuck\tuck.md` (or the folder you chose) | The text you captured, your thoughts, date, time and source app name |
| Backups | `<userData>\backups\` | Copies of the notes file taken before edits/deletes and once a day; the newest 20 are kept |
| Settings | `<userData>\settings.json` | Your settings, including your exclusion lists |
| Log | `<userData>\logs\tuck.log` (+ `tuck.log.1`) | Start/stop, errors and their stack traces. **Never** note text, clipboard text, window titles or keys. Rotates at 1 MB |
| Crash reports | `<userData>\Crashpad\` | Minidumps written by Electron if Tuck crashes. They may contain parts of memory at the time of the crash. They are **never uploaded** (`uploadToServer: false`); delete the folder whenever you like |

Undo for edits and deletes in the notebook is kept in memory only and is lost when Tuck quits.

## Network

- Tuck's windows (overlay, notebook, settings, tutorial) cannot load anything from the network: every
  request that is not a local file is blocked. There are no web fonts, analytics, trackers or ads.
- **Updates (off by default).** Only when you turn on "Check for updates automatically" in Settings,
  or click "Check for updates…" in the tray, Tuck contacts GitHub (`github.com` and its download
  servers) to read the latest release information of `BayarBH/tuck`. Like any web request, this tells
  GitHub your IP address and the Tuck version. With the setting on, Tuck checks about 10 seconds after
  starting and then once a day. An update is downloaded only after you click "Download", and it is
  installed when Tuck quits.
- **Report a problem.** This opens a GitHub "new issue" page in your own browser, prefilled with
  version numbers (Tuck, Windows, Electron), display sizes and a few setting values. You see the exact
  text first. Nothing is sent unless you press Submit on GitHub yourself. Note text, window titles,
  file paths, your exclusion entries and the log are not included; you can attach the log by hand.
- There is no account, no telemetry and no automatic crash upload.

## Removing Tuck

Uninstall it from Windows Settings, then delete `%APPDATA%\Tuck` if you want to remove settings,
logs, backups and crash reports. Your notes file stays where it is; it is yours.
