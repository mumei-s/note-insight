import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const source = readFileSync(process.env.INSIGHT_DASHBOARD_SOURCE || 'supabase/functions/insight-dashboard-data/index.ts', 'utf8');
const before = readFileSync('tests/fixtures/dashboard-analysis-before.ts', 'utf8');
const now = Date.parse('2026-10-19T12:00:00Z');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const plain = value => JSON.parse(JSON.stringify(value));
function snapshot(id, extra = {}) {
  return { id: String(id), member_id: 'owner', confirmed: true, captured_at: new Date(now - (500 - id) * 60_000).toISOString(),
    period_type: 'all', period_start: null, period_end: null, dashboard_schema_version: 4,
    total_views: id * 9, total_page_views: id * 10, total_impressions: id * 20,
    total_comments: id, total_likes: id * 2, total_sales_yen: 0, total_shares: 0,
    summary_articles: 1, summary_shared_articles: 0, official_collected_at: '2026-10-19T01:00:00Z',
    content_sections: { article: { scope: 'complete', total: 1 }, membership: { total: 0 } },
    metric_series: [{ date: '2026-10-18', pageViews: id, likes: id * 2 }, { date: '2026-10-19', pageViews: 0 }],
    traffic_sources: [{ source: 'google.com', pv: id, percent: 100 }],
    traffic_series: Array.from({ length: 30 }, (_, n) => ({ date: '2026-10-01', source: `source-${n}`, pageViews: id })),
    raw_data: { connectorVersion: '1.7.3', articleCount: 1, dailyPvDays: 2, availableTotals: { pageViews: true, salesYen: false },
      chartSeries: Array.from({ length: 30 }, (_, n) => ({ startDate: `2026-09-${String(n + 1).padStart(2, '0')}`, endDate: `2026-09-${String(n + 1).padStart(2, '0')}`, granularity: 'DAY', pageViews: id })) }, ...extra };
}

