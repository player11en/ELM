// Graph view: notes group into one labelled island per folder, a legend lists
// the islands and jumps to one, and the grouping can be switched off.
//
// The fixture deliberately has NO links between notes of the same folder —
// only a few links across folders. That way the only thing that can pull a
// folder's notes together is the islands logic itself; if the notes were
// densely linked inside each folder they'd cluster on their own and the
// test couldn't tell islands-on from islands-off.
const { test, expect } = require('@playwright/test');

const FOLDERS = ['Lore', 'Characters', 'Places'];

async function buildVault(page) {
  await page.evaluate(async (folders) => {
    const cross = { 'Lore 1': '[[Characters 1]]', 'Characters 2': '[[Places 1]]', 'Places 3': '[[Lore 2]]' };
    for (const folder of folders) {
      const fid = await createFolder(folder);
      for (let i = 1; i <= 4; i++) {
        selectedFolderId = fid;
        const id = await createNote();
        const title = `${folder} ${i}`;
        await saveNote(id, { title, body: `body ${cross[title] || ''}` });
      }
    }
    await refreshAll();
  }, FOLDERS);
}

// Wait until the physics layout has genuinely stopped, instead of sleeping a
// fixed time — a fixed sleep is how a layout test goes flaky. Two
// conditions, both required: vis-network reports the simulation stabilized,
// AND positions don't move between two samples. The second alone is NOT
// enough: a first version of this helper only compared positions and
// returned early, which is exactly how a graph that was still spinning in
// circles (physics never stabilized) sailed through these tests.
async function settle(page) {
  await page.waitForFunction(async () => {
    if (!graphViewNetwork || graphViewNetwork.physics?.stabilized !== true) return false;
    const snap = () => Object.fromEntries(Object.entries(graphViewNetwork.getPositions()).map(([k, p]) => [k, [p.x, p.y]]));
    const a = snap(); await new Promise(r => setTimeout(r, 400)); const b = snap();
    return Object.keys(a).every(k => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1]) < 0.5);
  }, null, { timeout: 30000, polling: 500 });
}

// mean distance between notes in the SAME folder / mean distance between notes
// in DIFFERENT folders. Small = folders form tight clusters.
const clusterRatio = page => page.evaluate(() => {
  const pos = graphViewNetwork.getPositions();
  const notes = graphViewNodesDS.get().filter(n => !n.isHub);
  const intra = [], inter = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
    const d = Math.hypot(pos[notes[i].id].x - pos[notes[j].id].x, pos[notes[i].id].y - pos[notes[j].id].y);
    (notes[i].folderId === notes[j].folderId ? intra : inter).push(d);
  }
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  return avg(intra) / avg(inter);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { try { localStorage.removeItem('elm-graph-islands'); } catch {} graphIslandsOn = true; });
  await buildVault(page);
});

test('one labelled island per folder, with a legend', async ({ page }) => {
  // structure only — no need to wait for the layout to settle
  await page.evaluate(() => openGraphView());

  const hubs = await page.evaluate(() => graphViewNodesDS.get().filter(n => n.isHub).map(n => n.label).sort());
  expect(hubs, 'one hub node per folder').toEqual([...FOLDERS].sort());

  const chips = await page.$$eval('#graphLegend .graph-legend-chip', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  expect(chips[0]).toBe('Show all');
  for (const f of FOLDERS) expect(chips.some(c => c.startsWith(f) && c.endsWith('4')), `legend chip for ${f} with its note count`).toBe(true);
});

test('islands actually cluster each folder\'s notes together', async ({ page }) => {
  await page.evaluate(() => openGraphView());
  await settle(page);
  const on = await clusterRatio(page);

  await page.click('#graphIslandsToggle');
  await settle(page);
  const off = await clusterRatio(page);

  expect(on, `islands on: same-folder notes should sit much closer than different-folder ones (ratio ${on.toFixed(2)})`).toBeLessThan(0.6);
  expect(off, `islands off: no folder grouping, so no real clustering (ratio ${off.toFixed(2)})`).toBeGreaterThan(on + 0.2);
});

test('the toggle removes the hubs and legend, and is remembered', async ({ page }) => {
  // structure only — no need to wait for the layout to settle
  await page.evaluate(() => openGraphView());
  await page.click('#graphIslandsToggle');
  await page.waitForFunction(() => graphViewNodesDS && !graphViewNodesDS.get().some(n => n.isHub));

  expect(await page.evaluate(() => graphViewNodesDS.get().filter(n => n.isHub).length), 'no hubs when off').toBe(0);
  expect(await page.$$eval('#graphLegend .graph-legend-chip', e => e.length), 'no legend when off').toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('elm-graph-islands')), 'choice persisted').toBe('0');
});

test('a legend chip jumps the view to that island', async ({ page }) => {
  await page.evaluate(() => openGraphView());
  await settle(page);
  const before = await page.evaluate(() => graphViewNetwork.getScale());

  await page.click('#graphLegend .graph-legend-chip:has-text("Places")');
  await page.waitForTimeout(1200); // fit() animates over 600ms

  const r = await page.evaluate(() => {
    const isl = graphIslands.find(i => i.name === 'Places');
    const pos = Object.values(graphViewNetwork.getPositions([isl.hubId, ...isl.memberIds]));
    const cx = pos.reduce((s, p) => s + p.x, 0) / pos.length, cy = pos.reduce((s, p) => s + p.y, 0) / pos.length;
    const v = graphViewNetwork.getViewPosition();
    return { zoomedIn: graphViewNetwork.getScale(), off: Math.hypot(v.x - cx, v.y - cy) };
  });
  expect(r.zoomedIn, 'view zoomed in on the island').toBeGreaterThan(before);
  expect(r.off, 'view is centred on the island (canvas px from its centroid)').toBeLessThan(80);
  expect(await page.$eval('#graphLegend .graph-legend-chip.active', e => e.textContent), 'chip shows as active').toContain('Places');
});

test('clicking a folder hub frames the island instead of navigating away', async ({ page }) => {
  await page.evaluate(() => openGraphView());
  await settle(page);
  const pt = await page.evaluate(() => {
    const hub = graphViewNodesDS.get().find(n => n.isHub && n.label === 'Lore');
    const dom = graphViewNetwork.canvasToDOM(graphViewNetwork.getPositions([hub.id])[hub.id]);
    const r = document.getElementById('graphViewCanvas').getBoundingClientRect();
    return { x: r.left + dom.x, y: r.top + dom.y };
  });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(900);
  expect(await page.$eval('#graphViewBackdrop', e => getComputedStyle(e).display), 'graph stays open on a hub click').not.toBe('none');
  expect(await page.$eval('#graphLegend .graph-legend-chip.active', e => e.textContent), 'island chip activates').toContain('Lore');
});
