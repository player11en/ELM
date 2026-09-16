# Third-party licenses

ELM vendors its dependencies in `vendor/` rather than fetching them from a CDN
at runtime. Vendoring means ELM **redistributes** these libraries, and every
license below requires that the original copyright and license notice travel
with the code.

Several of the vendored builds are minified with their headers stripped, so
the notice does not survive in the file itself. This directory holds the
authoritative text for each one, retrieved from the upstream project.

Nothing here applies to ELM's own code — that is MIT, see `../../LICENSE`.

## Index

| Library | Purpose in ELM | License | Text | Upstream |
|---|---|---|---|---|
| marked | Markdown parsing | MIT | `marked-MIT.txt` | github.com/markedjs/marked |
| DOMPurify | HTML sanitising | Apache-2.0 **or** MPL-2.0 | `DOMPurify-Apache-2.0-or-MPL-2.0.txt` | github.com/cure53/DOMPurify |
| highlight.js | Code syntax highlighting | BSD-3-Clause | `highlight.js-BSD-3-Clause.txt` | github.com/highlightjs/highlight.js |
| MiniSearch | Full-text search | MIT | `minisearch-MIT.txt` | github.com/lucaong/minisearch |
| js-yaml | Frontmatter parsing | MIT | `js-yaml-MIT.txt` | github.com/nodeca/js-yaml |
| idb | IndexedDB wrapper | ISC | `idb-ISC.txt` | github.com/jakearchibald/idb |
| vis-network | Graph view | MIT **or** Apache-2.0 | `vis-network-MIT.txt`, `vis-network-Apache-2.0.txt` | github.com/visjs/vis-network |
| fflate | Zip for site export | MIT | `fflate-MIT.txt` | github.com/101arrowz/fflate |
| pdf.js | PDF reading | Apache-2.0 | `pdf.js-Apache-2.0.txt` | github.com/mozilla/pdf.js |
| mammoth | DOCX reading | BSD-2-Clause | `mammoth-BSD-2-Clause.txt` | github.com/mwilliamson/mammoth.js |
| SheetJS (xlsx) | Spreadsheet reading | Apache-2.0 | `sheetjs-Apache-2.0.txt` | github.com/SheetJS/sheetjs |

`vendor/pdf.worker.min.js` is part of pdf.js and is covered by the same entry.

## Notes

- **Dual-licensed libraries** (DOMPurify, vis-network) are offered under either
  license; both texts are included so you can rely on whichever you prefer.
- **Apache-2.0 NOTICE files** — §4(d) requires redistributing an upstream
  `NOTICE` file where one exists. Checked for pdf.js, SheetJS, DOMPurify and
  vis-network: none of them ship one, so there is nothing further to include.
- **Copyright notices still present in-file** — marked, js-yaml, highlight.js,
  pdf.js, DOMPurify, SheetJS and vis-network kept a header through
  minification. fflate, idb, mammoth and MiniSearch did not; for those, the
  text in this directory is the only notice, which is why it must stay with
  any copy or fork of ELM.

## Updating

When a vendored library is upgraded, re-download its license text as well —
copyright years and holders do change between releases.
