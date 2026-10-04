# ELM

**Local-first markdown knowledge tool — notes, wikilinks, graph view and
static-site publishing. Web, desktop and Android from a single HTML file.
No cloud, no lock-in.**

ELM stores everything as plain markdown with YAML frontmatter in a folder you
choose. It's Obsidian-compatible on disk, so the same vault opens in either
tool, and nothing stops working if ELM goes away.

---

## Why it exists

Developers have IDEs — structure, navigation, cross-references, search,
history. People working with text, research, planning and worldbuilding have
documents in folders, or cloud apps that own their data.

ELM is an attempt at that missing organisational layer, built local-first.

## Features

**Writing**
- Markdown editor with live preview (edit / preview / split)
- `[[wikilinks]]` with autocomplete, backlinks and unlinked mentions
- `==highlight==`, task checkboxes you can tick in the preview (writes back
  to the file), callouts, transclusion
- Entity templates (character / faction / place / event / chapter / plan)

**Organising**
- Real folders on disk, tags, pinning
- Typed relationships — any frontmatter key holding a `[[link]]` is a
  relationship, and the key *is* the type
- Query blocks and task rollup — live lists built from your own notes
- Graph view of links and typed relationships, grouped into one labelled
  island per folder, with a legend that jumps to an island
- Daily notes

**Finding**
- Full-text search across notes
- Files mode — search inside loaded PDFs, DOCX, XLSX and text files
- Command palette (`Ctrl+K`) for jump-to-note and quick create

**Getting data out**
- Export a note as markdown or standalone HTML
- Present mode (slides) from a single note
- **Publish** a folder or the whole vault as a linked static site, with
  working cross-links and deduplicated assets
- Full JSON backup and restore

**Sync**
- Bring your own — works with Syncthing, or any folder-sync tool
- Sync-conflict files are surfaced rather than silently mixed into your notes

## Platforms

| Platform | Status |
|---|---|
| Web / PWA | **Build it yourself from this repo** — installable, works offline |
| Windows | Builds and runs (Tauri) |
| Linux | Builds and runs (`.deb`, `.rpm`, `.AppImage` — Tauri) |
| Android | Builds and runs (Tauri) |
| macOS | Not built yet — needs a Mac + Xcode |
| iOS | Not started — a real port, not a rebuild; see Roadmap |

