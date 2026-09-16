---
title: ELM — Strategy & Direction
type: strategy
tags: [meta, strategy, open-source, roadmap]
created: 2026-09-16
status: draft
---

# ELM — Strategy & Direction

Companion to `elm-status-and-fixes.md` (what is built) and the plan files
(how things get built). This one is about **what ELM is becoming and why** —
deliberately separate, because it's the layer that should change slowest.

---

## 1. Positioning

**ELM is an organisational layer for text, knowledge and AI material — an
IDE for thinking, not another notes app.**

That framing came out of a direct observation: developers have IDEs that give
them structure, navigation, cross-references, history and control over a
large body of material. People working with text, research, worldbuilding,
planning and AI output have **no equivalent**. They have documents in
folders, or cloud apps that own their data.

This matters because it decides what ELM competes with:

| Framing | Competes with | Assessment |
|---|---|---|
| "Notes app with plugins" | Obsidian, 10 years of ecosystem | Bad fight — ecosystem is their moat, not features |
| "Worldbuilding tool" | World Anvil, Campfire, LegendKeeper | Winnable on data ownership + price, niche ceiling |
| **"IDE for text & knowledge, local-first"** | **Nobody has taken this position** | **The actual opening** |

The third framing is also the one ELM's existing architecture already
supports, rather than something that requires rebuilding it.

### What ELM already has that is genuinely IDE-shaped

| IDE capability | ELM equivalent (built, working) |
|---|---|
| Project structure | Vault + nested folders on real disk |
| Cross-references | `[[wikilinks]]`, backlinks, unlinked mentions |
| "Where is this used?" | Backlinks + typed relationships (frontmatter-key-as-type) |
| Multiple views of one dataset | List, graph view, files mode, preview/split |
| Structured metadata | Frontmatter, entity templates, query blocks, task rollup |
| Project-wide search | MiniSearch full-text + files-mode content search |
| Build/export pipeline | Publish folder-or-vault as a linked static site |
| No lock-in | Plain markdown on disk, Obsidian-compatible |

### What's missing to actually deliver the IDE promise

1. **Versioning & history** — see §3, the highest-value gap.
2. **Non-text material as first-class objects** — images/PDFs are currently
   attachments hanging off a note, not things you can organise, relate and
   search in their own right.
3. **Timeline / temporal view** — deferred earlier, still unbuilt.
4. **Local LLM integration as a work surface**, not a chat bolted on the side.

---

## 2. The single-file architecture question

**This is about ELM's own source code, not about exports.** Exports (publish
site, HTML export) are a separate, finished feature.

Today the entire app — HTML, CSS, JavaScript — is one `index.html` of
~9,000 lines.

**Why it was built that way, and why it's genuinely good:**
- No build step, no bundler, no `npm install` to run the app
- Web, desktop (Tauri) and Android all ship from the same single file
- Every feature built lands on all three platforms with zero porting work —
  repeatedly proven across this project's history

**Why it becomes a liability the moment other people contribute:**
- Concurrent work means everyone edits the same file → constant merge conflicts
- Pull requests are hard to review inside a 9,000-line diff surface
- No module boundaries to orient a newcomer ("where does search live?")
- Per-area tooling (linting, ownership, focused tests) has nothing to attach to

### Verified: splitting does NOT require a bundler

Tested rather than assumed:

- **CSS** — external `<link rel="stylesheet">` works, and critically
  `extractExportCSS()` (which reads `document.styleSheets` live to build
  export styling) **still captures external rules and `:root` tokens
  correctly**, confirmed empirically. Splitting CSS out does not break
  export/publish.
- **JS via multiple `<script src>` tags** — works with essentially no code
  changes. The codebase already relies on global functions and globals, and
  multiple classic scripts share one global scope exactly as one big block
  does. Load order is the only constraint, and function declarations hoist.
- **JS via ES modules** — also bundler-free, but requires rewriting all
  ~9,000 lines into explicit `import`/`export`, and ES modules don't load
  over `file://`. Much larger change for benefit that only materialises with
  real contributor volume.

**Recommendation:** if/when the project opens up, split into plain
`<script src>` files first — roughly 90% of the collaboration benefit for
roughly 5% of the effort, and it preserves the no-build-step property. Treat
ES modules as a later step, justified only by actual contributor growth.

**Decision status: deferred deliberately.** Revisit when open-sourcing is
actually imminent, not before.

---

## 3. Versioning & history — the highest-value missing piece

A writer wants exactly what a developer has: *go back to how this was last
week, and show me what changed.* No mainstream notes tool does this well
without either a cloud service or the user manually running git.

**Foundation that already exists in the vault:**
- `.trash/` — deleted notes retained (now with 30-day purge)
- `.sync-conflict-*` files — surfaced in their own sidebar section
- `.stversions/` — Syncthing's own file-versioning folder, already present
  in real vaults and currently ignored by ELM

That last one is notable: for Syncthing users, *previous versions are already
being written to disk today* — ELM simply doesn't read or present them.

**Design directions, roughly in order of cost:**

1. **Surface what already exists** — read `.stversions/`, show prior versions
   of the open note, allow diff and restore. Cheapest path to real value, and
   no new storage mechanism invented.
2. **Own snapshot history** — periodic/on-save snapshots into a vault-local
   history folder, independent of whether Syncthing is in use.
3. **Git-backed** — maximum power (branches, real diffs, remotes), but
   imposes a dependency and a mental model most writers don't want. Probably
   the wrong default, possibly a power-user option.

**Diff UI is the real feature**, not storage. Two versions side by side with
changes highlighted — the thing writers currently do by keeping
`draft-v2-FINAL-final.md` files.

---

## 4. Open source

**Not blocked on the plugin question.** Earlier reasoning against building a
plugin system assumed a single-user tool, where an extension API would be
infrastructure nobody populates. Open-sourcing changes that calculus — but
only if a community actually materialises, which open-sourcing does not
guarantee on its own.

**Sequencing that avoids the trap:**
1. Open the source, keep the architecture as-is initially
2. See whether contributors and users actually appear
3. Split the source files when concurrent contribution becomes a real friction
4. Build an extension API only against real, repeated requests from real users

Building the extension surface *before* demand exists repeats exactly the
mistake the plugin-system analysis warned about, just with an open-source
label on it.

---

## 5. LLM integration

The differentiated version is **not** a chat panel. It's: a local-first,
plain-markdown knowledge base with structure (folders, links, typed
relationships, frontmatter) that a model can read and write *without the data
leaving the device*.

Connects to a separately-evaluated finding: Tauri's Rust backend already runs
as a real native process with unrestricted filesystem and threading access —
so linking local inference (e.g. `llama.cpp`) is an ordinary Rust dependency,
not an architectural fight. The WebView boundary only constrains the UI layer,
not the compute.

**Open question worth deciding before building:** is the LLM a *tool inside*
ELM (summarise this, find contradictions across these notes, draft from this
outline), or is ELM the *context layer* that other AI tooling reads from?
The second is a bigger idea and a much bigger scope.

---

## 6. Open decisions

| Decision | Status |
|---|---|
| Split source files | Deferred — verified feasible without a bundler, revisit at open-source time |
| Extension/plugin API | Deferred — gate on real demand, not on open-sourcing |
| Versioning approach (Syncthing vs own snapshots vs git) | Undecided — §3 favours starting with `.stversions` |
| LLM as tool-inside vs context-layer-for-others | Undecided — affects scope significantly |
| Timeline view | Deferred, needs its own design pass |
| Images/PDFs as first-class objects | Not started |
