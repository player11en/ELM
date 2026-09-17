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
- Graph view of links and typed relationships
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
codebase already relies on global functions), it's just not needed yet. See
the Roadmap.

## Roadmap

Open, roughly in the order they'll get picked up. Not promises, and PRs
against any of these are welcome.

- [ ] Publish the Tauri wrapper (Windows/Linux/Android build project) so
      those platforms are self-buildable, not just downloadable. Blocked on
      separating out the Android release-signing keystore first — it
      currently lives inside that project and must never become public
- [ ] Attach prebuilt Windows/Linux/Android binaries to a GitHub Release
      (built and working; not yet published — web is shipping first)
- [ ] **Note version history (recommended next)** — surface Syncthing's
      `.stversions/` first (diff + restore), before inventing a separate
      storage mechanism. Picked over the plugin API deliberately: this
      benefits every existing user immediately, with no community/ecosystem
      prerequisite the way a plugin API would need
- [ ] Images and PDFs as first-class objects, not just attachments hanging
      off a note
- [ ] Timeline / temporal view
- [ ] macOS build (Tauri already supports it; needs a Mac + Xcode to build
      and sign)
- [ ] iOS build — real port, not a checkbox: the storage layer assumes real
      paths on disk, which iOS's sandbox doesn't give you. Similar scope to
      the Android SAF work already done
- [ ] `CONTRIBUTING.md` — how to build, where the code lives, PR expectations
- [ ] Multi-vault quick-switch — every comparable app (Obsidian, Logseq,
      Joplin) has one; ELM currently doesn't
- [ ] CI + a committed automated test suite — real regression coverage
      exists only as ad-hoc local scripts today, nothing runs on a PR
- [ ] Split `index.html` into multiple `<script src>` files once concurrent
      contribution is actually a friction (verified feasible without a
      bundler — see git history for the analysis if it comes back)
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

Shipped and not listed here: wikilinks, backlinks, graph view, daily notes,
full-text + files-mode search, interactive task checkboxes, static-site
publishing, JSON export/import, `==highlight==` syntax, callouts,
transclusion, entity templates, query blocks.

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