All of these ship from the same `index.html` as the frontend. **Only the web
version is buildable from what's in this repository.** Windows, Linux and
Android all work, but through a separate Tauri wrapper project (Rust +,
for Android, a Kotlin/Gradle project) that isn't published here yet — see
Roadmap. Until it is, those three are available as prebuilt binaries via
[Releases](https://github.com/player11en/ELM/releases) rather than something you can compile yourself.

## Running it

**Web** — the only platform you can build from this repo directly. Serve the
folder over HTTP and open `index.html`:

```bash
# any static server works
npx http-server .
```

Opening via `file://` mostly works, but a served origin is recommended — the
service worker (offline support, installability) needs a secure context:
HTTPS, or `http://localhost` while developing. Any other plain `http://`
origin, or `file://`, will run the app fine but silently skip service-worker
registration.

**Windows / Linux / Android** — get a prebuilt binary from
[Releases](https://github.com/player11en/ELM/releases) for now. The Tauri wrapper that builds these isn't
part of this repository yet (see Roadmap for why and what's blocking it).

## Architecture

The entire app is one `index.html` — HTML, CSS and JavaScript together, with
third-party libraries vendored in `vendor/`.

**There is no build step.** Editing `index.html` and reloading is the whole
development loop, and the same file is what runs on every platform —
desktop, Android, and this web build.

This is deliberate, and it is also the main open question for contribution at
scale — splitting into plain `<script src>` files works without a bundler
(external CSS and multiple classic scripts were both verified to work; the
codebase already relies on global functions), it's just not needed at that
scale yet. See the Roadmap.

One small, targeted exception exists already: `js/lib/pathUtils.js` holds a
handful of pure logic functions (path/title/regex utilities), pulled out
specifically so they're unit-testable via plain `require()` — same
global-scope `<script src>` loading as everything else, zero behavior
change, just enough of a split to let `node:test` reach them directly. See
Testing below.

## Testing

Two layers, both under `npm test`:

- **Unit tests** (`tests/unit/`) — Node's built-in `node:test`, zero extra
  dependencies. Covers the pure logic in `js/lib/pathUtils.js`.
- **End-to-end tests** (`tests/e2e/`) — `@playwright/test`, driving a real
  headless browser against the actual app. Covers core note flows, the
  storage adapter, attachments, the file viewer, the PWA/offline path,
  export/import, static-site publishing, and an XSS regression audit.

```bash
cd tests
npm install
npm test              # both layers
npm run test:unit      # just the fast one
npm run test:e2e       # just Playwright
```

`package.json`/`node_modules` live under `tests/`, not the repo root — Tauri's
`frontendDist` (the Tauri wrapper's setting, not anything in this repo)
points at this whole repo as the app's web assets, and hard-refuses to
build if `node_modules` sits directly in that folder. One level deeper is
invisible to that check, and Node's own module resolution still finds
`tests/node_modules` from anything under `tests/**`.

CI (`.github/workflows/test.yml`) runs both on every push and PR.

A third, separate suite lives in `tests/manual-device/` — real Tauri
desktop/Android builds driven over CDP, run by hand, not in CI. See its own
README for why and how.

## Roadmap

Open work, grouped by *track* and ordered by *release lane*. Not promises, no
dates, and PRs against any of it are welcome. Done items move to "Shipped"
at the bottom; the rest of this section is deliberately written so that each
item can be picked up on its own without breaking the others.

### How we add things without breaking the app

These rules are why the app has stayed one file with no build step and still
has a green test suite. New work follows them, or says why not.

1. **Files stay the truth.** A note is plain markdown, byte-faithful. A
   feature may *view* or *index* it; it may not rewrite a note into a shape
   the user didn't type. This is why in-place editing of the rendered HTML
   (contenteditable, the Notion/Confluence way) is rejected — see the editor
   track below.
2. **Views over data, not new storage.** Trash, the note tree, version
   history, the graph and (next) Kanban all read data that already exists
   (folders, frontmatter, `.trash/`, `.stversions/`). New storage formats are
   the expensive, irreversible kind of change; avoid them.
3. **One seam at a time.** Before replacing a core subsystem (the editor,
   storage), put an adapter in front of it — the way `vaultAdapter` fronts the
   file system — and ship that refactor *alone*, with every existing test
   passing unchanged. Only then swap the engine behind the seam.
4. **Same shape for every view.** Pure logic goes in `js/lib/` (unit-tested
   with `node:test`), the renderer/modal goes in `index.html`, and a
   Playwright spec drives it. Trash, tree and history already follow this.
5. **Risky means flagged.** Anything that changes how writing feels (live
   preview) or how files are stored (encryption) ships behind a setting,
   default off, until real use says it's safe to flip.
6. **Test gate.** Every item lands with a spec. A bug gets a failing test
   first. The full suite (`npm test` in `tests/`) is green before a commit
   goes to `main`, and again before a release build.
7. **Check all the surfaces.** Each feature is checked at phone width
   (≤780px, Android) and in both storage modes, or explicitly marked
   "files mode only" in its UI (Trash, tree and history already are).
8. **Vendoring has a fixed checklist.** New library → file in `vendor/`,
   license text in `vendor/LICENSES/`, row in the README table, entry in
   `sw.js` PRECACHE, service-worker cache version bumped.
9. **Release checklist.** Version bumped in `index.html` (`APP_VERSION`),
   `tauri.conf.json`, `package.json` and `Cargo.toml` (a spec checks the
   first two agree) → full tests → builds → Android signing fingerprint
   verified → commit → tag `vX.Y.Z` → GitHub Release.

### Release lanes

Direction, not a schedule. Each lane is shippable on its own.

**Next (1.2) — make writing better, safely**
- [ ] **E0 · Editor adapter** — no behavior change (see Editor track)
- [ ] **E1 · Editor quick wins** on the existing textarea (see Editor track)
- [ ] **V0 · `setProperty` helper** — one tested function that reads and
      writes a single frontmatter field. A prerequisite for the next two
      items; not user-visible by itself
- [ ] **V1 · Note properties badge** (below)
- [ ] **P0 · Release automation** (see Platform track)

**Then (1.3) — structure**
- [ ] **V2 · Kanban and table views** over properties (below)
- [ ] **E1b · Math and diagrams** in the preview
- [ ] **P1 · Linux build in CI**, so Linux no longer depends on a machine
      someone can test on

**Then (1.4) — the big one**
- [ ] **E2 · Live preview editor**, behind a setting, default off

**After that**
- Encryption, multi-vault, iOS/macOS, plugin API, alias presets. All
  deferred on purpose; see "Deferred" for the reasoning, which is kept.

### Editor track

Today: a textarea with Edit / Preview / Split. Content support is wide
(GFM tables, task checkboxes, highlighted code, callouts, `==highlight==`,
transclusion, wikilinks with autocomplete) and the split preview updates as
you type. What's missing is the *typing experience*: no single-pane live
rendering, no table insert/edit, no math, no diagrams, no `/` menu. On a phone
the missing live preview hurts most — Split is unusable at that width, so
writing means flipping Edit ↔ Preview.

- [ ] **E0 · Editor adapter (refactor only).** Route every direct use of
      `editorTextarea` (26 references, plus ~22 selection/cursor calls) through
      one small surface: get/set value, get/replace selection, focus, change
      event, insert-at-cursor, scroll position. Ship with zero visible change.
      *Done when* the whole existing suite passes untouched and
      `grep editorTextarea` hits only the adapter. This is the item that makes
      everything below cheap and safe — and it's valuable even if live preview
      is never built (it also unlocks testing editing logic without a DOM).
- [ ] **E1 · Quick wins on the current textarea.** Each is independent:
      - table helper: insert a table, and re-align the pipes of the table
        under the cursor (text only — no hidden state)
      - list continuation: Enter in a list continues it; Enter on an empty
        item ends it; Tab / Shift-Tab indent
      - click a block in the preview → jump the editor to that source line;
        scroll-sync in Split
      - `/` insert menu for the toolbar's Insert actions
- [ ] **E1b · Math and diagrams.** KaTeX and Mermaid, loaded **lazily** (only
      when a note actually contains `$…$` or a `mermaid` fence) so ordinary
      notes pay nothing. Both go through the existing DOMPurify path; Mermaid
      runs in its strict security level. Vendoring checklist applies.
- [ ] **E2 · Live preview (CodeMirror 6, Obsidian-style).** The text stays
      the source of truth. Syntax marks are hidden on lines the cursor isn't
      on, and tables, images, checkboxes and callouts render as widgets;
      nothing is ever converted back from HTML, so a saved file is exactly
      what was typed. Plain Edit / Preview / Split remain available.
      *Decision recorded:* editable rendered HTML (contenteditable) is **not**
      the plan. Converting HTML back to markdown is lossy for exactly the
      syntax that makes ELM files portable (wikilinks, callouts,
      transclusion, query blocks, alignment HTML, `==highlight==`) and would
      silently rewrite users' files. Confluence's "markdown" is an import
      step on its own document format, which is the opposite of this
      project's pitch.
      Honest costs to plan for:
      - CodeMirror 6 ships as ES modules, but there is no build step. It gets
        vendored as **one prebuilt file** produced once, outside the app tree,
        and committed like `vis-network` — a vendor build, not an app build.
      - Android keyboards/IME and large notes are the realistic failure
        points; both need real-device checks, not just headless ones.
      - Wikilink autocomplete, the toolbar, version-history restore and
        find all have to speak to the new editor — which is exactly what E0
        pays for in advance.
      *Gate:* behind a setting, default off; a parity spec runs the editing
      specs against both engines; flip the default only after real use.

### Views track

- [ ] **V0 · `setProperty(noteId, key, value)`** — read one frontmatter
      field, write it back through the normal save path (so the mtime/conflict
      checks still apply), preserving every other key and the body. Unit-test
      the parsing/serialising half in `js/lib/`.
- [ ] **V1 · Note properties badge** — a compact strip at the top of a note
      showing key frontmatter fields (status, tags, relationships). Display
      only; frontmatter is already parsed and rendered. (Comparing against
      Confluence: most of what it does well — spaces, labels, macros, page
      history — ELM has a leaner version of, or the idea doesn't fit
      local-first: watchers and notifications need a server, and real-time
      inline comments need that or an offline-merge model, neither of which
      fits a solo/small-team-via-file-sync tool.)
- [ ] **V2 · Kanban and table views** — views, not a new subsystem. Columns
      (or table rows) come from one frontmatter field such as `status:`; a
      card drag calls `setProperty` and saves. Reuses query-block
      infrastructure. Start with sort-by-date inside a column — no persisted
      per-column order, so no new ordinal field. A table view (sort/filter by
      property) shares the same query and `setProperty` code.
- [ ] **V3 · Images and PDFs as first-class objects**, not attachments
      hanging off a note.
- [ ] **V4 · Timeline / temporal view.**

### Data and trust track

- [ ] **T0 · Own snapshots for non-Syncthing users.** Version history today
      only surfaces Syncthing's `.stversions/`. A lightweight local snapshot
      store would give everyone else the same diff/restore. A real new
      storage mechanism, so it follows rule 2's caution: design first.
- [ ] **T1 · Multi-vault quick-switch** — every comparable app (Obsidian,
      Logseq, Joplin) has one; ELM doesn't.
- [ ] **T2 · Per-note/folder encryption** — see Deferred for the design notes.
- [ ] **T3 · Conflict compare and resolve.** Today a Syncthing
      `.sync-conflict-…` file is only *listed* under "Sync Conflicts"; the user
      has to compare and merge by hand. Add a "Compare" action that opens the
      conflict copy against the live note in the existing diff modal (the one
      built for version history) with "Keep mine", "Keep theirs" and "Keep
      both" (the last saves the other copy as a normal note). Conflict copies
      go to `.trash/` rather than being deleted outright. Small, and it reuses
      what exists, but its real weight comes later: any sync ELM ever provides
      itself must have this resolver first — see "Own sync" under Deferred.
- [ ] **T4 · Own sync (design only, not scheduled)** — see Deferred.

### Platform and delivery track

- [ ] **P0 · Release automation.** A GitHub Actions workflow on a version
      tag that builds the Windows installer and attaches it to the Release.
      Android needs the signing key as a CI secret — decide that deliberately
      rather than rushing it. Replaces today's by-hand release checklist.
- [ ] **P1 · Linux build in CI** (`.deb`/AppImage/`.rpm` from an Ubuntu
      runner). The current Linux packages are 1.0.0 and untested on a real
      machine; CI at least proves they build, and a smoke run can launch them.
- [ ] **P2 · Publish the Tauri wrapper** (Windows/Linux/Android project) so
      those platforms are self-buildable. Blocked on separating the Android
      release-signing keystore from that project first — it currently lives
      inside it and must never become public.
- [ ] **P3 · macOS build** (Tauri supports it; needs a Mac and Xcode to build
      and sign).
- [ ] **P4 · iOS build** — a real port, not a checkbox: the storage layer
      assumes real paths on disk, which iOS's sandbox doesn't give you.
      Similar scope to the Android SAF work already done.

### Quality track

- [ ] **Q0 · `CONTRIBUTING.md`** — how to build, where the code lives, the
      rules above, PR expectations.
- [ ] **Q1 · Large-vault check.** Generate a vault of several thousand notes
      and measure open, search and graph. Not yet measured; do it before
      claiming scale, and keep the numbers in the repo.
- [ ] **Q2 · Accessibility pass** — keyboard-only use of the new modals
      (Trash, tree, history), focus handling, contrast in both themes. Not
      yet audited.
- [ ] **Q3 · Split `index.html` into several `<script src>` files** once
      concurrent contribution is actually a friction (verified feasible
      without a bundler — see git history for the analysis). Natural moment:
      alongside E2, as `js/editor/`.

### Deferred (on purpose)

Kept here with their reasoning so the decision doesn't get re-argued from
scratch — and so it's clear what would have to change to pick them up.

- [ ] Own sync (T4) — ELM relies on the user's file sync (Syncthing, Dropbox,
      etc.) and deliberately ships none, which is why vaults stay plain
      files with no account and no server. Providing sync would change
      that, so it is deferred until there is a reason strong enough to
      outweigh it. If it is ever picked up, in this order:
      - **Prerequisites first:** the conflict resolver (T3), and a decision
        on encryption (T2) — a sync server that can read notes contradicts
        the privacy pitch, so end-to-end encryption would have to land with
        it, not after.
      - **Prefer syncing files over inventing a protocol:** e.g. WebDAV or
        an S3-style bucket the user owns, using the same plain files. No
        ELM-hosted service.
      - **Conflicts are the hard part, not transport.** Last-writer-wins
        loses text; the diff/keep-mine/keep-theirs resolver is the minimum,
        and per-note merge only for notes that diverged.

- [ ] Alias/shorthand presets (`;/name` → expands) — not just a URL
      shortener; the stronger case is naming: set `;/main` once for a
      character/place, reuse it everywhere instead of retyping (and
      mistyping) a full name. Real design fork depending on what's
      aliased, not one mechanism for both:
      - **Naming** (character/place/faction — ties into entity templates
        already built) — expand-on-type, not render-time: typing `;/main`
        + Tab/Enter replaces it there and then with the real
        `[[Full Character Name]]` text, same UI mechanism the existing
        `[[` wikilink autocomplete already uses. Resolving to a real
        wikilink rather than plain text is the actual point — it means
        backlinks, graph view and unlinked-mention detection all pick it
        up for free, for the price of an alias lookup instead of a typo.
        Keeps the file clean and portable afterward (no raw `;/...` syntax
        left sitting in an exported or Obsidian-opened copy).
      - **URLs / vault-internal paths** — render-time expansion instead
        (raw `;/name/rest` stays in the file, resolved only at display
        time), which is arguably better here: change the alias once,
        every note using it updates automatically. `;/acme` = an alias for
        a deeply-nested folder path, so `;/acme/Kickoff` resolves as a
        wikilink into `Work/Clients/Acme Corp/2026/Meetings/Kickoff`
        without retyping that path — the one genuinely ELM-specific
        version of this idea; a plain URL shortener is a commodity problem
        already solved elsewhere.
      - Both share one fail-closed rule: `;/name` only ever does anything
        if `name` is a registered preset, otherwise it's inert plain text
        — same principle as an unresolved wikilink, so an accidental
        `;/word` in ordinary prose is harmless. `;` isn't claimed by any
        existing syntax in this app, confirmed.
      - **Storage: folder-scoped, nearest-ancestor wins, not one global
        file.** A flat global registry breaks the moment there are two
        projects in one vault — `;/main` needs to mean a different person
        in "Book A" than in "Book B." An alias file at a folder's root
        applies to everything under it (subfolders included), same
        cascading idea as `.gitignore`/`.editorconfig`; a vault-root file
        can still hold truly global ones (own signature, a URL used
        everywhere), with the more specific folder winning on conflict.
      - Deferred like the plugin API and encryption: real, non-trivial
        scope (a presets UI, autocomplete, the render extension, cascading
        lookup) for a currently-hypothetical pain point — worth building
        once there's an actual recurring case driving it, not speculatively
- [ ] Per-note/folder encryption — deferred, not because it's a bad idea but
      because it's real, costly work competing against higher-value items.
      Design notes for whenever it's picked up:
      - **Only real cryptography counts.** `crypto.subtle` (Web Crypto API,
        native in every browser and in the Tauri webview, zero new
        dependencies) with AES-GCM and a password-derived key via PBKDF2.
        A classical cipher (XOR, Vigenère, anything hand-rolled) is not a
        weaker version of this — it's broken outright, in seconds, with
        widely available tools, and markdown's predictable structure
        (repeated words, YAML keys, common English) makes it easier to
        break, not harder. Shipping one would be worse than shipping
        nothing: it tells a user their notes are protected when they
        aren't.
      - Local-first narrows the threat model, it doesn't remove the reason
        to want this: a plaintext vault synced by Syncthing can still end
        up mirrored into a cloud backup folder (OneDrive/Dropbox/etc.) by
        the user's own separate habits, or exposed by device theft or a
        shared machine.
      - Real cost, unavoidable either way: an encrypted note stops being a
        plain, portable, Obsidian-openable markdown file (the project's
        core pitch), and MiniSearch's full-text index only works on
        plaintext — an encrypted note either drops out of search entirely
        or the key has to be re-derived and decrypted into memory each
        session just to keep searching working. Opt-in, per-note or
        per-folder, is the only shape that keeps this from compromising the
        rest of the vault.
- [ ] Plugin/extension API — only once real, repeated demand shows up;
      building it speculatively is the mistake this item exists to avoid.
      Design notes for whenever that demand shows up:
      - The single-global-scope architecture genuinely helps here — a
        plugin `<script>` can call ELM's existing internal functions
        directly, no bundler, no `postMessage` bridge across an iframe.
        That part really is easier than in a modularized app.
      - That is not the hard part, though. Three real problems still need
        solving first: (1) today's internal functions (`openNote`,
        `saveNote`, `vaultAdapter`, …) were never designed as a stable
        contract — a real plugin API means wrapping them behind a
        documented, versioned surface, so an internal refactor doesn't
        break every plugin; (2) shared global scope means zero sandboxing
        — a plugin gets unrestricted vault + network access by default,
        a real trust problem for an app pitched on privacy (Obsidian has
        this same weakness, worth learning from rather than repeating
        uncritically); (3) no loading mechanism exists yet — a plugins
        folder convention, manifest format, enable/disable UI, all
        unbuilt.

### Shipped

Wikilinks, backlinks, graph view with folder islands, daily notes, full-text
and files-mode search, interactive task checkboxes, static-site publishing,
JSON export/import, `==highlight==` syntax, callouts, transclusion, entity
templates, query blocks, text alignment, a unit + e2e test suite running in CI
on every push and PR (see Testing below), note version history (Syncthing's
`.stversions/`: History tab with diff and restore), a Trash view with
restore, in-app subfolders (collapsible tree, recursive counts), a note tree
view over `parent:` properties, the app version in the sidebar footer, and
prebuilt Windows and Android downloads on GitHub Releases (Linux pending —
see P1).

## Third-party libraries

Vendored locally in `vendor/` — nothing is fetched from a CDN at runtime.
Each remains under its own license and copyright:

| Library | Purpose | License |
|---|---|---|
| marked | Markdown parsing | MIT |
| DOMPurify | HTML sanitising | Apache-2.0 / MPL-2.0 |
| highlight.js | Code syntax highlighting | BSD-3-Clause |
| MiniSearch | Full-text search | MIT |
| js-yaml | Frontmatter parsing | MIT |
| idb | IndexedDB wrapper | ISC |
| vis-network | Graph view | MIT / Apache-2.0 |
| fflate | Zip for site export | MIT |
| jsdiff | Note version-history diff | BSD-3-Clause |
| pdf.js | PDF reading | Apache-2.0 |
| mammoth | DOCX reading | BSD-2-Clause |
| SheetJS (xlsx) | Spreadsheet reading | Apache-2.0 |

Full license text for every one of these is in
[`vendor/LICENSES/`](vendor/LICENSES/). Several minified builds lost their
header during minification, so that directory is the authoritative notice —
keep it with any copy or fork.

## Status

Working and in daily use, but young. Expect rough edges, and expect
things to move.

## License

See `LICENSE`.
