---
title: Note App — Master Plan
type: plan
tags: [meta, spec]
created: 2026-08-04
updated: 2026-08-05
status: active
---

# Note App — Master Plan

A local-first markdown app for writing, lore-keeping, and connecting ideas across
multiple works. Personal tool. Single author. Desktop-first.

**Current state:** notebook layer built and working. Connector layer not started.
Storage model being flipped from IndexedDB-as-truth to files-as-truth (Phase 1b).

---

## 1. The Three Jobs

Every feature must serve one of these. If it doesn't, cut it.

| Job | What it means | Status |
|---|---|---|
| **Notebook** | Fast capture and editing. Plans, brainstorms, chapters, journal. | ✅ built |
| **Knowledge space** | Lore lives somewhere stable and structured enough to trust. | ⬜ not started |
| **Connector** | Links, backlinks and queries so the two can talk to each other. | ⬜ not started |

**The core problem being solved:** overview, find-again, and connect — across two
books, a side story, and game concepts that share one world. When the side story
changes a fact, I need to see *immediately* what else is now inconsistent.

The tool surfaces contradictions. **I** judge them. It does not decide canon.

---

## 2. Locked Decisions

- **Files are the atomic unit.** No blocks, no block IDs, no outliner model.
- **Disk is truth, IndexedDB is cache.** Anything in IndexedDB is derived and
  disposable. Eviction costs a reindex, never data.
- **One vault.** Root folder only. No vault manager.
- **Plain markdown + YAML frontmatter.** Obsidian-compatible at all times. This is
  the exit option and it stays open permanently.
- **No sync code.** Delegated to Syncthing (Phase 9).
- **No collaboration.** Ever. Single-author by design.
- **Chromium desktop only.** Firefox and Safari unsupported, by decision.
- **No build step.** Vanilla JS, CDN-loaded libs. Working well — keep it.
- **No graph view, no whiteboard files, no plugin system, no WebLLM.**

### Rejected, with reasons

| Rejected | Why |
|---|---|
| Block references | Needs injected `id::` in files or a full outliner. Both break prose writing and clean interop. |
| Global graph view | Unreadable past ~200 notes. Backlinks + queries serve the real need better. |
| Whiteboard / Canvas | Not markdown. Second file format, goes stale, dead file outside the app. |
| Multi-vault | Blocks cross-pollination between lore and plans, which is where ideas come from. |
| WebLLM in-browser generation | ~2GB download for a weak model. Ollama on localhost is better and nearly free. |
| Own sync protocol | Weeks of work to rebuild Syncthing, worse. |
| Firefox support | Would require a localhost helper daemon. Disproportionate for a browser I don't use. |
| Electron (for now) | ~180MB bundle, signing and auto-update pipeline, for benefits I don't currently need. |
| CodeMirror 6 | Assumes a bundler. The no-build-step approach is working; don't break it for this. |
| Stable `id:` in frontmatter | Indirection Obsidian won't understand. Rename the file, rewrite links instead. |

---

## 3. Platform & Browser Reality

**File System Access API** (`showDirectoryPicker()`) is what makes real-folder
access possible.

| Target | Real folder access | Notes |
|---|---|---|
| Chrome desktop | ✅ | |
| **Edge desktop** | ✅ | Chromium since 2020. Confirmed working. |
| Brave / Opera / Chromium | ✅ | |
| Firefox | ❌ | Not implemented, no timeline. |
| Safari desktop | ❌ | Not implemented. |
| Any mobile browser | ❌ | OS-level, not a browser choice. |

**PWA install changes nothing about API support.** Installing drops the browser
chrome. Same engine, same APIs. Install is cosmetic — worth doing, not a capability
path.

**IndexedDB is not the problem.** Firefox supports it fully. The gap is
specifically FSA — real files on real disk.

### Deployment targets

| Target | Path | Status |
|---|---|---|
| Desktop (now) | PWA + FSA in Edge/Chrome | ✅ working |
| Mobile (Phase 9) | Capacitor + `@capacitor/filesystem` | native bridge, bypasses webview limits |
| Desktop (only if needed) | Electron + Node `fs` | see triggers below |
| Desktop via Capacitor | — | not a real target, skip |

