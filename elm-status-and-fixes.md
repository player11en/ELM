---
title: ELM — Current State & Fix Backlog
type: review
tags: [meta, review, backlog]
created: 2026-09-08
status: active
---

# ELM — Current State & Fix Backlog

Companion to `note-app-master-plan.md`, not a replacement. The master plan
is the original design doc (Aug 2026) — most of what it lists as `⬜ not
started` is now built, some scope was added beyond it (desktop app, mobile
pass). This doc is a snapshot of where the app actually stands today, plus
the prioritized list of fixes for the next session.

---

## 1. What ELM Actually Is

Not "a notes app." A purpose-built worldbuilding/lore tool wearing a
notes-app shell — typed relationships, entity templates, vocab lint, alias
resolution, task rollup, query blocks, all built in rather than bolted on
via plugins. Real Obsidian-compatible markdown + frontmatter on disk, so
there is no lock-in — that's the single biggest thing it has over Notion.

Against the weighted framework used earlier this project (Data Ownership,
Speed, Writing Experience, Knowledge Org, Lore Tooling, Sync, Learning
Curve, Unique Value, Polish): ELM currently **ties Obsidian overall**,
ahead specifically on data ownership (self-hosted sync, zero cloud
dependency, now with real OS-level file access via the desktop build) and
lore tooling (built-in vs. plugin-dependent), behind on raw
writing-experience polish and ecosystem maturity — expected, one dev vs.
years of a team+community.

---

## 2. Built and Verified (beyond the master plan's original scope)

- **Desktop app (Tauri)** — real native Windows app, `elm.exe`. Fixes the
  actual permission-reconnect friction the master plan's Phase 1b/9 never
  fully solved: real OS-level file access, not a browser-revocable handle.
  Verified end-to-end on the actual built exe: full `taskkill` quit, fresh
  relaunch, zero clicks — vault reconnects automatically, no prompt.
- **Mobile responsive pass** — header no longer breaks `window.innerWidth`
  on narrow screens (was silently corrupting popover positioning app-wide),
  note editor fills height correctly, sidebar drill-down auto-closes,
  Focus Mode correctly scoped to desktop only (was a dead control on
  mobile).
- **PWA correctness** — real icon, correct manifest (`id`, sizes), service
  worker network-first for app code (was serving stale snapshots
  indefinitely), fully offline-capable including on the desktop build (all
  CDN libs vendored locally).
- **UI decluttering** — toolbar dropdowns (Heading/Insert/Align), footer
  tabs, collapsible sidebar and footer-fields panel, header overflow menu
  (desktop row down from 8 icons to 5 + "⋯").
- **Sync robustness** — `.sync-conflict-*` files surfaced in their own
  sidebar section instead of silently listed as ordinary notes; reindex on
  window/app focus.
- **Fixed a real latent bug**: an async init race that could leave the
  entire notes list blank on ~40-60% of reloads (unrelated to any of the
  above — found by stress-testing, fixed, verified 20 clean reloads after).
- **Vanished-vault crash, fixed**: if a connected vault folder stops
  existing (moved/deleted/drive unplugged — first hit when a test folder
  used for verification got deleted without disconnecting the app from
  it), every write failed with an uncaught "path not found." Root cause:
  Tauri's `allow_directory` only registers a permission pattern, it never
  checks the path exists — traced through the actual Rust source, the
  existing guard for this case could never fire. Added an explicit
  existence check on startup; a vanished vault now falls back cleanly to
  "Connect vault folder" with an explanatory toast instead of crashing on
  first write.
