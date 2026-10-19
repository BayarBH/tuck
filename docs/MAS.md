# Mac App Store (MAS)

The Mac App Store build is the same app, sandboxed. The sandbox forbids what the regular macOS build uses
(uiohook-napi's active event tap, `lsappinfo` / `osascript` / `open`, writing to `~/Documents`), so the MAS
build swaps those parts for a small native addon (`native/mac/tuck_mac.mm`) and a notes folder the user picks.
`process.mas` tells the builds apart at runtime. The regular dmg/zip build and the Windows builds are unchanged.

**Status: not verified.** Everything here was written on Windows. Nothing in `native/mac/` has been compiled,
and no MAS build has been packaged, signed, run, tested or submitted. Expect to fix things on the first run
on a Mac. What is checked: `npm test` and `npm run lint`, the `package.json` build config against
electron-builder's schema, and which files electron-builder's file matchers pick for `mas` vs `mac`.

## How the MAS build differs

| | macOS dmg/zip (`npm run dist:mac`) | Mac App Store (`npm run dist:mas`) |
|---|---|---|
| Key hook | uiohook-napi (active CGEventTap) | `native/mac` listen-only CGEventTap (`src/macHook.js`); uiohook-napi is not in the app |
| Permission | Accessibility | Input Monitoring (System Settings > Privacy & Security > Input Monitoring) |
| Front app | `lsappinfo`, window title via System Events (`osascript`) | `NSWorkspace.frontmostApplication` only. Window titles are never read, so **title exclusions do not apply**; app exclusions do |
| Focus return after a thought | `open -b` / System Events | `NSRunningApplication activateWithOptions` |
| Notes folder | `~/Documents/Tuck` or any folder | First run asks for a folder (security-scoped bookmark, `notesDirBookmark`). Cancel keeps the sandbox's own `Documents/Tuck` (inside `~/Library/Containers/com.bayar.tuck/`) |
| Obsidian vaults | Detected from `obsidian.json` | Not detected (outside the sandbox); pick the vault folder by hand |
| Updates | GitHub check (opens the Releases page) | The App Store updates it. The GitHub check, its setting and "Check for updates…" are hidden |
| Start at login | `app.setLoginItemSettings` | Same API (unverified that it works in the sandbox: test step 7) |
| Settings and logs | `~/Library/Application Support/Tuck` | `~/Library/Containers/com.bayar.tuck/Data/Library/Application Support/Tuck` |
| Architecture | Separate arm64 and x64 | One universal app |
| Signing | Developer ID or ad-hoc, hardened runtime | Apple Distribution, sandbox entitlements, no hardened runtime |

## Prerequisites

- Apple Developer Program membership (99 USD/year).
- A Mac with Xcode Command Line Tools (`xcode-select --install`), Node 20+, npm.
- In Certificates, Identifiers & Profiles (developer.apple.com):
  - Certificates **Apple Distribution** and **Mac Installer Distribution** (for submission), and **Apple Development**
    (for local testing). Install them in the login keychain.
  - App ID `com.bayar.tuck` (explicit, macOS).
  - Provisioning profile, type **Mac App Store Connect**, for that App ID → save as `build/embedded.provisionprofile`
    (gitignored). For local testing also a **macOS App Development** profile with your Mac registered.
- In App Store Connect: a new macOS app with bundle ID `com.bayar.tuck`, name **Tuck**.
- Nothing to edit for the Team ID: at signing, @electron/osx-sign reads it from the provisioning profile and adds
  the application group `<TeamID>.com.bayar.tuck` that Electron needs in the sandbox.

## Build

```
npm ci
npm run dist:mas   # builds native/mac (node-gyp), then dist/Tuck-<version>-mas.pkg (universal, signed)
```

`npm run build:mac-native` alone builds `native/mac/build/Release/tuck_mac.node` (arm64 + x86_64). It uses
npm's bundled node-gyp; the addon is plain N-API, so no Electron-specific rebuild is needed.

App Store Connect needs a higher build number for every upload: add `-- -c.buildVersion=<n>` to `dist:mas`
(the version shown to users stays `version` from `package.json`).

What the config does (electron-builder 25.1.8, checked in its source):

- `build.mas` is merged over `build.mac`, so the MAS build keeps the icon, category and `LSUIElement`, and
  sets its own entitlements, `hardenedRuntime: false` and the provisioning profile.
- `build.mas.files` adds `native/mac/build/Release/tuck_mac.node` (unpacked from the asar via
  `build.mas.asarUnpack`) and removes `node_modules/uiohook-napi`. The dmg/zip build sees neither change.
- `build.mas.x64ArchFiles` lets the already-universal `.node` through `@electron/universal` unchanged.
- electron-builder ignores `build.mas.extendInfo` and always applies `build.mac.extendInfo`. So the
  afterPack hook `scripts/mac-adhoc-sign.js` edits the MAS `Info.plist` before signing: it removes
  `NSAppleEventsUsageDescription` and sets `ITSAppUsesNonExemptEncryption` to `NO`.
- Entitlements: `build/entitlements.mas.plist` (app sandbox, user-selected read/write, app-scoped bookmarks,
  application group), `build/entitlements.mas.inherit.plist` (helpers: sandbox + inherit),
  `build/entitlements.mas.loginhelper.plist` (Login Helper: sandbox only). No network entitlement.

## Test locally

A build signed for the App Store does not run outside the store. Test with a development build:

```
npm run build:mac-native
npx electron-builder --mac mas-dev --universal --publish never -c.mas.provisioningProfile=<path to the development .provisionprofile>
```

Then run `dist/mas-dev-universal/Tuck.app` and check at least:

1. First run asks for a notes folder; pick one. Quit and start again: no second prompt, and captures still land there.
2. The tutorial asks for **Input Monitoring** (not Accessibility). Grant it; the status should flip without a restart. If ⌘C is still not seen, relaunch and note it.
3. ⌘C double-tap and long press in Safari, Notes, VS Code: saved, with the app name in the header. A single ⌘C is not saved.
4. Long press, Enter: focus goes back to the source app.
5. Settings > Diagnostics: permission row says Input Monitoring, Auto-update says App Store. No "Check for updates…" in the menu.
6. Settings > Storage > change folder: the new folder works after a restart.
7. Settings > Start at login, log out and in.
8. `codesign -d --entitlements - dist/mas-dev-universal/Tuck.app` shows the sandbox entitlements;
   `plutil -p dist/mas-dev-universal/Tuck.app/Contents/Info.plist` has no `NSAppleEventsUsageDescription`.
9. `ls dist/mas-dev-universal/Tuck.app/Contents/Resources/app.asar.unpacked/node_modules` has no `uiohook-napi`.

Also run the macOS section of [`QA.md`](QA.md); rows about System Events and window titles do not apply.

## Submit

1. Open **Transporter** (Mac App Store, free), sign in, drag in `dist/Tuck-<version>-mas.pkg`, Deliver.
2. In App Store Connect pick the build, fill in the listing (description and screenshots from the README),
   category Productivity, privacy policy URL `https://github.com/BayarBH/tuck/blob/main/PRIVACY.md`.
   Price: paid up front, one-time. Base price USD 4.99 (United States), China mainland set manually to CNY 30,
   other regions auto-equalized from the US price. No subscription, no in-app purchase.
   The GitHub builds stay free (MIT); the store build pays for signing, notarization and the developer fee.
   Before the first paid release, enroll in the App Store Small Business Program (15% commission instead of 30%).
3. App Privacy: **Data Not Collected**. The update code is never loaded in this build, the app has no network entitlement, no account, no analytics.
4. Export compliance: no non-exempt encryption (also answered by `ITSAppUsesNonExemptEncryption` in Info.plist).
5. Paste the text below into App Review Information > Notes.

## App Review notes

```text
What Tuck does: when the user double-taps Command+C, Tuck saves the text they just copied into a plain
Markdown file in a folder they chose. Holding Command+C opens a small box to add a thought. A single
Command+C is never recorded. Tuck lives in the menu bar (no Dock icon).

Input Monitoring: Tuck uses a listen-only event tap (CGEventTapCreate with kCGEventTapOptionListenOnly)
only to time the Command and C keys. It cannot change or block key events. No other key is read, logged,
stored or sent; every other key is reduced to "other" in memory to tell Command+C apart from
Command+Shift+C and similar. The source is public: https://github.com/BayarBH/tuck
(native/mac/tuck_mac.mm, src/macHook.js, src/keys.js, src/keyDetector.js).

Files: the notes file is written only to the folder the user picks on first launch (security-scoped
bookmark), or to the app's own container if they cancel.
Network: none. There is no account, no analytics and no update check in this build.
Privacy policy: https://github.com/BayarBH/tuck/blob/main/PRIVACY.md

How to test:
1. Launch Tuck. It asks where to save notes: choose any folder (or Cancel to use the default).
2. A tutorial opens and asks for Input Monitoring. Click Grant access and turn Tuck on in
   System Settings > Privacy & Security > Input Monitoring. The tutorial continues by itself.
3. In any app (TextEdit or Safari), select some text and press Command+C twice quickly. A small capsule
   flies into a bar at the bottom of the screen: the text is saved.
4. Select text, then hold Command+C for about a second. Type a note and press Return.
5. Menu bar icon > Open notebook shows both entries. No sign-in is needed.
```
