# Code signing Tuck (Windows and macOS)

Windows first; macOS is at the end: [macOS: Developer ID and notarization](#macos-developer-id-and-notarization).

Why it matters for Tuck in particular:

- An **unsigned** installer gets the blue SmartScreen screen "Windows protected your PC". Users have to
  click "More info → Run anyway", and many give up there.
- Tuck installs a **global keyboard hook**. Antivirus heuristics (360, Huorong, Defender) treat unsigned
  programs with a keyboard hook much more suspiciously than signed ones; a signature from a real publisher
  is the cheapest way to look less like a keylogger.
- electron-updater can verify that a downloaded update was signed by the same publisher, but only when
  builds are signed.

Prices below are from memory or public pages and change often: **check the current price** before you buy.

## How the build picks a signing method

`npm run release` uploads a **draft**: publish it by hand on GitHub, because electron-updater ignores drafts
(until then "Check for updates" says "up to date").

`npm run dist` (local) and `npm run release` (uploads a draft GitHub Release, needs `GH_TOKEN`) both run
`scripts/dist.js`, which chooses from the environment:

| Environment | Result |
|---|---|
| `CSC_LINK` (path/URL/base64 of a `.pfx`) + `CSC_KEY_PASSWORD` | electron-builder signs with that certificate |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SIGN_ENDPOINT`, `AZURE_SIGN_ACCOUNT`, `AZURE_SIGN_PROFILE` (optional `AZURE_PUBLISHER_NAME`) | Azure Artifact Signing via `win.azureSignOptions` |
| none of these | Unsigned build. It works, but SmartScreen and antivirus will warn |

For hardware-token or cloud-HSM certificates that have no `.pfx` (most OV certificates since 2023), use
the vendor's signing tool after the build (see below), or set electron-builder's `win.signtoolOptions.sign`
to a custom script. Never commit a certificate or password; in CI use repository secrets.

## The 2023 rule: no more `.pfx` files from public CAs

Since **1 June 2023** (CA/Browser Forum baseline requirements), the private key of every publicly trusted
code-signing certificate, OV or EV, must live in a hardware device: a USB token or a cloud HSM (FIPS 140-2
Level 2 or better). In practice, for a solo developer this means one of:

- a **USB token** shipped by the CA: fine on your own PC, awkward in GitHub Actions;
- a **cloud signing service** from the CA (Certum SimplySign, SSL.com eSigner, DigiCert KeyLocker, …),
  usually billed on top of the certificate and scriptable from CI.

## Options for a solo developer (2026)

| Option | Who can get it | Rough cost (check current price) | CI-friendly | Notes |
|---|---|---|---|---|
| **Azure Artifact Signing** (formerly Trusted Signing) | Organizations in the US, Canada, EU, UK; individual developers in the US and Canada (check aka.ms/artifactsigningfaq, the list changes) | Basic about $9.99/month for 5,000 signatures | Yes, built into electron-builder | Cheapest real option if you are eligible. Identity validation by Microsoft. Not available to residents of China or Japan at the time of writing |
| **SignPath Foundation** | Open-source projects (OSI license, public repo, built in CI, actively maintained) | Free | Yes (GitHub Actions + SignPath) | The certificate is issued to "SignPath Foundation", not to you, so the publisher shown is SignPath Foundation. Builds must come from CI and pass their policy review. Good fit for Tuck as long as it stays MIT and public |
| **Certum Open Source Code Signing** | Individual open-source developers | Lowest-priced OV-style certificate (tens of euros a year) + token or SimplySign | SimplySign cloud: partly | Publisher shows your name with "Open Source Developer". Identity check with ID documents |
| **OV certificate, individual** (Certum, SSL.com, Sectigo via resellers such as ssl2buy, Gogetssl) | Individuals and companies; some CAs only sell OV to registered businesses | Roughly $100–$300/year + token or cloud-signing fee | With cloud signing (eSigner etc.) | Publisher is your legal name |
| **EV certificate** | Registered organizations only | Several hundred $/year | With cloud signing | Since 2024 EV **no longer** gives instant SmartScreen reputation, so for Tuck it is not worth the extra cost |

## SmartScreen reputation

SmartScreen judges the **file hash and the publisher's reputation**, built up from how many people have
downloaded and run the file without problems. A brand-new certificate starts with little reputation, so the
first releases may still show a warning for a while (days to weeks, depending on downloads). It improves
faster when:

- every release is signed with the **same** certificate (reputation follows the publisher);
- the download comes from a stable place (GitHub Releases);
- you submit false positives to Microsoft (https://www.microsoft.com/wdsi/filesubmission) and to Chinese AV
  vendors (360 and Huorong both have false-positive submission forms).

## Recommendation for Tuck

1. **Now:** ship unsigned, say so plainly on the download page and in the FAQ, and show the
   "More info → Run anyway" steps.
2. **Next:** apply to **SignPath Foundation** (free; Tuck is MIT and public). Move the build to GitHub Actions
   first, because SignPath signs CI artifacts only.
3. **If you want your own name as publisher:** Azure Artifact Signing if you are eligible in your country;
   otherwise a Certum Open Source or OV certificate with cloud signing.

## Release pipeline (`.github/workflows/release.yml`)

Pushing a tag `v*` (for example `git tag v0.2.0 && git push origin v0.2.0`) runs:

| Job | What it does | Signed when | Unsigned otherwise |
|---|---|---|---|
| `windows` | `npm test` + lint, builds the NSIS installer with `--publish never`, uploads it as artifact `win-unsigned` | secret `SIGNPATH_API_TOKEN` is set: the installer goes to SignPath, the signed exe replaces `dist/Tuck-Setup-*.exe`, and `scripts/refresh-latest-yml.js` rebuilds the `.blockmap` and the sha512/size in `latest.yml` (signing changes the bytes) | the installer is shipped as built |
| `mac` (arm64 on macos-14, x64 on macos-15-intel) | tests, builds dmg + zip, `codesign --verify`, renames `latest-mac.yml` to `latest-mac-<arch>.yml` | secret `MAC_CSC_LINK` is set: Developer ID signature; notarized too when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` are set (electron-builder does it on its own) | `CSC_IDENTITY_AUTO_DISCOVERY=false`, ad-hoc signed by `scripts/mac-adhoc-sign.js` |
| `publish` (tags only) | downloads `win`, `mac-arm64`, `mac-x64`, merges the two mac ymls into one `latest-mac.yml` (`scripts/merge-mac-yml.js`), runs `gh release create <tag> --draft --generate-notes` | | |

The release is always a **draft**: check the files, edit the notes, then publish it by hand (electron-updater
ignores drafts). A manual run (Actions > release > Run workflow) on a branch builds and keeps the artifacts
for 14 days but creates no release. The tag must match `version` in `package.json`, since the file names
come from it. The release must not exist yet (`npm run release` also creates one, so use one or the other).

## SignPath Foundation setup (free Windows signing)

1. Apply at https://signpath.org/apply. Requirements: an OSI-approved license (Tuck: MIT), a public
   repository, release artifacts built in CI from that repository (this workflow), and a
   [code signing policy](#code-signing-policy) published on the project page (README or website).
2. After approval, in the SignPath web app: add the GitHub.com trusted build system to the project, and
   create an **artifact configuration**. The GitHub artifact arrives as a zip containing the installer:

   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
     <zip-file>
       <pe-file path="Tuck-Setup-*.exe">
         <authenticode-sign/>
       </pe-file>
     </zip-file>
   </artifact-configuration>
   ```

3. Create an API token for a CI user that may submit to the signing policy, then in GitHub
   (Settings > Secrets and variables > Actions):

   | Kind | Name | Value |
   |---|---|---|
   | secret | `SIGNPATH_API_TOKEN` | the API token |
   | variable | `SIGNPATH_ORGANIZATION_ID` | organization ID (a GUID) |
   | variable | `SIGNPATH_PROJECT_SLUG` | project slug, e.g. `tuck` |
   | variable | `SIGNPATH_POLICY_SLUG` | signing policy slug, e.g. `release-signing` |
   | variable | `SIGNPATH_ARTIFACT_CONFIG_SLUG` | artifact configuration slug from step 2 |

4. Push a tag. With a release policy that needs manual approval, approve the request in SignPath; the job
   waits up to an hour. Then check the draft: `signtool verify /pa Tuck-Setup-x.y.z.exe`.

Removing `SIGNPATH_API_TOKEN` switches the pipeline back to unsigned builds.

## Code signing policy

Text for the project page, required by SignPath Foundation. It applies once the application is approved;
until then Windows builds are unsigned.

> Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by
> [SignPath Foundation](https://signpath.org).
>
> - Committers and reviewers: [BayarBH](https://github.com/BayarBH)
> - Approvers: [BayarBH](https://github.com/BayarBH)
>
> Only builds made by the GitHub Actions release workflow from this repository are signed.
>
> Privacy: Tuck makes no network requests except the update check, which is off until you turn it on or
> click "Check for updates…". See [PRIVACY.md](PRIVACY.md).

## Signing manually after the build (token / cloud HSM)

```powershell
npm run dist
# with the vendor's tool installed and the certificate in the Windows store (token or cloud):
signtool sign /fd sha256 /tr http://time.certum.pl /td sha256 /a "dist\Tuck-Setup-0.1.0.exe"
signtool verify /pa "dist\Tuck-Setup-0.1.0.exe"
```

If you sign after the build, re-generate the `latest.yml` checksum (or let electron-builder sign through a
custom `win.signtoolOptions.sign` script instead), otherwise auto-update will reject the changed file.

## macOS: Developer ID and notarization

Status: the macOS beta is **unsigned** (only ad-hoc signed by `scripts/mac-adhoc-sign.js`, so the
bundle is internally consistent). Consequences for users:

- Gatekeeper blocks the first open: right-click > Open, or System Settings > Privacy & Security >
  Open Anyway (see the README).
- The Accessibility permission is tied to the code signature. With an ad-hoc signature every new build
  looks like a different app to macOS, so users may have to remove and re-add Tuck in the Accessibility
  list after each update.
- Auto-update (Squirrel.Mac via electron-updater) refuses unsigned apps, so updates are manual.

To fix all three you need an **Apple Developer Program** membership: about **$99 / year** for an
individual (check the current price; fee waivers exist for some non-profits and education). With it,
create a **Developer ID Application** certificate (Xcode > Settings > Accounts, or the developer portal),
export it with its private key as a `.p12`, and create an **app-specific password** for your Apple ID
at account.apple.com.

`npm run dist:mac` (and electron-builder in CI) then picks everything up from the environment:

| Environment | Result |
|---|---|
| `CSC_LINK` (path/URL/base64 of the `.p12`) + `CSC_KEY_PASSWORD` | Signed with Developer ID, hardened runtime, `build/entitlements.mac.plist` |
| `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` | After signing, the app is notarized with `notarytool` and the ticket is stapled |
| (alternative to Apple ID) `APPLE_API_KEY` (path to the `.p8`) + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` | Notarization with an App Store Connect API key |
| none (`CSC_IDENTITY_AUTO_DISCOVERY=false` in CI) | Ad-hoc signed only, not notarized: what the beta ships today |

In GitHub Actions, store these as repository secrets and pass them as `env:` to the electron-builder
step (and drop `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`). Never commit the `.p12` or passwords.

Entitlements (`build/entitlements.mac.plist`, also used for helper processes): `allow-jit` and
`allow-unsigned-executable-memory` (V8), `disable-library-validation` (the `uiohook-napi` prebuilt
`.node` is not signed by your team ID) and `automation.apple-events` (System Events for the frontmost
window title). Accessibility is a runtime (TCC) permission, not an entitlement.

Check a signed build:

```sh
codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Tuck.app
spctl --assess --type execute --verbose dist/mac-arm64/Tuck.app   # "source=Notarized Developer ID"
xcrun stapler validate dist/Tuck-0.1.0-arm64.dmg
```

Recommendation: stay unsigned while the macOS build is a beta; once it has been verified on real Macs and
has users, the $99 membership is the only route to a smooth install, a stable Accessibility grant and
auto-update. There is no free equivalent of SignPath for macOS.

## Apple notarization setup (release.yml)

With the Developer ID certificate and app-specific password from above, add these repository secrets:

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | base64 of the `.p12`: `base64 -i DeveloperID.p12 \| pbcopy` (macOS) |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | your Apple ID e-mail |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | the 10-character team ID (developer.apple.com > Membership) |

`MAC_CSC_LINK` alone gives a signed but not notarized build (Gatekeeper still warns); set all five.
