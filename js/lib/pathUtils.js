// Pure path/title/regex utilities, extracted out of index.html so they're
// unit-testable via plain `require()` (see tests/unit/pathUtils.test.js).
//
// This file is loaded by index.html via a plain <script src> tag, BEFORE the
// main inline <script> block — in the browser these are ordinary top-level
// `function`/`const` declarations that attach to the global scope exactly as
// they did when they lived inline; nothing about how the app calls them
// changes. The `module.exports` guard at the bottom only fires under Node
// (`typeof module !== 'undefined'`), so it's a no-op in every browser/webview
// this app ships to. Same dual-environment pattern pre-ES-module
// Lodash/Underscore used for years to support both <script> tags and
// CommonJS `require()` from one file.
//
// IMPORTANT: these were MOVED here, not copied — do not leave a duplicate
// definition inline in index.html. Classic (non-module) <script> tags share
// one global lexical scope, and a duplicate top-level `const` across two
// <script> tags throws `SyntaxError: Identifier has already been declared`.

// ── Vault Storage Adapter (Phase 1b) ────────────────────────────────────────
// Every FileSystemDirectoryHandle/FileSystemFileHandle stays inside the
// adapter section of index.html. Nothing outside it should touch the File
// System Access API directly — this boundary is what makes future
// Capacitor/Electron storage ports mechanical (see note-app-master-plan.md,
// Phase 1b). These two constants are its reserved-name tables.
const RESERVED_DIR_NAMES = new Set(['attachments', '.trash']);
const WINDOWS_RESERVED_NAMES = new Set([
  'con','prn','aux','nul','com1','com2','com3','com4','com5','com6','com7','com8','com9',
  'lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9'
]);

function sanitizePathSegment(name) {
  // Central path-safety chokepoint (plan §HARD-3). Folder names are user input
  // with no prior stripping (createFolder only trims) — this is the only place
  // trusted to make a single path segment disk-safe. Strips separators/
  // traversal, Windows-illegal characters, reserved device names, reserved
  // vault directory names, and leading/trailing dots/spaces (invalid or
  // hidden on Windows).
  let s = String(name || '').trim();
  s = s.replace(/[\/\\]/g, '-');
  s = s.replace(/\.\.+/g, '.');
  s = s.replace(/[<>:"|?*\x00-\x1f]/g, '');
  // Truncate *before* trimming dots/spaces — slicing a long name can otherwise
  // land on a '.' or ' ' and re-create the exact trailing character just
  // stripped, which Windows rejects.
  s = s.slice(0, 100);
  s = s.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (!s) return 'item-' + Date.now().toString(36);
  // A folder that sanitizes to a reserved name would be created on disk but
  // then filtered out of every listing — invisible, with its notes stranded.
  if (WINDOWS_RESERVED_NAMES.has(s.toLowerCase()) || RESERVED_DIR_NAMES.has(s.toLowerCase())) s += '_';
  return s;
}

function slugifyTitle(title) {
  let s = String(title || '').toLowerCase().trim();
  s = s.replace(/[^\w\s-]/g, '');
  s = s.replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  s = sanitizePathSegment(s);
  return s || 'untitled';
}

function splitPath(path) {
  const parts = path.split('/').filter(Boolean);
  return { dirParts: parts.slice(0, -1), name: parts[parts.length - 1] };
}

// title/link-index normalization — deliberately NOT slugifyTitle, which
// strips non-word characters and would collide "Foo & Bar" with "Foo Bar".
function titleKey(title) { return (title || '').trim().toLowerCase(); }

function resolveRelativeVaultPath(noteDirPrefix, target) {
  const combined = (noteDirPrefix + target).split('/');
  const out = [];
  for (const seg of combined) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// Syncthing's real conflict-file naming convention:
// <name>.sync-conflict-YYYYMMDD-HHMMSS-<deviceID short>.<ext> — matched
// specifically to this shape, not just any filename containing the word
// "conflict", so a note someone deliberately titled that way is never
// miscategorized (see plan §HARD-1, sync-robustness plan).
const SYNC_CONFLICT_RE = /\.sync-conflict-\d{8}-\d{6}-[a-z0-9]+\.md$/i;

// Trash file names: `<ISO stamp, ':' and '.' -> '-'>__<encodeURIComponent(origin path)>`.
// Encoding the whole vault path (not just the leaf) is what lets the Trash
// view put a note back where it came from. Names over the filesystem limit
// fall back to the leaf alone (restores to the vault root). Entries written
// before this existed hold a bare leaf name and parse the same way.
const TRASH_STAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)__(.+)$/;
const TRASH_NAME_MAX = 200;

function buildTrashName(path, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const full = encodeURIComponent(path);
  const leaf = path.split('/').pop();
  const tail = (stamp.length + 2 + full.length <= TRASH_NAME_MAX) ? full : encodeURIComponent(leaf);
  return `${stamp}__${tail}`;
}

// -> { ts, path } or null when the name isn't one of ours.
function parseTrashName(name) {
  const m = name.match(TRASH_STAMP_RE);
  if (!m) return null;
  const ts = Date.parse(m[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'));
  if (Number.isNaN(ts)) return null;
  let path;
  try { path = decodeURIComponent(m[2]); } catch { path = m[2]; }
  return { ts, path };
}

// Syncthing file versioning: a changed file's old copy is kept as
// <name>~YYYYMMDD-HHMMSS.<ext> (tag in LOCAL time) under .stversions/.
function buildStversionRegex(name) {
  const m = name.match(/^(.*)\.md$/i);
  if (!m) return null;
  return new RegExp(`^${escapeRegex(m[1])}~(\\d{8}-\\d{6})\\.md$`, 'i');
}

// "20260916-143022" -> epoch ms in the runtime's local zone, or null.
function parseStversionTag(tag) {
  const m = tag.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RESERVED_DIR_NAMES,
    WINDOWS_RESERVED_NAMES,
    sanitizePathSegment,
    slugifyTitle,
    splitPath,
    titleKey,
    resolveRelativeVaultPath,
    escapeRegex,
    SYNC_CONFLICT_RE,
    buildTrashName,
    parseTrashName,
    buildStversionRegex,
    parseStversionTag,
  };
}
