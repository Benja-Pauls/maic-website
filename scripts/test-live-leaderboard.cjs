const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch) {
  const source = readFileSync(join(__dirname, '../src/hooks/dashboard-leaderboard.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, fetch, AbortSignal, Promise, Set, Error });
  return exports.getChapterLeaderboard;
}
const rows = (count) => Array.from({ length: count }, (_, i) => ({
  id: `member-${i}`, name: `Member ${i}`, rank: i + 1, points: 2000 - i,
  currentPoints: 1000 - i, eventsAttended: 2, badges: [],
}));
const response = (data) => ({ ok: true, json: async () => data });
function page(data, offset = 0) {
  return { leaderboard: data.slice(offset, offset + 500), totalMembers: data.length,
    offset, limit: 500, hasMore: offset + 500 < data.length };
}

test('loads all 1,503 members across pages with distinct lifetime/spendable points', async () => {
  const data = rows(1503), calls = [];
  data[1502].name = 'Zoë, Member';
  data[1502].badges = [{ id: 'badge1', name: 'Research', icon: 'https://example.org/badge.png' }];
  const get = load(async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('chapter'), 'msoe-ai-club');
    assert.equal(parsed.searchParams.get('limit'), '500');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    const offset = Number(parsed.searchParams.get('offset')); calls.push(offset);
    return response(page(data, offset));
  });
  const result = await get();
  assert.deepEqual(calls, [0, 500, 1000, 1500]);
  assert.equal(result.length, 1503);
  assert.equal(result[1502].name, 'Zoë, Member');
  assert.equal(result[1502].currentPoints, -502);
  assert.equal(result[1502].points, 498);
  assert.equal(result[1502].badges[0].name, 'Research');
});

test('shares simultaneous reads, but the next read gets changed points', async () => {
  let calls = 0;
  const data = rows(1);
  const get = load(async () => { calls++; return response(page(data)); });
  const first = get(), second = get();
  assert.equal(first, second);
  await first;
  data[0] = { ...data[0], points: 9000 };
  const result = await get();
  assert.equal(calls, 2);
  assert.equal(result[0].points, 9000);
});

test('does not expose a partial leaderboard when a later page fails', async () => {
  let fail = true;
  const data = rows(701);
  const get = load(async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    return fail && offset === 500 ? { ok: false } : response(page(data, offset));
  });
  await assert.rejects(get(), /latest standings/);
  fail = false;
  assert.equal((await get()).length, 701);
});

test('supports an empty chapter without keeping a historical snapshot', async () => {
  const get = load(async () => response(page([])));
  assert.equal((await get()).length, 0);
});

test('rejects a roster count change between pages rather than reporting a false complete result', async () => {
  const data = rows(701);
  const get = load(async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    return response({ ...page(data, offset), totalMembers: offset ? 702 : 701 });
  });
  await assert.rejects(get(), /changed while loading/);
});

test('rejects duplicated identities when a live points change shifts pagination', async () => {
  const data = rows(701);
  const get = load(async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    const result = page(data, offset);
    if (offset) result.leaderboard[0] = { ...data[499], rank: 501 };
    return response(result);
  });
  await assert.rejects(get(), /changed while loading/);
});

test('rejects a truncated successful response and legacy payloads missing spendable points', async () => {
  const data = rows(701);
  await assert.rejects(load(async () => response({ ...page(data), hasMore: false }))(), /complete standings/);
  const old = rows(1); delete old[0].currentPoints;
  await assert.rejects(load(async () => response(page(old)))(), /changed while loading/);
});

function renderLeaderboard(state) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = readFileSync(join(__dirname, '../src/components/home-page/leaderboard/Leaderboard.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name.endsWith('use-dashboard-leaderboard')) return { useDashboardLeaderboard: () => state };
    if (name.endsWith('BadgeIcon')) return { BadgeIcon: ({ name }) => React.createElement('span', {}, name) };
    if (name.endsWith('.css')) return {};
    return require(name);
  }});
  return renderToStaticMarkup(React.createElement(exports.default));
}

test('homepage renders a person beyond the first API page and each point balance', () => {
  const data = rows(701);
  data[700].name = 'Zoë, Last Member';
  const html = renderLeaderboard({ leaders: data, loading: false, error: null, refresh() {} });
  assert.match(html, /Zoë, Last Member/);
  assert.match(html, />701<\/td>/);
  assert.match(html, />1,300<\/td>/);
  assert.match(html, />300<\/td>/);
  assert.match(html, /Current points are available to spend/);
});

test('a failed initial load cannot render archived CSV numbers as current points', () => {
  const html = renderLeaderboard({ leaders: null, loading: false, error: 'Unable to refresh.', refresh() {} });
  assert.match(html, /Standings are temporarily unavailable/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /EBOARD|first-place|Member 0/);
});

test('a failed refresh visibly labels the last successful standings', () => {
  const html = renderLeaderboard({ leaders: rows(1), loading: false, error: 'Unable to refresh.', refresh() {} });
  assert.match(html, /Showing the last successfully loaded standings/);
  assert.match(html, /Member 0/);
  assert.match(html, />Refresh<\/button>/);
});

test('refreshes on focus/visible intervals, pauses hidden tabs, and cleans up on navigation', async () => {
  const source = readFileSync(join(__dirname, '../src/hooks/use-dashboard-leaderboard.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const events = {}, timers = new Map(), values = [];
  let start, calls = 0;
  const doc = { visibilityState: 'visible', addEventListener: (type, cb) => { events[type] = cb; },
    removeEventListener: (type) => { delete events[type]; } };
  const win = { addEventListener: doc.addEventListener, removeEventListener: doc.removeEventListener,
    setInterval: (cb, ms) => { assert.equal(ms, 60000); timers.set(1, cb); return 1; },
    clearInterval: (id) => timers.delete(id) };
  const exports = {};
  vm.runInNewContext(outputText, { exports, document: doc, window: win, require(name) {
    if (name === 'react') return {
      useState(value) { const i = values.push(value) - 1; return [value, (next) => { values[i] = next; }]; },
      useRef: (value) => ({ current: value }), useCallback: (fn) => fn,
      useEffect(fn) { start = fn; },
    };
    return { async getChapterLeaderboard() { calls++; return rows(1); } };
  }});
  exports.useDashboardLeaderboard();
  const cleanup = start();
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  doc.visibilityState = 'hidden'; timers.get(1)(); events.visibilitychange();
  await new Promise(setImmediate); assert.equal(calls, 1);
  doc.visibilityState = 'visible'; events.visibilitychange();
  await new Promise(setImmediate); assert.equal(calls, 2);
  events.focus(); await new Promise(setImmediate); assert.equal(calls, 3);
  timers.get(1)(); await new Promise(setImmediate); assert.equal(calls, 4);
  cleanup(); assert.equal(timers.size, 0); assert.deepEqual(Object.keys(events), []);
});