**Revisit Electron only if:** `.md` file-type association, a background tray for
quick-capture, or distribution to other people. The adapter interface makes that
port contained.

### CDN caution

No build step means the service worker precache list is load-bearing. A version
bump or CDN hiccup breaks the app on a cold cache. **Pin exact versions.** Vendor
the libs locally when convenient.

---

## 4. File Conventions

```yaml
---
title: Kaelen Vess
type: character          # character | faction | place | event | chapter | plan | note
tags: [ashfall, pov]
aliases: [the Grey Warden, Vess]
status: canon            # canon | draft | contested
pinned: false
date: 0412-03-17         # in-world date. Sortable strings only.
created: 2026-08-04T10:22:00Z
# typed relationships — values are links
enemy_of: [[Ashfall Compact]]
mentor_to: [[Sera Lynn]]
---
```

- Links: `[[Note Title]]` or `[[Note Title#Heading]]`
- Tasks: `- [ ]`
- Transclusion: `![[Note#Heading]]`
- Attachments: standard markdown, `![](../attachments/map-ashfall.png)`
- `modified` is **not** stored — it comes from file mtime
- Filename is slugified from title. Rename title → rename file → rewrite inbound
  links (Phase 4)

### Folder layout

```
/lore/          entities only — characters, factions, places, events
/book-1/        chapters, outline
/book-2/
/side-story/
/game/          mechanics, design docs
/journal/       daily capture
/attachments/   images, PDFs, files — real files, not base64
/.trash/        soft deletes
overview.md     hand-written spine + live query blocks
```

**Rule:** a fact is stated in exactly one place — its entity note in `/lore/`.
Chapters and design docs *link into* lore, never restate it.

---

## 5. Build Phases

### ✅ Phase 1 — Storage skeleton — PARTIAL

Done: FSA directory picker, handle persisted to IndexedDB, permission flow,
autosave to disk, storage quota check on boot.

Outstanding: model is inverted — see Phase 1b.

### ✅ Phase 2 — Editor loop — DONE (and beyond)

Markdown editor with Edit/Preview/Split. Toolbar (bold, italic, code, quote, h1–h3,
lists, hr, code block, link, callouts). Live preview via `marked` + `DOMPurify`.
Code copy button. Folders with colors, tags with chip cloud. Note list with sort,
pinning, search-match excerpts. Attachments with image lightbox and PDF thumbnails,
paste-to-insert, 25MB cap. Debounced autosave with status indicator. JSON
backup/restore. Keyboard shortcuts and shortcuts modal.

Also done ahead of schedule: light/dark theme, mobile-responsive layout, installable
PWA with offline service worker, `file://` protocol warning banner.

---

### ⬛ Phase 1b — STORAGE FLIP (next, ~3–5 days)

**The one blocking item.** Currently IndexedDB is truth and disk is a JSON backup.
That is backwards, and it costs three things the later phases depend on: Obsidian
interop (the exit option), Syncthing compatibility (Phase 9), and eviction safety —
right now eviction is data loss, not a reindex.

The hard part is already built (directory handle, permission flow, autosave). This
changes *what gets written*, not how.

**Mapping**

```
Note { title, body, folder, tags[], pinned, created, modified }
              ↓
/lore/kaelen-vess.md  with frontmatter + body
```

- Folder → real directory
- Tags, pinned, created → frontmatter
- `modified` → file mtime, stop storing it
- Filename → slugified title, handle collisions
- Attachments → real files in `/attachments/`, referenced as normal markdown

**One-time migration**

1. Prompt for vault folder
2. Write every note and attachment out
3. Verify counts match
4. Keep the IndexedDB copy for one release as a safety net, then clear
5. Keep the JSON export — still useful as a backup, just no longer primary

**Also in this phase**

- `navigator.storage.persist()` — the boot quota check is not the same thing
- Check mtime before save; the folder now has other writers
- Writes: temp file → rename. Deletes: move to `/.trash/`
- Demote IndexedDB to: search index, parsed metadata, `loadedFiles`, UI state, theme
- Keep `FileSystemFileHandle` objects strictly inside the storage adapter — this is
  what makes the Capacitor and Electron ports mechanical later

