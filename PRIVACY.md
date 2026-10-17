# Tuck privacy statement

Short version: **Tuck sees only Ctrl and C (⌘ and C on a Mac). Nothing leaves your computer.** The one exception is
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
- **Page link.** When the copy came from a web browser, the browser also put the page address on the
  clipboard. Tuck writes that address (http/https only, with any `user:password@` removed) under the
  quote in your notes file. It is never logged or sent anywhere. Turn it off in Settings > Privacy >
  "Save the page link".
- **Obsidian vault list.** Settings > Storage reads Obsidian's own list of vaults (`obsidian.json`) to
  offer them as notes folders. Tuck never changes that file or anything else of Obsidian's.
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

All files stay on your computer. `<userData>` is `%APPDATA%\Tuck` on Windows and `~/Library/Application Support/Tuck` on macOS.

| What | Where | Contains |
|---|---|---|
| Your notes | `Documents\Tuck\tuck.md` (or the folder you chose) | The text you captured, your thoughts, date, time, source app name and, for copies from a browser, the page link |
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

## macOS specifics

Everything above applies on a Mac, with ⌘ (Command) in place of Ctrl. Differences:

- **Accessibility permission.** macOS only lets an app see global key presses after you allow it in
  System Settings > Privacy & Security > Accessibility. Tuck asks for this permission only to notice
  the timing of ⌘ and C, reduced in memory exactly as described above (`ctrl` / `c` / `other`). The
  permission would technically allow more (for example controlling other apps); Tuck does not use it for
  anything else. You can revoke it in the same place at any time; Tuck then simply stops capturing.
- **Secure Keyboard Entry.** While a password field or an app with Secure Keyboard Entry turned on
  (Terminal, some password managers) has focus, macOS hides all key presses from Tuck. Nothing is
  captured then.
- **Frontmost app.** At a capture Tuck runs `/usr/bin/lsappinfo` to get the frontmost app's name (for
  example `Safari`), which goes into the note like the process name on Windows. To check your title
  exclusions it asks System Events (`osascript`) for the frontmost window's title. macOS may ask once
  whether Tuck may control "System Events"; if you decline, titles are not checked and only the app name
  is. Both are used only in memory for the exclusion check (plus the app name in the note); the title is
  never written anywhere.
- **Private clipboard.** Copies marked `org.nspasteboard.ConcealedType`, `TransientType` or
  `AutoGeneratedType` (1Password, Bitwarden, KeePassXC and others set these) are never saved.
- **Running apps list.** On a Mac the "Running apps…" picker asks `lsappinfo` for the names of visible
  apps; they are shown in the dropdown only.

## Removing Tuck

Uninstall it from Windows Settings, then delete `%APPDATA%\Tuck` if you want to remove settings,
logs, backups and crash reports. On a Mac, drag Tuck from Applications to the Trash, delete
`~/Library/Application Support/Tuck`, and remove Tuck from System Settings > Privacy & Security >
Accessibility. Your notes file stays where it is; it is yours.
