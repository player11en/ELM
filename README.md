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

| Platform | How |
|---|---|
| Web / PWA | Open `index.html` — installable, works offline |
| Windows | Tauri desktop build (`.exe` or `.msi`) |
| Android | Tauri Android build (APK) |

All three ship from the same `index.html` — this repository contains that
shared frontend. The Tauri wrapper project is kept separately.

## Running it

**Web** — serve the folder over HTTP and open `index.html`:

```bash
# any static server works
npx http-server .
```

Opening via `file://` mostly works, but a served origin is recommended
(service worker and some browser APIs need it).

**Desktop / Android** — built with [Tauri](https://tauri.app), which wraps
this same `index.html` as the frontend. That project lives outside this
repository for now; it needs Rust, and Android additionally needs JDK 17 plus
the Android SDK and NDK.

## Architecture

The entire app is one `index.html` — HTML, CSS and JavaScript together, with
third-party libraries vendored in `vendor/`.

**There is no build step.** Editing `index.html` and reloading is the whole
development loop, and the same file is what runs on desktop and Android.

This is deliberate, and it is also the main open question for contribution at
scale — splitting into plain `<script src>` files works without a bundler
(external CSS and multiple classic scripts were both verified to work; the
codebase already relies on global functions), it's just not needed yet. See
the Roadmap.

## Roadmap

Open, roughly in the order they'll get picked up. Not promises, and PRs
against any of these are welcome.

- [ ] Note version history — surface Syncthing's `.stversions/` first (diff +
      restore), before inventing a separate storage mechanism
- [ ] Images and PDFs as first-class objects, not just attachments hanging
      off a note
- [ ] Timeline / temporal view
- [ ] macOS build (Tauri already supports it; needs a Mac + Xcode to build
      and sign)
- [ ] iOS build — real port, not a checkbox: the storage layer assumes real
      paths on disk, which iOS's sandbox doesn't give you. Similar scope to
      the Android SAF work already done
- [ ] `CONTRIBUTING.md` — how to build, where the code lives, PR expectations
- [ ] Split `index.html` into multiple `<script src>` files once concurrent
      contribution is actually a friction (verified feasible without a
      bundler — see git history for the analysis if it comes back)
- [ ] Plugin/extension API — only once real, repeated demand shows up;
      building it speculatively is the mistake this item exists to avoid

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
