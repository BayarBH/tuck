# Microsoft Store (MSIX)

The Store build is the same app packaged as MSIX. The Store signs it, so Store users never see the
SmartScreen warning and Smart App Control does not block it. No code-signing certificate is needed.

## How the Store build differs

| | Installer (`npm run dist`) | Store (`npm run dist:store`) |
|---|---|---|
| Updates | Optional GitHub check (Settings > Privacy) | The Store updates it. The GitHub check, its setting and "Check for updates…" are hidden |
| Start at login | Windows login item (Run key) | The manifest's `windows.startupTask` (`TuckStartup`, off until the user turns it on), switched with the WinRT `StartupTask` API (`src/startupTask.js`). If the user turned it off in Windows Settings > Apps > Startup, the tray item opens that page instead |
| Settings and logs | `%APPDATA%\Tuck` | Windows redirects them to the package's own folder (`%LOCALAPPDATA%\Packages\BayarBH.Tuck_…\LocalCache\Roaming\Tuck`); they are removed with the app |
| Notes file | Unchanged: `Documents\Tuck\tuck.md` or the folder you choose, never removed with the app | Same |

`process.windowsStore` tells the two apart at runtime.

## Build and submit

1. Partner Center → Apps and games → New product → MSIX or PWA app → reserve the name **Tuck**.
2. Product identity (Partner Center → Product management → Product identity) gives three values. Build with them:
   ```
   npm run dist:store -- -c.appx.identityName=<Package/Identity/Name> -c.appx.publisher="<Package/Identity/Publisher>" -c.appx.publisherDisplayName="<Package/Properties/PublisherDisplayName>"
   ```
   The values in `package.json` (`BayarBH.Tuck`, `CN=BayarBH`) are placeholders for local builds only.
3. Upload `dist/Tuck-<version>-store.appx` as a package. Leave it unsigned: the Store signs it.
4. Store listing: description and screenshots from the README; privacy policy URL
   `https://github.com/BayarBH/tuck/blob/main/PRIVACY.md`; category Productivity; price free.
5. Paste the two texts below into the submission.

## Restricted capability justification (`runFullTrust`)

```text
Tuck is a desktop (Win32/Electron) app packaged with the Desktop Bridge. runFullTrust is required to run it at all:
it is a system-tray app that uses a low-level keyboard hook to notice when the user double-taps or holds Ctrl+C,
and it reads the foreground window's title and process name to skip excluded windows (password managers, banking,
login pages) and to return focus after the user adds a note.
```

## Notes for certification

```text
What Tuck does: when the user double-taps Ctrl+C, Tuck saves the text they just copied into a plain Markdown file
on their own computer (Documents\Tuck\tuck.md by default). Holding Ctrl+C opens a small box to add a thought.
A single Ctrl+C is never recorded.

Keyboard hook: Tuck installs a global low-level keyboard hook only to time the Ctrl and C keys. No other key is
read, logged or stored; the source is public: https://github.com/BayarBH/tuck (src/main.js, src/keys.js, src/keyDetector.js).

Network: none. The GitHub update check of the installer version is removed from this Store build.
Privacy policy: https://github.com/BayarBH/tuck/blob/main/PRIVACY.md

How to test:
1. Launch Tuck. A tutorial opens; it lets you try a capture safely.
2. In any app (Notepad is fine), select some text and press Ctrl+C twice quickly. A small capsule flies into the
   bar at the bottom of the screen: the text is saved.
3. Select text, then hold Ctrl+C for about a second. Type a note and press Enter.
4. Tray icon > Open notebook shows both entries. No account or sign-in is needed.
```