> **Test:** full browser restart, not just a tab refresh. Chrome and Edge differ in
> how aggressively they downgrade a stored permission from `granted` to `prompt`.

> **Done when:** the vault opens correctly in Obsidian, images and all.

---

### ⬜ Phase 3 — Index and search (3–4 days)

One parse pass over every file at startup: frontmatter, headings, outgoing links,
tasks, plain text. Held in memory — under a few thousand notes, persist nothing.

- MiniSearch (ESM from CDN, no build step needed)
- **Command palette (`Cmd+K`)** — one input that searches, opens, and creates

The palette is the highest-value component in the app. Give it real attention.

> **Done when:** any note reachable in under two seconds, no mouse.

---

### ⬜ Phase 4 — Links and backlinks (3–4 days)

**The first moment this stops being a notes app.**

- Wikilink parsing and resolution, including `#heading` anchors
- Clicking a link to a nonexistent note creates it
- Backlinks panel
- **Broken links view** — this is the lore backlog, not a bug list
- Link rewriting on note rename

> ### ⚑ CHECKPOINT — 30 day trial
> Use it as the only notes app for 30 days.
>
> **Continue if:** annoyed by missing features.
> **Stop if:** reaching for something else to take real notes.
>
> Either way the vault survives — it's just markdown.

---

### ⬜ Phase 5 — Structure (2–3 days)

- Outline sidebar from headings, click-to-jump, collapsible
- **Hover preview** — hover a wikilink, see the note in a popover without
  navigating. Best value-to-effort ratio in the project. Check a detail mid-sentence
  without leaving the sentence.
- Recent notes

(Tag browser already built.)

---

### ⬜ Phase 6 — Queries (3–5 days)

Fenced blocks rendering live lists from the index:

````
```query
type: character
faction: Ashfall Compact
sort: date
```
````

Exact property match, tag match, `links-to`, sort, limit. **Keep the language
dumb.** This phase pays for Phase 3 — rosters, open questions, timelines and
stale-note lists all fall out at once.

- **Table view** for results: columns from properties

---

### ⬜ Phase 7 — Lore layer (4–6 days)

The consistency engine. The phase that solves the actual problem.

- **Alias resolution** in link targets — one entity, many names
- **Unlinked mentions** — scan text for known titles/aliases not already linked.
  Closest thing to an automatic continuity checker.
- **Folder-grouped backlinks** — the "appears in" panel:
  ```
  Kaelen Vess
    book-1/      ch-03, ch-07, ch-11
    game/        companion-system
    side-story/  the-long-winter
  ```
  ~half a day on top of Phase 4. Doesn't exist as a built-in anywhere else.
- **Typed relationships** — reverse lookup by property name
- **Timeline** — query sorted by in-world `date`
- **Task rollup** — every `- [ ]` grouped by source note
- **Section transclusion** `![[Note#Heading]]`
- **Entity templates** — `type: character` prefills frontmatter and section
  skeleton. Biggest driver of consistent lore.
- **Property autocomplete + vocabulary lint** — flag values used once (typos:
  `Ashfall Compact` vs `The Compact`). Keeps queries trustworthy across four works.

**Retcons:** never delete superseded lore. Keep a `## Superseded` section with what
it was and which work changed it. `status: contested` while unresolved.

**overview.md:** prose spine by hand; query blocks for contested entities, open
questions, recently modified, entities in more than one work. Judgment mine,
bookkeeping automatic.

---

### ⬜ Phase 8 — Optional extras

- **Static HTML export** — render vault or query result to a linked site so someone
  can read the lore without the app. `marked` already does the rendering; wire it to
  write files. Read-only — a reader is not a second author.
- **Local graph, depth-limited** — this note + 1–2 hops, ~15 nodes, on demand, never
  saved as a file
- **Corkboard** — chapters as index cards from a `synopsis:` property
- **Git on the vault folder** — free, no code. Insurance for retcons.
- **Ollama at `localhost:11434`** — contradiction check over a query result. A layer
  on top of the index, never a dependency.