async function run(code, { snapshots = [], body = {}, memberId = 'owner-app', noteId = 'ss_yr', failDetail = false, missingDetail = false, failHistory = false, afterHistoryRead } = {}) {
  const requests = [], tables = {
    insight_member_sessions: [{ application_id: memberId, expires_at: '2099-01-01', revoked_at: null }],
    insight_access_applications: [{ id: memberId, note_id: noteId, status: 'active' }],
    insight_dashboard_snapshots: snapshots,
    insight_dashboard_article_snapshots: snapshots.map(s => ({ snapshot_id: s.id, article_key: 'n1', title: 'Fixture article', url: 'https://note.com/fixture/n/n1', views: 10, page_views: 12, impressions: 30, comments: 2, likes: 4, sales_yen: 0, shares: 0, published_at: '2026-09-01', status: 'public', content_type: 'article', traffic_sources: [], extra: {} })),
    insight_relation_sync_runs: [{ member_id: 'owner', direction: 'followers', expected_count: 9, received_count: 8, complete: true, created_at: '2026-10-18T00:00:00Z', error: null }],
    insight_public_likes: [{ member_id: 'owner', liked_at: '2026-10-18T00:00:00Z' }],
    insight_public_comments: [{ member_id: 'owner', occurred_at: '2026-10-18T00:00:00Z', parent_key: 'nc1', is_creator: false }],
  };
  const db = { from(table) {
    let rows = tables[table] || [], columns = '*', bound = Infinity, from = 0, to = Infinity;
    const filters = [], orders = [];
    const result = async single => {
      const detail = table === 'insight_dashboard_snapshots' && columns === 'traffic_sources,traffic_series,raw_data';
      let error = detail && failDetail || table === 'insight_dashboard_snapshots' && !detail && failHistory ? new Error('fixture_read_failure') : null;
      let ordered = [...rows].sort((a, b) => { for (const [key, asc] of orders) { const value = String(a[key] ?? '').localeCompare(String(b[key] ?? '')); if (value) return asc ? value : -value; } return 0; });
      let data = ordered.slice(from, Math.min(to + 1, bound)).map(row => columns === '*' ? plain(row) : Object.fromEntries(columns.split(',').filter(key => key in row).map(key => [key, plain(row[key])])));
      if (single) data = data[0] || null;
      if (detail && missingDetail) data = null;
      if (error) data = null;
      requests.push({ table, columns, filters, rows: Array.isArray(data) ? data.length : data ? 1 : 0, bytes: Buffer.byteLength(JSON.stringify(data)) });
      if (table === "insight_dashboard_snapshots" && !detail && afterHistoryRead) afterHistoryRead(tables.insight_dashboard_snapshots);
      return { data, error };
    };
    const q = { select(c) { columns = c; return q; }, eq(k, v) { filters.push([k, v]); if (k !== 'token_hash') rows = rows.filter(r => String(r[k]) === String(v)); return q; },
      gte(k, v) { rows = rows.filter(r => r[k] >= v); return q; }, order(k, o = {}) { orders.push([k, o.ascending !== false]); return q; }, limit(n) { bound = n; return q; },
      range(a, z) { from = a; to = z; return q; }, maybeSingle() { return result(true); }, then(resolve, reject) { return result(false).then(resolve, reject); } };
    return q;
  }, async rpc(name, args) { assert.equal(name, 'insight_dashboard_saved_daily'); assert.equal(args.p_member_id, noteId === 'ss_yr' ? 'owner' : memberId); return { data: [{ date: '2026-09-01', pageViews: 20, likes: 1 }], error: null }; } };
  let handle;
  const ctx = vm.createContext({ URL, Request, Response, TextEncoder, crypto: webcrypto, Date: FixedDate, console: { error() {} }, createClient: () => db, Deno: { env: { get: () => '' }, serve: fn => handle = fn } });
  vm.runInContext(ts.transpileModule(code.replace(/^import[^\n]+\n/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  const response = await handle(new Request('https://example.test/', { method: 'POST', headers: { 'X-Insight-Token': 'fixture' }, body: JSON.stringify({ action: 'analysis', ...body }) }));
  return { status: response.status, payload: await response.json(), requests };
}

test('500 saved snapshots retain exactly the same response while only one chart/traffic payload is read', async t => {
  const snapshots = Array.from({ length: 500 }, (_, i) => snapshot(i + 1));
  const old = await run(before, { snapshots }), next = await run(source, { snapshots });
  assert.equal(next.status, 200); assert.deepEqual(next.payload, old.payload);
  const reads = next.requests.filter(r => r.table === 'insight_dashboard_snapshots');
  assert.equal(reads.length, 2); assert.equal(reads.filter(r => /raw_data/.test(r.columns)).reduce((sum, r) => sum + r.rows, 0), 1);
  const bytes = r => r.requests.filter(q => q.table === 'insight_dashboard_snapshots').reduce((sum, q) => sum + q.bytes, 0);
  assert.ok(bytes(next) < bytes(old) * .35);
  t.diagnostic(`Synthetic 500-snapshot DB JSON: ${bytes(old)} -> ${bytes(next)} bytes; response identical. Not live billing data.`);
});

for (const [name, snapshots, body] of [
  ['complete rich snapshot before a newer partial read', [snapshot(1), snapshot(2, { content_sections: { article: { scope: 'partial-read' } } })], {}],
  ['rich snapshot before newer legacy schema', [snapshot(1), snapshot(2, { dashboard_schema_version: 1 })], {}],
  ['partial-only history', [snapshot(1, { content_sections: { article: { scope: 'partial-read' } } })], {}],
  ['legacy metrics with missing and zero values', [snapshot(1, { dashboard_schema_version: 1, raw_data: null, traffic_sources: null, traffic_series: null, metric_series: [{ date: '2026-10-18', likes: 0 }] })], {}],
  ['selected week keeps unselected periods and old daily values', [snapshot(1), snapshot(2, { period_type: 'custom', period_start: '2026-10-12', period_end: '2026-10-18' }), snapshot(3)], { period: 'week', dashboardOnly: true }],
  ['missing selected period', [snapshot(1)], { period: 'month' }],
  ['empty history', [], {}],
]) test(`analysis response parity: ${name}`, async () => {
  const old = await run(before, { snapshots, body }), next = await run(source, { snapshots, body });
  assert.equal(next.status, 200); assert.deepEqual(next.payload, old.payload);
  if (!next.payload.latestDashboard) assert.equal(next.requests.filter(r => r.columns === 'traffic_sources,traffic_series,raw_data').length, 0);
});

test('detail read stays bound to authenticated member and confirmed selected snapshot', async () => {
  const snapshots = [snapshot(1, { member_id: 'participant-a' }), snapshot(2, { member_id: 'participant-b' }), snapshot(3, { member_id: 'participant-a', confirmed: false })];
  const options = { snapshots, memberId: 'participant-a', noteId: 'participant_a' };
  const old = await run(before, options), next = await run(source, options);
  assert.deepEqual(next.payload, old.payload);
  const detail = next.requests.find(r => r.columns === 'traffic_sources,traffic_series,raw_data');
  assert.deepEqual(detail.filters, [['member_id', 'participant-a'], ['id', '1'], ['confirmed', true]]);
});

for (const flag of ['failDetail', 'missingDetail', 'failHistory']) test(`failed ${flag} cannot be presented as complete zero-valued history`, async () => {
  const next = await run(source, { snapshots: [snapshot(1)], [flag]: true });
  assert.equal(next.status, 500); assert.equal(next.payload.ok, false);
});


test('a newer snapshot arriving during the read cannot replace the already selected historical snapshot', async () => {
  const options = () => ({ snapshots: [snapshot(1)], afterHistoryRead: rows => rows.push(snapshot(2)) });
  const old = await run(before, options()), next = await run(source, options());
  assert.equal(next.status, 200); assert.deepEqual(next.payload, old.payload);
  const detail = next.requests.find(r => r.columns === 'traffic_sources,traffic_series,raw_data');
  assert.deepEqual(detail.filters.find(([key]) => key === 'id'), ['id', '1']);
});

test('a selected snapshot losing confirmation during the read fails closed', async () => {
  const next = await run(source, { snapshots: [snapshot(1)], afterHistoryRead: rows => { rows[0].confirmed = false; } });
  assert.equal(next.status, 500); assert.equal(next.payload.error, 'DASHBOARD_SNAPSHOT_UNAVAILABLE');
});
