const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizePathSegment,
  slugifyTitle,
  splitPath,
  titleKey,
  resolveRelativeVaultPath,
  escapeRegex,
  SYNC_CONFLICT_RE,
  RESERVED_DIR_NAMES,
  WINDOWS_RESERVED_NAMES,
} = require('../../js/lib/pathUtils.js');

test('sanitizePathSegment strips separators', () => {
  assert.strictEqual(sanitizePathSegment('a/b\\c'), 'a-b-c');
});

test('sanitizePathSegment collapses ".." into a single "." then strips it to empty, falling back', () => {
  // Traced step by step: '..' -> /\.\.+/ collapses runs of 2+ dots to one
  // '.' -> the leading/trailing dot-strip removes that single '.' -> empty
  // -> hits the same generated-name fallback as any other empty input.
  assert.match(sanitizePathSegment('..'), /^item-[a-z0-9]+$/);
});

test('sanitizePathSegment strips Windows-illegal characters and trims dots/spaces', () => {
  assert.strictEqual(sanitizePathSegment('a<b>c:d"e|f?g*h'), 'abcdefgh');
  assert.strictEqual(sanitizePathSegment('  ...leading trailing...  '), 'leading trailing');
});

test('sanitizePathSegment appends _ to reserved names, case-insensitively', () => {
  assert.strictEqual(sanitizePathSegment('CON'), 'CON_');
  assert.strictEqual(sanitizePathSegment('nul'), 'nul_');
  assert.strictEqual(sanitizePathSegment('Attachments'), 'Attachments_');
});

test('sanitizePathSegment strips a leading dot BEFORE the reserved-name check', () => {
  // Real, slightly surprising behavior, traced step by step: the dot-strip
  // step runs before the reserved-name check, so by the time '.trash' is
  // tested against RESERVED_DIR_NAMES (which holds the literal '.trash',
  // dot included), the leading dot is already gone — 'trash' never matches
  // '.trash', so this does NOT get the reserved-name '_' suffix. Documented
  // here as actual behavior, not asserting it's the intended design.
  assert.strictEqual(sanitizePathSegment('.trash'), 'trash');
});

test('sanitizePathSegment falls back to a generated name when input sanitizes empty', () => {
  const result = sanitizePathSegment('...');
  assert.match(result, /^item-[a-z0-9]+$/);
});

test('slugifyTitle lowercases, hyphenates, and strips punctuation', () => {
  assert.strictEqual(slugifyTitle('My Great Note!'), 'my-great-note');
  assert.strictEqual(slugifyTitle('  Multiple   Spaces_and_underscores  '), 'multiple-spaces-and-underscores');
  assert.strictEqual(slugifyTitle('Foo & Bar'), 'foo-bar');
});

test('slugifyTitle on empty/null/undefined input', () => {
  // NOTE: slugifyTitle's own `|| 'untitled'` fallback is actually dead code
  // today — sanitizePathSegment(s) never returns an empty string (it has
  // its own 'item-<timestamp>' fallback first), so the thing slugifyTitle
  // checks for falsiness never happens. Asserting real behavior, not the
  // apparently-intended-but-unreachable 'untitled' string. Worth a look by
  // whoever owns this function; not fixed here since that's a behavior
  // change outside a test-suite change.
  assert.match(slugifyTitle(''), /^item-[a-z0-9]+$/);
  assert.match(slugifyTitle(null), /^item-[a-z0-9]+$/);
  assert.match(slugifyTitle(undefined), /^item-[a-z0-9]+$/);
});

test('titleKey normalizes for comparison but does not strip punctuation', () => {
  assert.strictEqual(titleKey('Foo & Bar'), 'foo & bar');
  assert.strictEqual(titleKey('  Trimmed  '), 'trimmed');
  // The whole reason titleKey exists instead of reusing slugifyTitle: these
  // two titles must NOT collide under titleKey, even though they do under
  // slugifyTitle (both -> "foo-bar").
  assert.notStrictEqual(titleKey('Foo & Bar'), titleKey('Foo Bar'));
  assert.strictEqual(slugifyTitle('Foo & Bar'), slugifyTitle('Foo Bar'));
});

test('splitPath separates directory parts from the filename', () => {
  assert.deepStrictEqual(splitPath('Folder/Sub/Note.md'), { dirParts: ['Folder', 'Sub'], name: 'Note.md' });
  assert.deepStrictEqual(splitPath('Note.md'), { dirParts: [], name: 'Note.md' });
});

test('resolveRelativeVaultPath resolves "." and ".." segments', () => {
  assert.strictEqual(resolveRelativeVaultPath('Folder/', './image.png'), 'Folder/image.png');
  assert.strictEqual(resolveRelativeVaultPath('Folder/Sub/', '../image.png'), 'Folder/image.png');
  assert.strictEqual(resolveRelativeVaultPath('', 'attachments/img.png'), 'attachments/img.png');
});

test('escapeRegex escapes every regex metacharacter', () => {
  const escaped = escapeRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o');
  assert.doesNotThrow(() => new RegExp(escaped));
  assert.match('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o', new RegExp('^' + escaped + '$'));
});

test('SYNC_CONFLICT_RE matches Syncthing\'s real conflict-file naming convention', () => {
  assert.match('Note.sync-conflict-20260916-143022-ABCDEFG.md', SYNC_CONFLICT_RE);
  assert.doesNotMatch('Note.md', SYNC_CONFLICT_RE);
  // A note a user deliberately titled this way must not be miscategorized —
  // the whole reason this regex is scoped this tightly (see its own comment).
  assert.doesNotMatch('My conflict notes.md', SYNC_CONFLICT_RE);
});

test('RESERVED_DIR_NAMES and WINDOWS_RESERVED_NAMES are the expected sets', () => {
  assert.ok(RESERVED_DIR_NAMES.has('attachments'));
  assert.ok(RESERVED_DIR_NAMES.has('.trash'));
  assert.ok(WINDOWS_RESERVED_NAMES.has('con'));
  assert.ok(WINDOWS_RESERVED_NAMES.has('lpt9'));
  assert.ok(!WINDOWS_RESERVED_NAMES.has('notes'));
});
