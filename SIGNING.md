# Code signing Tuck (Windows)

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

## Signing manually after the build (token / cloud HSM)

```powershell
npm run dist
# with the vendor's tool installed and the certificate in the Windows store (token or cloud):
signtool sign /fd sha256 /tr http://time.certum.pl /td sha256 /a "dist\Tuck-Setup-0.1.0.exe"
signtool verify /pa "dist\Tuck-Setup-0.1.0.exe"
```

If you sign after the build, re-generate the `latest.yml` checksum (or let electron-builder sign through a
custom `win.signtoolOptions.sign` script instead), otherwise auto-update will reject the changed file.
