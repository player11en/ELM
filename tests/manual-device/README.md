# Manual-device tests — not run by CI

These scripts drive a **real running Tauri desktop build or a real Android
device/emulator** over Chrome DevTools Protocol (CDP), rather than a plain
browser tab. They test things a browser can't: native Tauri bridge calls
(`grant_vault_scope`, `window.__TAURI__.fs`), Android's SAF picker flow, the
`AndroidNative` JS bridge, and real hardware-back-button handling.

**Why these aren't in `tests/e2e/` or wired into CI:**

- They connect to an *already running* app instance — none of them launch
  anything themselves.
- The Tauri desktop wrapper project (`ELM-desktop/`) isn't part of this
  repository yet (see the main README's Roadmap), so a CI runner has no
  Tauri binary to build or launch in the first place.
- Android scripts need a real device or emulator plus `adb`, which a normal
  GitHub Actions runner doesn't have.

This matches the repo's existing boundary: only the web build is
buildable/testable from what's published here.

## Running one of these yourself

**Tauri desktop** — launch a real build with its WebView2 remote-debugging
port open, then connect:

```bash
# however you normally launch the built app, plus the debug flag/env var
# your Tauri/WebView2 setup uses to open port 9333 (or 9341 for a second
# instance — see tauri-scale-test.js / tauri-no-phantom-conflict.js)
node tests/manual-device/tauri-e2e-test.js
```

**Android** — forward the WebView's devtools socket first:

```bash
adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>
node tests/manual-device/android-bridge-test.js
```

(Find the right `localabstract` socket name via `adb shell cat
/proc/net/unix | grep devtools`, or `chrome://inspect` on desktop Chrome
pointed at the device.)

Each script assumes the port is already forwarded/open before it runs —
none of them do that setup themselves. `tauri-vault-test.js` also stubs
`window.__TAURI__.dialog.open` before driving the vault-picker flow, since
CDP can't see or click native OS file dialogs.

## Files

| Script | Covers |
|---|---|
| `tauri-e2e-test.js` | General real-desktop-build smoke flow |
| `tauri-vault-test.js` | Vault picker + `grant_vault_scope` |
| `tauri-relaunch-test.js` | State survives a real app relaunch |
| `tauri-scale-test.js` | A second app instance, alternate debug port |
| `tauri-no-phantom-conflict.js` | Sync-conflict false-positive regression |
| `android-bridge-test.js` | `AndroidNative` JS bridge calls |
| `android-copy-test.js` | `copyTreeAbsolute` folder copy |
| `android-delete-test.js` / `android-mobile-delete-test.js` | Delete flow, mobile layout |
| `android-footer-test.js` / `android-footer-test2.js` | Mobile footer/tab behavior |
| `android-open-settings-test.js` | "All files access" settings deep-link |
| `android-ownwrite-test.js` | Raw-path own-write visibility |
| `android-readdir-test.js` | SAF directory listing |
| `android-vault-state.js` | Vault connection state across the bridge |
| `android-back-js-test.js` | Hardware back button → `handleAndroidBack()` |

These aren't run automatically — if you change anything these touch
(the Tauri commands, the Android bridge, SAF handling), run the relevant
one by hand against a real build before shipping.