- **transformers.js embeddings** (~25–90MB, CPU) — "notes similar to this one"

---

### ⬜ Phase 9 — Multi-device sync (LAST)

Infrastructure, not a feature. Install once, forget.

**Syncthing.** Peer-to-peer, no cloud, no account, open source. Local WLAN when on
the same network (no internet needed), encrypted over the internet otherwise. Both
devices must run at the same time to transfer, but nothing is "always on" — changes
queue and catch up on the next overlap.

**Syncthing moves files at the OS level. It never touches IndexedDB.** Each device
rebuilds its own cache. Files are the only shared truth. No server, no auth, no
cross-device code in the app. **This only works because of Phase 1b.**

App must add:

1. **External change detection** — no file watcher in the browser. Reindex on window
   focus and startup; re-read before saving if mtime moved.
2. **Surface conflict files** — show `*.sync-conflict-*.md` instead of hiding them.

**Mobile scope: capture and read only.** Quick-append to today's note, search, view.
Not authoring. Keeps the Capacitor wrapper small.

---

## 6. Files Mode — decision needed

Currently: drag-drop txt/md/pdf/docx/xlsx/csv/json, parsed in-browser (`pdf.js`,
`mammoth`, SheetJS), full-text search with case/whole-word/regex, grouped
collapsible results, export, loaded list persisted.

Run it through the filter: does it serve notebook, knowledge space, or connector?
**Right now, no** — it's a separate tool sharing a shell, with no path from a search
result into the vault.

Two acceptable resolutions:

1. **Make it serve the lore layer** — add "create note from this match" or "cite
   this source in a note." Research material then connects to the knowledge space
   and it earns its place.
2. **Accept it as a second app I happen to like** — fine, but don't spend Phase 7
   budget on it.

**The trap:** a third option where it keeps getting investment because it's fun,
while wikilinks stay unbuilt.

---

## 7. Stack

| Concern | Choice |
|---|---|
| Language | Vanilla JS, no build step |
| Markdown render | `marked` + `DOMPurify` |
| IndexedDB wrapper | `idb` |
| File parsing (Files mode) | `pdf.js`, `mammoth`, SheetJS |
| Search | MiniSearch (Phase 3, ESM from CDN) |
| Storage (desktop) | File System Access API |
| Storage (mobile, later) | `@capacitor/filesystem` |
| Storage (Electron, if ever) | Node `fs` |
| Cache | IndexedDB — derived data only, after Phase 1b |
| Sync | Syncthing (external) |

Pin CDN versions. Don't write a markdown parser.

---

## 8. Order From Here

1. **Phase 1b — storage flip.** Blocking. Everything below depends on it.
2. **Phase 3 — index + command palette.** Parses the frontmatter 1b starts writing.
3. **Phase 4 — wikilinks + backlinks.** First real connector feature.
4. **Phases 5–7.** Structure, queries, lore layer.
5. **8–9** whenever, if ever.

Notebook is done. The remaining work is jobs 2 and 3 — which is where the original
problem actually lives.

---

## 9. The Filter

Before building anything not on this list:

1. Does it serve notebook, knowledge space, or connector?
2. Does it survive opening the vault in another app?
3. Would I still want it if I were the only user forever?

Three yeses, build it. Otherwise it's scope creep — which is how blocks, graph view,
multi-vault and whiteboards got cut.

---

## 10. Honest Positioning

Not a new idea. Obsidian + Dataview + Templater + Syncthing gets ~70% of this by
Friday. What's mine is the **selection** — a disciplined cut against features every
competitor ships because they serve thousands of workflows and I serve one.

Two things justify building rather than configuring:

1. Folder-grouped backlinks and vocabulary lint don't exist as clean built-ins
   anywhere. Faking them in Obsidian means writing plugin JS anyway.
2. A plugin stack is fragile. Obsidian updates break Templater; Dataview syntax
   shifts. Debugging someone else's ecosystem instead of my own query logic.

And now a third: **the notebook layer is already built and I like using it.**