- **Confirmation dialogs were silently bypassed under Tauri — fixed, this
  one had real safety implications.** Tauri's dialog plugin overrides
  native `window.confirm()` to be *async*, but the specific command that
  override calls has no valid permission path (an apparent version
  mismatch in `tauri-plugin-dialog` 2.7.3 itself — confirmed by reading
  the shipped Rust source, the command isn't even registered). Every
  `if (!confirm(...)) return;` guard in the app — delete note, delete
  folder, restore backup, overwrite-on-conflict — was evaluating against
  a Promise object, which is always truthy, so the guard silently passed
  through **without waiting for real confirmation**. Fixed with a
  `confirmDialog()` helper that routes through the *working* dialog API
  (`window.__TAURI__.dialog.confirm()`, a different code path that uses
  an already-permitted command) under Tauri, native `confirm()` in the
  browser. Verified full round-trip on the real app: fired the dialog,
  confirmed no immediate ACL error, sent a real keystroke to the actual
  native OS dialog, confirmed it resolved correctly.

---

## 3. Fix Backlog (prioritized)

### ✅ DONE — Files-mode content viewer

Result cards, individual match lines, and sidebar file rows all open a
viewer showing the **whole** document, jumped to and centred on the clicked
match, with the search term still highlighted. Content was already parsed in
memory (`entry.lines`), so this renders from that rather than re-parsing.
Escape / backdrop / ✕ all close it.

### ✅ DONE — Incremental vault indexing + fast staged startup

Was: every startup *and every tab focus* threw the index away and re-read and
re-parsed every file, blocking before the app could render.

Now:
- **Persistent parsed cache** in IndexedDB (new `vaultCache` store, keyed by
  path, holding mtime+size). Derived and disposable — losing it costs one
  slow scan, never data.
- **Warm start reads zero files.** Measured: 3000 notes restored from cache
  in **40ms**, versus 13.7s to read them all. 800 notes: 13ms.
- **Rescans only read what changed**, verified by counting adapter calls, not
  by timing: unchanged vault = **0 file reads**; one file edited externally =
  exactly **1** read.
- **Cold start is progressive and newest-first**, which is the part that
  matters when there's no cache: at 1500 notes the first notes were usable at
  **949ms of a 3.9s scan**, list filling in as it went (251→659→858→1285→1500),
  and the first titles indexed were the newest ones (Note 1499, 1498, 1497…).
  Batched with an event-loop yield between batches so typing stays responsive.
- **Focus-regain is now incremental** and throttled to at most once per 30s —
  even a zero-read pass still has to stat every file (~3.5s at 3000 notes),
  which is worth paying occasionally to catch Syncthing changes, not every
  time you alt-tab.
- Save/create/delete/rename all keep the cache in step, and a guard stops a
  background pass from overwriting a note the app saved mid-scan.

**Two real bugs found while testing this, both desktop-only:**
1. `stat.mtime` is a **Date** on Tauri but a **number** on the browser
   backend. Two Dates are never `===`, so the cache thought every file had
   changed, every time — incremental indexing did nothing on desktop.
2. Same value feeds the save-time conflict check
   (`stat.mtime !== currentNoteDiskMtime`), which with Dates is *always* true
   — so every save of an open note claimed the file had changed underneath.
   This was invisible only because `confirm()` was separately broken and
   silently returning falsy; fixing confirm would have surfaced a phantom
   "changed on disk" prompt on every single save. Both fixed by normalising
   mtime to milliseconds in the Tauri adapter, and verified on the real
   desktop build against the actual vault (0 reads on rescan; two
   consecutive clean saves with no prompt).

### ✅ DONE — Attaching files to notes

Single-file attach already worked (Insert ▾ → 📎 Attach file / 🖼 Image, and
paste-an-image), all writing real files into `attachments/` with a markdown
link. Two gaps found and fixed:
- **Drag-and-drop onto a note did nothing** — the window drop handler was
  gated to files mode, so the most natural way to attach silently no-opped.
- **Only the first selected file was taken** (`files[0]`, no `multiple`), so
  picking five images attached one without saying so.

Both fixed, plus a newline guard so consecutive attachments don't weld their
links onto the end of the previous line.

### 🔴 HIGH — ~~Files-mode search can't show you the content~~ (done, above)

Confirmed in code, not assumed: `result-card` click (`toggleCard`,
`index.html` search-results section) only expands/collapses the
match-line snippets already shown. There is no path anywhere — not from a
search result, not from the sidebar file list — to open a loaded file's
full content. You can find *that* a term exists and *which lines*, never
read it in context.

This is exactly the open question `note-app-master-plan.md` §6 flagged
and never resolved ("no path from a search result into the vault"). Fixing
the viewer is also the moment to answer that question: does Files mode
stay a standalone search tool, or gain a "cite this in a note" /
"create note from this match" bridge into the lore layer? Worth deciding
together before building, not after.

**Minimal fix**: clicking a result card opens the file into a read-only
reader pane (you already have pdf.js/mammoth/xlsx renderers wired up
elsewhere in the app for previews), scrolled to the first match.

### ✅ CLOSED — Editor engine / live syntax coloring (won't do)

**Wikilink autocomplete: done** (see §5) — `[[` suggests notes as you type,
built without CodeMirror.

**Live syntax coloring while typing: closed, not deferred.** A plain
`<textarea>` cannot render colored spans inside itself; it needs CodeMirror
6, which needs a bundler, which breaks the zero-build-step single-file
architecture that lets web/desktop/Android all ship from one `index.html`.
Rejected in the master plan and twice more since. Removed from the backlog
rather than left lingering — it kept resurfacing as if undecided.

Colored/highlighted **content** is a separate thing and is supported:
`==highlight==` (Obsidian-compatible) and raw HTML
`<span style="color:…">`. Rendering colored output never needed an editor
engine — only coloring the raw text *while typing* did.

### ✅ DONE — Release build polish (MSI)

`tauri build --bundles msi` succeeded on retry — the earlier WiX toolset
download timeout was a one-off, not a persistent issue. Real installer now
exists: `ELM_1.0.0_x64_en-US.msi` (6MB), verified as genuinely well-formed
(not just "file exists") by reading its own `ProductName`/`ProductVersion`/
`Manufacturer` metadata via the Windows Installer COM API. Plain `.exe`
still works too, both are valid ways to ship.

**Code signing: closed, won't do.** A signed binary needs a purchased
OV/EV certificate (~$200-500/yr plus identity verification). No code change
removes the SmartScreen warning; it's a one-time click-through on first
launch. Removed from the backlog — signing can be wired into the build in
minutes *if* a cert is ever bought, but it isn't an open task until then.

**Icon padding: done.** The earlier note here claimed no image tooling was
available in-session — that was wrong. A canvas in a headless browser does
it fine: `icon-maskable.png` is generated with the art inside the 80% safe
zone on the icon's own sampled brand blue, and `manifest.json` now declares
`any` and `maskable` as two separate entries. The previous single entry
marked `"any maskable"` was actively wrong — unpadded art gets cropped by
launcher masks.

### ✅ DONE — `.trash` retention

Every delete used to move a file into `.trash/` and leave it there forever
— no cleanup path existed anywhere. Fixed: `purgeOldTrash()` runs once per
vault load (after reconcile, so it never delays first paint), purges
entries older than 30 days by parsing the timestamp already embedded in
each trashed filename. Verified live: a 40-day-old fixture entry got
purged, a 5-day-old one was kept, and a file not matching the naming
convention was left untouched (not guessed at).

### ✅ DONE — Android

**Blocking finding, checked in the plugin source before installing anything:**
`tauri-plugin-dialog` has `#[cfg(mobile)] return Err(FolderPickerNotImplemented)`
— there is **no folder picker on Android**. Its Kotlin side only does
`ACTION_GET_CONTENT` (single files), with a literal `// TODO:
ACTION_OPEN_DOCUMENT ??`, and no `ACTION_OPEN_DOCUMENT_TREE` (the only way to
get a persistable folder grant). Since "connect a vault folder" is the whole
storage model, that had to be settled first.

Chosen approach: **fixed path, no picker.** The vault path is entered/confirmed
once (defaulting to `/storage/emulated/0/Documents/ELM_Data` — shared storage,
so Syncthing and the file manager can both see it) and reached through plain
`std::fs`, which the fs plugin's mobile path does support. Needs Android's
"All files access" permission, granted manually in Settings for a sideloaded
personal app. Rejected the alternative — writing a custom Kotlin SAF plugin —
as far more work for a nicer picker.

Done so far (all verified on desktop/browser, since the rest needs a device):
- `IS_ANDROID` detection + `ANDROID_DEFAULT_VAULT`
- Path-entry modal replacing the picker, with prefill / Enter / Escape /
  cancel-resolves-null, and no listener leaks across repeated opens
- `connectVault()` Android branch: grant scope → `mkdir -p` → verify it's
  readable, with a clear "grant All files access" message if not
- Startup failure message is Android-aware (a revoked permission and a
  deleted folder are indistinguishable at that level)
- All four Rust Android targets installed
- Confirmed completely inert on desktop/browser — full suite still green

Built and verified end-to-end on a real physical device (`app-universal-debug.apk`,
all 4 architectures), debugged live via adb + Chrome DevTools Protocol against
the WebView (`adb shell input tap` is blocked on this device by an
`INJECT_EVENTS` `SecurityException`, so verification went through direct
`page.evaluate()` calls against the running app's own functions, not
simulated taps).

Three real bugs found and fixed on-device, none reproducible on
desktop/browser:
- **`MANAGE_EXTERNAL_STORAGE` isn't grantable via a normal permission
  dialog** — it's a "special permission," manifest declaration alone does
  nothing. Symptom was misleading: `readDir` on the vault root returned only
  4 of 12 real entries (Android's scoped-storage fallback shows folder
  structure for navigation but hides individual files without the grant) —
  looked at first like a case-sensitivity bug (`ELM_Data` vs. on-disk
  `ELM_data`), ruled that out by confirming Android's storage layer resolves
  case-insensitively regardless. Real cause confirmed via
  `adb shell appops get <pkg> MANAGE_EXTERNAL_STORAGE` showing an explicit
  denial. Fixed by deep-linking straight to the exact settings screen
  (`ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION`) instead of a generic
  toast pointing at Settings.
- **Header clashed with the status bar, footer buttons (Delete/Export
  HTML/Present) unreachable below the nav bar.** Root cause: on this device
  (Android 16) edge-to-edge rendering is mandatory, not opt-in — removing
  the scaffolded `enableEdgeToEdge()` call did *not* fix it, confirmed via
  screenshot. Real fix: `MainActivity.kt` now applies real `WindowInsetsCompat`
  system-bar insets as padding on the root view. Verified after the fix —
  header no longer clashes, and all three footer buttons sit fully inside
  the viewport (measured via `getBoundingClientRect()`, not just eyeballed).
- **Delete failed with `"forbidden path: .../.trash ... allow-mkdir"`.**
  Tauri's fs-scope glob matching defaults `require_literal_leading_dot` to
  `cfg!(unix)` — true on Android, false on Windows — so the recursive
  wildcard vault-scope grant silently excludes the dot-prefixed `.trash`
  folder on Android only (every delete writes there). Fixed in
  `grant_vault_scope` (`lib.rs`) by granting `.trash` its own explicit,
  non-wildcard scope entry. Verified via direct `deleteNote()` call:
  `vaultIndex.size` 11→10, no error, and independently confirmed via
  `adb shell ls` that the file physically moved into `.trash/` on disk.

**Update, later session — the in-app "tap to grant" button got built after all.**
The `run_on_android_context`/custom-plugin route above was correctly assessed
as too much machinery for one Settings deep-link — the actual answer was
much smaller: `MainActivity.kt` now exposes an `AndroidBridge` via
`WebView.addJavascriptInterface()` (a standard, much lighter mechanism than
a full Tauri plugin), with `hasAllFilesAccess()` and
`openAllFilesAccessSettings()`. Verified live: deep-links straight to ELM's
own toggle screen (confirmed via screenshot — not a generic app-chooser),
and after granting, `hasAllFilesAccess()` correctly flips `true`.

### Real bug found and fixed: SAF folder picker + real-path hybrid design

Built a proper Android folder picker (`ACTION_OPEN_DOCUMENT_TREE` via the
`tauri-plugin-android-fs` crate — 0 open issues, actively maintained,
confirmed via docs.rs to be Rust+Kotlin only with no npm dependency, so it
fits ELM's zero-bundler architecture) to replace the manual path-typing
modal and avoid needing "All files access" for the vault folder itself.
Design: SAF grants the permission, but a custom `resolve_tree_uri_to_path`
(`lib.rs`) maps the returned tree URI back to a real filesystem path
(`primary:Sub/Dir` → `/storage/emulated/0/Sub/Dir`) so all actual I/O
keeps going through the existing fast `tauriVaultAdapter` — deliberately
avoiding SAF's own `DocumentFile`/`ContentResolver` API for bulk reads,
since Syncthing-Fork's own forum documents that path making thousand-file
vaults take hours instead of minutes.

**What this missed, found live on-device, not assumed:** raw path access
via a SAF grant only sees files the app itself wrote. Confirmed by direct
test — `readDir` on a real shared folder returned 8 directories and **zero**
of the 9 real `.md` files sitting in it (verified against `adb shell ls`);
writing a file through the app made it appear in the very next listing.
Every file written by anything else — Syncthing, a different build of the
app, a file manager — was invisible, not just unreadable. This is worse than
the "old notes don't show" symptom it was investigated for: it meant
**Syncthing's actual sync direction into the app was silently broken** —
new/updated files from other devices wouldn't be seen.

Root cause: Android's raw-path fallback visibility for non-owned files is
gated on `MANAGE_EXTERNAL_STORAGE` specifically, independent of any SAF
grant — the two permission systems don't cross over for this. Fixed by
bringing that permission back, but scoped: only required when connecting or
switching to a **shared** folder (via `ensureAllFilesAccess()`, using the
`AndroidBridge` above); the zero-setup app-private default vault still
needs nothing. Verified end-to-end: `readDir` on the same folder went from
8 entries (dirs only) to 18 (all real files) immediately after granting.

### Other fixes from the same live-device session

- **Toast overflow** — `.toast` had `white-space: nowrap` and no
  `max-width`, so any long message (a path + OS error) spilled off both
  edges of the screen. Now wraps within `min(560px, 100vw - 40px)`.
- **Mobile delete leaving a blank screen** — `closeNote()` cleared the
  `mobile-note-open` layout class but not the separate `hidden-mobile` flag
  on the notes-list panel (only the dedicated "back" button cleared that
  one); delete's handler called `closeNote()` directly and never touched
  it, so both the note view and the list ended up hidden. Fixed by moving
  the clear into `closeNote()` itself.
- **Hardware back button exiting the app instead of closing the open
  note** — the generated `TauriActivity` ships with
  `handleBackNavigation = false` (it only understands real WebView
  navigation history, not this SPA's in-page note view), so a bare press
  fell straight to Android's default. Fixed with a real
  `OnBackPressedCallback` in `MainActivity.kt` that asks the page first via
  a new `handleAndroidBack()` JS hook.
- **Wrong launcher icon** — `tauri icon`'s generated output
  (`src-tauri/icons/android/`) never got synced into the actual Android
  project (`gen/android/app/src/main/res/`), which still had Tauri's
  scaffold default (a ring/dot logo). Confirmed via screenshot of the real
  app drawer. Fixed by copying the real icons over, including the missing
  `mipmap-anydpi-v26/ic_launcher.xml` adaptive-icon definition that never
  existed in the generated project at all.

### Release build

Signed release APK + AAB both build clean (`elm-release.jks`, personal
sideload-only key — **must be kept**, losing it means a future release
update can't install over an existing one without uninstalling first).
Windows release `elm.exe` also rebuilt with this session's fixes. Both
verified working on the real device / real machine, not just "builds
without error."

### Full regression check (this session, after all the above)

Ran the existing Playwright suite (smoke, vault-adapter round-trip,
attachments multi+drag-drop, file viewer, PWA offline/manifest/service
worker, progressive load at 2000 notes) plus a new direct test for
export/import specifically (`.md` export, `.html` export, JSON backup
download, and restore — wipe-then-repopulate verified, not just "no
error"). All green, zero console errors. Nothing in this session's changes
(all Android/Tauri-side, plus one shared CSS fix) touched the browser/PWA
code paths that matter here, and this confirms it.

---

## 4. Suggested Order

Desktop and Android are both done and verified, including the SAF picker +
All Files Access redesign and a full regression pass. Everything remaining
in §3 is pull-when-it-hurts, not scheduled.

---

## 5. New features (market comparison → build)

From a full comparison against Obsidian/Notion/Joplin/dedicated
worldbuilding tools, three concrete gaps were picked and built. All three
are web-layer only (`index.html`/`sw.js`), so they flow through to the
desktop/Android builds for free on the next rebuild — no separate porting
work, same as everything else since the storage-adapter split.

### ✅ DONE — Wikilink autocomplete

`[[` in the editor opens a popover near the cursor listing matching note
titles (title-only fuzzy match against `noteMetaIndex`, not the full-text
`searchIndex` — deliberately, to avoid surfacing notes that just happen to
mention the query somewhere in their body). Arrow keys + Enter, or a click,
insert `Target]]` at the cursor; a trailing "+ Create ..." row creates a
new note on the spot if nothing matches. Scoped to plain `[[query` with no
`#`/`|`/`]]` typed yet — mid-link heading/alias editing is out of scope.

The one genuinely new piece: a `<textarea>` has no real DOM caret to
measure, so `getCaretCoordinates()` uses the standard mirror-div technique
(an invisible div cloned with the textarea's exact box model, filled with
text-up-to-caret, measuring where a marker span lands) — self-contained,
~40 lines, not a dependency.

One real bug caught before shipping: the initial cut computed the
replacement range to include the `[[` itself instead of starting right
after it, so picking a suggestion produced `Target]]` with the opening
brackets deleted. Caught by an actual round-trip assertion (not eyeballing
the popover), fixed, reverified.

### ✅ DONE — Graph view

A node/edge visualization of the vault — notes as nodes, wikilinks and
typed relationships as edges, click a node to open it. 100% reuses data the
app already computes (the same `noteMetaIndex`/`resolveWikilinkTarget` loop
`renderBacklinksSection` already runs, and the same frontmatter-key-as-
relationship-type logic `renderRelationshipsSection` already runs) — no new
parsing. Unlinked-mention edges deliberately excluded: that scan is
per-note "check every other note's text," which across the whole vault
would be a real O(vault²) pass, unlike the two edge types that shipped.

New vendored dependency: `vis-network` 9.1.13 (standalone UMD build,
620KB), added to `vendor/` and `sw.js`'s `PRECACHE` (cache key bumped
`v3`→`v4`) the same way as the other 9 libraries — zero live-CDN policy
held, confirmed before picking a library, not after.

### ✅ DONE — Daily notes

One action (header icon behind the `⋯` overflow menu, plus Ctrl+Shift+D)
opens today's note, creating it in a "Daily" folder from a small template
only if it doesn't already exist that day. Reuses the exact existing
"create with a known title" pipeline (`createNote()` → `saveNote()` →
`commitNoteRename()`) already used by the command palette's create-note
flow, and the exact O(1) `resolveWikilinkTarget()` lookup wikilinks already
use to check "does a note with this title exist" — no new scan written.
Verified idempotent in both storage modes: calling it twice in a row opens
the same note both times, never creates a duplicate.

### Verification

New Playwright tests written for all three (round-trip insert assertions
for autocomplete, node/edge-count assertions for the graph, double-call
no-duplicate assertion for daily notes — not just "it opened without
throwing"), plus the full existing suite re-run afterward (smoke,
vault-adapter, attachments, file viewer, PWA) confirming nothing regressed.
`smoke.js`'s hardcoded overflow-menu-contents assertion needed updating
twice (once per new header button) — expected, not a bug, and now current.
