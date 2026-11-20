/**
 * @title Data Catalog
 * @description Every source, dbt model, Looker view, explore, metric and dashboard in the analytics platform: what each one means, how they join, where each metric comes from, and how much each is used.
 * @toolkit-version 1.3.0
 */

import { DataApp, html, nothing, openTileDrillMenu, isDrillingActive } from '/runtime/data-app.js';

export const elementName = 'ra-data-catalog';

/*
 * The catalog snapshot and the brand fonts below are written by
 * catalog_builder/build_metadata.py from the LookML repo, the dbt manifest and
 * catalog_builder/catalog.yml. Do not edit them by hand; run the builder again.
 * The snapshot is gzip-compressed and base64-encoded to stay under Looker's
 * 900 KB limit per app, and is unpacked once in the browser.
 */
const META_GZ = /* @metadata-start */ "" /* @metadata-end */;
const FONT_CSS = /* @fonts-start */ "" /* @fonts-end */;

/* ------------------------------------------------------------------ constants */

const USAGE_DAYS = 90;
const PAGE = 100;
const MAX_GRAPH = 260;

/* Display order for asset kinds and layers. */
const LAYERS = {
  source: { label: 'Source', plural: 'Sources', rank: 0, tint: 'sky', text: 'Raw data as it lands from a source system.' },
  seed: { label: 'Seed', plural: 'Seeds', rank: 0, tint: 'sky', text: 'A small reference list kept in the dbt repo.' },
  external: { label: 'External table', plural: 'External tables', rank: 0, tint: 'sand', text: 'A table Looker reads that dbt does not build.' },
  staging: { label: 'Staging', plural: 'Staging', rank: 1, tint: 'stg', text: 'A cleaned copy of one source table.' },
  integration: { label: 'Integration', plural: 'Integration', rank: 2, tint: 'int', text: 'Joins and matches data from several sources.' },
  warehouse: { label: 'Warehouse', plural: 'Warehouse', rank: 3, tint: 'wh', text: 'A business-ready table that Looker reads.' },
  snapshot: { label: 'Snapshot', plural: 'Snapshots', rank: 3, tint: 'wh', text: 'Keeps past versions of each record.' },
  view: { label: 'Looker view', plural: 'Looker views', rank: 4, tint: 'peach', text: 'Looker’s definition of a table: its fields and metrics.' },
  explore: { label: 'Explore', plural: 'Explores', rank: 5, tint: 'lemon', text: 'A set of joined views people can query in Looker.' },
  dashboard: { label: 'Dashboard', plural: 'Dashboards', rank: 6, tint: 'dash', text: 'A LookML dashboard kept in the repo.' },
};

const KIND_LABEL = {
  source: 'Source table', seed: 'Seed', table: 'External table', model: 'dbt model', snapshot: 'Snapshot',
  view: 'Looker view', explore: 'Explore', dashboard: 'Dashboard', measure: 'Metric', dimension: 'Dimension',
  parameter: 'Parameter', filter: 'Filter field', term: 'Glossary term', udd: 'Looker dashboard',
  product: 'Data product', rule: 'Business rule', question: 'Verified question', column: 'Column',
};

const TIMEFRAMES = ['raw', 'time', 'date', 'week', 'month', 'quarter', 'year', 'day_of_week', 'day_of_month', 'hour',
  'minute', 'month_name', 'month_num', 'fiscal_quarter', 'fiscal_year', 'week_of_year', 'day_of_year', 'hour_of_day',
  'quarter_of_year', 'time_of_day', 'fiscal_month_num', 'fiscal_quarter_of_year'];

const NAV = [
  { group: '', items: [{ id: 'home', label: 'Home', icon: 'home' }, { id: 'search', label: 'Search', icon: 'search' }] },
  { group: 'Browse', items: [
    { id: 'domains', label: 'Domains', icon: 'domain' },
    { id: 'tables', label: 'Tables', icon: 'table' },
    { id: 'looker', label: 'Looker model', icon: 'explore' },
    { id: 'metrics', label: 'Metrics', icon: 'metric' },
    { id: 'dashboards', label: 'Dashboards', icon: 'dashboard' },
  ] },
  { group: 'Knowledge', items: [
    { id: 'products', label: 'Data products', icon: 'product' },
    { id: 'glossary', label: 'Glossary', icon: 'book' },
    { id: 'graph', label: 'Context graph', icon: 'graph' },
    { id: 'rules', label: 'Business rules', icon: 'rule' },
    { id: 'questions', label: 'Verified questions', icon: 'question' },
  ] },
  { group: 'Understand', items: [
    { id: 'lineage', label: 'Lineage', icon: 'lineage' },
  ] },
  { group: 'Govern', items: [
    { id: 'health', label: 'Documentation health', icon: 'health' },
    { id: 'usage', label: 'Usage', icon: 'usage' },
  ] },
];
const SECTION_OF = {
  home: 'home', search: 'search', domains: 'domains', domain: 'domains', tables: 'tables', looker: 'looker',
  metrics: 'metrics', dashboards: 'dashboards', udd: 'dashboards', lineage: 'lineage', glossary: 'glossary',
  term: 'glossary', health: 'health', usage: 'usage', products: 'products', product: 'products', graph: 'graph',
  rules: 'rules', questions: 'questions', rule: 'rules',
};
const SECTION_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((it) => [it.id, it.label])));
const SCOPES = { all: {}, metrics: { type: 'metric' }, tables: { type: 'table' }, dashboards: { type: 'dashboard' }, knowledge: { knowledge: true } };
const SCOPE_LABEL = { all: 'All', metrics: 'Metrics', tables: 'Tables', dashboards: 'Dashboards', knowledge: 'Knowledge' };
const SCOPE_GROUPS = { metrics: ['metric'], tables: ['table'], dashboards: ['dashboard'], knowledge: ['term', 'product', 'question', 'rule'] };
/* Search prompts come from catalog.yml (search:) so each client gets its own; these are the neutral fallbacks. */
const searchCfg = () => (META && META.search) || {};
const examples = () => searchCfg().examples || ['revenue', 'customer', 'orders'];

const SQL_KEYWORDS = new Set(['select', 'from', 'where', 'and', 'or', 'not', 'case', 'when', 'then', 'else', 'end', 'sum',
  'count', 'avg', 'min', 'max', 'distinct', 'coalesce', 'nullif', 'null', 'is', 'in', 'as', 'on', 'join', 'left', 'inner',
  'outer', 'group', 'by', 'order', 'having', 'limit', 'cast', 'safe_divide', 'if', 'ifnull', 'date_trunc', 'timestamp',
  'date', 'interval', 'over', 'partition', 'with', 'union', 'all', 'true', 'false', 'like', 'between', 'round', 'extract',
  'current_date', 'date_diff', 'timestamp_diff', 'lower', 'upper', 'concat', 'string', 'int64', 'float64', 'numeric', 'struct',
  'array', 'unnest', 'exists', 'qualify', 'row_number', 'lag', 'lead', 'first_value', 'last_value', 'desc', 'asc', 'ref', 'source', 'config']);

/* ------------------------------------------------------------------ icons */

const I = (d, size = 16) => html`<svg class="ic" viewBox="0 0 16 16" width=${size} height=${size} aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const ICONS = {
  home: 'M2.5 7.2 8 2.5l5.5 4.7V13a.5.5 0 0 1-.5.5H9.5V10h-3v3.5H3a.5.5 0 0 1-.5-.5z',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6l3.4 3.4',
  domain: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  table: 'M2 3.5h12v9H2zM2 6.5h12M2 9.5h12M6 6.5v6',
  explore: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM10.6 5.4 9.2 9.2 5.4 10.6l1.4-3.8z',
  metric: 'M12 3.5H4.5L8 8l-3.5 4.5H12',
  dashboard: 'M2 2.5h5v6H2zM9 2.5h5v3.5H9zM9 8h5v5.5H9zM2 10.5h5v3H2z',
  lineage: 'M2.5 4.5h3v3h-3zM10.5 2.5h3v3h-3zM10.5 10.5h3v3h-3zM5.5 6h2.5v-2h2.5M8 6v6h2.5',
  book: 'M3 2.5h7.5A2.5 2.5 0 0 1 13 5v8.5H5.5A2.5 2.5 0 0 1 3 11zM3 11a2.5 2.5 0 0 1 2.5-2.5H13',
  health: 'M2 8h3l1.5-4 3 8L11 8h3',
  usage: 'M2.5 13.5h11M4 11V7.5M7 11V4.5M10 11V8M13 11V5.5',
  source: 'M3 4c0-1 2.2-1.6 5-1.6S13 3 13 4v8c0 1-2.2 1.6-5 1.6S3 13 3 12zM3 4c0 1 2.2 1.6 5 1.6S13 5 13 4M3 8c0 1 2.2 1.6 5 1.6S13 9 13 8',
  model: 'M8 2 14 5 8 8 2 5zM2 8l6 3 6-3M2 11l6 3 6-3',
  view: 'M2.5 3h11v10h-11zM2.5 6h11M5.5 9h5M5.5 11h3',
  field: 'M3.5 3.5h9M3.5 8h9M3.5 12.5h5',
  dimension: 'M3 3h4.5L13 8.5 8.5 13 3 7.5zM5.6 5.6h.01',
  term: 'M3 2.5h7.5A2.5 2.5 0 0 1 13 5v8.5H5.5A2.5 2.5 0 0 1 3 11zM3 11a2.5 2.5 0 0 1 2.5-2.5H13',
  arrow: 'M3 8h9.5M9 4.5 12.5 8 9 11.5',
  back: 'M13 8H3.5M7 4.5 3.5 8 7 11.5',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
  fit: 'M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10',
  chevron: 'M6 4l4 4-4 4',
  down: 'M4 6l4 4 4-4',
  lock: 'M4 7.5h8v6H4zM5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2',
  check: 'M3 8.5 6.5 12 13 4.5',
  warn: 'M8 2.5 14 13H2zM8 6.5v3M8 11.5h.01',
  key: 'M10 2.5a3.5 3.5 0 1 1-2.9 5.4L2.5 12.5v1.5h2v-1.5h1.5V11l1.6-1.6',
  close: 'M4 4l8 8M12 4l-8 8',
  code: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5',
  link: 'M6.5 9.5l3-3M5 7.5 3.8 8.7a2.5 2.5 0 0 0 3.5 3.5L8.5 11M11 8.5l1.2-1.2a2.5 2.5 0 0 0-3.5-3.5L7.5 5',
  product: 'M8 2 13.5 4.8v6.4L8 14l-5.5-2.8V4.8zM2.5 4.8 8 7.6l5.5-2.8M8 7.6V14',
  graph: 'M4 4.5a1.5 1.5 0 1 0 0-.01M12 3.5a1.5 1.5 0 1 0 0-.01M8 12.5a1.5 1.5 0 1 0 0-.01M5.3 5.2l1.9 5.6M10.7 4.4l-1.9 6.4M5.5 4.3l5-.6',
  rule: 'M3 3.5h10M3 8h10M3 12.5h6M11.5 11l1.2 1.2 2-2.2',
  question: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4M8 11.3h.01',
  briefcase: 'M2.5 5h11v8h-11zM6 5V3.5h4V5M2.5 8.5h11',
  building: 'M3 14V2.5h7V14M10 6h3V14M2 14h12M5 5h2M5 7.5h2M5 10h2',
  users: 'M6 7.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM2 13.5c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8M10.5 3a2.2 2.2 0 0 1 0 4.4M12 9.9c1.3.5 2 1.8 2 3.6',
  user: 'M8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM3 13.8c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5',
  megaphone: 'M2.5 6.5v3h2l5 3v-9l-5 3zM11.5 6a2.5 2.5 0 0 1 0 4M4.5 9.5l1 3.5',
  target: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 8.2v-.4',
  pound: 'M11 13H4.5c1-1 1.5-2.2 1.5-3.5V6a2.5 2.5 0 0 1 4.6-1.3M4.5 9h4.5',
  box: 'M8 2 13.5 4.8v6.4L8 14l-5.5-2.8V4.8zM2.5 4.8 8 7.6l5.5-2.8M8 7.6V14',
  'trending-up': 'M2 11.5l4-4 2.5 2.5L14 4.5M10.5 4.5H14V8',
  shield: 'M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z',
  dots: 'M4 8h.01M8 8h.01M12 8h.01',
  dot: 'M8 8h.01',
  calculator: 'M3.5 2h9v12h-9zM5.5 4.5h5M5.5 7.5h1M8 7.5h1M10.5 7.5h0M5.5 10h1M8 10h1M5.5 12.5h1M8 12.5h2.5',
  filter: 'M2.5 3h11L9 8.5V13l-2-1V8.5z',
  edit: 'M10.5 2.5l3 3-7.5 7.5H3v-3zM9 4l3 3',
};
const DOMAIN_ICON_FALLBACK = { crm: 'building', sales: 'trending-up', delivery: 'briefcase', finance: 'pound', marketing: 'megaphone', performance: 'target', people: 'user', engineering: 'code', product: 'box', security: 'shield', partners: 'link', other: 'dots' };
const RULE_CAT = {
  calculation: { label: 'How it is calculated', icon: 'calculator', text: 'Formulas and how totals add up' },
  inclusion: { label: 'What is included', icon: 'filter', text: 'What counts and what is left out' },
  threshold: { label: 'Thresholds and targets', icon: 'target', text: 'Where red, amber and green start' },
  data_entry: { label: 'Data entry', icon: 'edit', text: 'How people must record the data' },
  ownership: { label: 'Ownership', icon: 'user', text: 'Who decides and who signs off' },
};
const KIND_ICON = { source: 'source', seed: 'source', table: 'source', model: 'model', snapshot: 'model', view: 'view',
  explore: 'explore', dashboard: 'dashboard', udd: 'dashboard', measure: 'metric', dimension: 'dimension', parameter: 'field',
  filter: 'field', term: 'term', product: 'product', rule: 'rule', question: 'question', column: 'table' };
const icon = (name, size) => I(ICONS[name] || ICONS.field, size);
const domIcon = (dom, size = 14) => { const d = (typeof IX !== 'undefined' && IX && IX.domain.get(dom)) || {}; return icon(d.icon || DOMAIN_ICON_FALLBACK[dom] || 'domain', size); };

/* ------------------------------------------------------------------ helpers */

const NF = new Intl.NumberFormat('en-GB');
const fmtInt = (n) => NF.format(Math.round(Number(n) || 0));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const plural = (n, one, many) => `${fmtInt(n)} ${n === 1 ? one : (many || `${one}s`)}`;
const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
};
const fmtCompact = (x) => {
  const n = Number(x) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  return fmtInt(n);
};
const colStats = (n) => {
  const cs = (n.cols || []).filter((c) => !c.nest && !c.gone);
  return { total: cs.length, doc: cs.filter((c) => c.doc).length };
};
/* Long identifiers: allow line breaks after dots, slashes and underscores without changing the text. */
const wbr = (s) => String(s || '').split(/(?<=[./_])/).map((x, i) => (i ? html`<wbr>${x}` : x));
const st = (p) => (p >= 70 ? 's-good' : p >= 40 ? 's-warn' : 's-poor');
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
const ACRONYMS = new Set(['gbp', 'usd', 'eur', 'kpi', 'kpis', 'nps', 'enps', 'id', 'pk', 'fk', 'url', 'sql', 'sqls', 'mql', 'mqls', 'rag', 'sow', 'sows', 'crm', 'ga4', 'ytd', 'mtd', 'qtd', 'fy', 'fte', 'cpc', 'ctr', 'cpm', 'roi', 'hr', 'pto', 'utm', 'seo', 'icp', 'rfm', 'pl', 'p&l', 'api', 'ai', 'pdt', 'dbt']);
const humanise = (s) => {
  const t = String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const words = t.split(' ').map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w));
  const out = words.join(' ');
  return out[0].toUpperCase() + out.slice(1);
};
const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const esc = (s) => String(s).replace(/[\^,"]/g, (c) => `^${c}`);
function push(map, key, val) { const a = map.get(key); if (a) a.push(val); else map.set(key, [val]); }

/* ------------------------------------------------------------------ snapshot + index */

let META = null;
let IX = null;
const USAGE_BOOST = new Map();

async function unpack(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

async function loadMeta() {
  if (META) return META;
  if (!META_GZ) throw new Error('This app has no catalog snapshot yet. Run catalog_builder/build_metadata.py --inject.');
  META = await unpack(META_GZ);
  return META;
}

/* The apps' own content tables, views and explores (data_apps): kept in search and the Looker pages, hidden elsewhere. */
function isPlumbing(n) {
  if (!n) return false;
  const p = String(n.path || '');
  return p.startsWith('views/data_apps/') || p.startsWith('data_apps/') || /(^|\.)data_apps\./.test(String(n.rel || ''));
}

function layerOf(n) {
  if (n.k === 'model') return n.layer || 'warehouse';
  if (n.k === 'table') return 'external';
  return n.k === 'udd' ? 'dashboard' : n.k;
}

function titleOf(n) {
  if (!n) return '';
  if (n.k === 'explore') return n.label || humanise(n.name);
  if (n.k === 'dashboard' || n.k === 'udd') return n.label || n.name;
  return n.name;
}

function fieldTitle(f) { return f ? (f.l || humanise(f.n)) : ''; }

function buildIndex(M) {
  const ix = {
    node: new Map(), field: new Map(), down: new Map(), fieldsByView: new Map(), usedBy: new Map(),
    groupOf: new Map(), joinsByView: new Map(), aliasToView: new Map(), viewsByExplore: new Map(),
    exploresByView: new Map(), term: new Map(), domain: new Map(), docs: [], fkByNode: new Map(),
    product: new Map(), prodOf: new Map(), rules: [], questions: [], syn: new Map(), vocab: new Map(),
    termsOfField: new Map(), rulesOfField: new Map(), questionsOfField: new Map(), colDocs: null,
  };
  const K = M.knowledge || {};
  (M.domains || []).forEach((d, i) => ix.domain.set(d.id, { ...d, i }));
  M.nodes.forEach((n) => { n.up = n.up || []; n.cols = n.cols || []; n.tests = n.tests || []; n.tags = n.tags || []; ix.node.set(n.id, n); });
  M.nodes.forEach((n) => n.up.forEach((u) => push(ix.down, u, n.id)));
  M.fields.forEach((f) => {
    f.id = `${f.v}.${f.n}`;
    f.refs = f.refs || []; f.cols = f.cols || []; f.dash = f.dash || [];
    f.dom = (ix.node.get(`view.${f.v}`) || {}).dom || 'other';
    ix.field.set(f.id, f);
    push(ix.fieldsByView, f.v, f);
    if (f.grp) TIMEFRAMES.concat(f.tf || []).forEach((tf) => ix.groupOf.set(`${f.id}_${tf}`, f.id));
  });
  M.fields.forEach((f) => f.refs.forEach((r) => push(ix.usedBy, r, f.id)));
  (M.glossary || []).forEach((t) => { ix.term.set(t.t, t); t.m.forEach((m) => push(ix.termsOfField, m, t.t)); });

  // explores: who joins whom
  M.nodes.filter((n) => n.k === 'explore').forEach((ex) => {
    const a2v = {};
    (ex.joins || []).forEach((j) => { a2v[j.a] = j.v; });
    ix.aliasToView.set(ex.name, a2v);
    const views = [...new Set((ex.joins || []).map((j) => j.v))];
    ix.viewsByExplore.set(ex.name, views);
    views.forEach((v) => push(ix.exploresByView, v, ex.name));
    (ex.joins || []).filter((j) => !j.base).forEach((j) => {
      const partners = [...new Set((j.refs || []).map((r) => r.split('.')[0]).filter((a) => a !== j.a && a2v[a]))];
      const partner = partners[0] || ex.base;
      const pv = a2v[partner] || partner;
      push(ix.joinsByView, j.v, { explore: ex.name, other: pv, alias: j.a, otherAlias: partner, rel: j.rel || 'many_to_one', type: j.type, on: j.on, side: 'joined' });
      push(ix.joinsByView, pv, { explore: ex.name, other: j.v, alias: partner, otherAlias: j.a, rel: invertRel(j.rel || 'many_to_one'), type: j.type, on: j.on, side: 'base' });
    });
  });
  M.fields.forEach((f) => { f.ex = ix.exploresByView.get(f.v) || []; });

  // dbt relationships tests are foreign keys
  M.nodes.forEach((n) => n.tests.filter((t) => t.t === 'relationships' && t.d).forEach((t) => {
    const [toModel, toCol] = t.d.split('.');
    const target = M.nodes.find((x) => (x.k === 'model' || x.k === 'seed' || x.k === 'snapshot') && x.name === toModel);
    push(ix.fkByNode, n.id, { col: t.c, to: target ? target.id : '', toName: toModel, toCol, dir: 'out' });
    if (target) push(ix.fkByNode, target.id, { col: toCol, to: n.id, toName: n.name, toCol: t.c, dir: 'in' });
  }));

  // knowledge: products, rules, questions, synonyms
  (K.products || []).forEach((p) => {
    ix.product.set(p.id, p);
    const add = (id) => { const a = ix.prodOf.get(id) || []; if (!a.includes(p.id)) a.push(p.id); ix.prodOf.set(id, a); };
    p.assets.forEach((a) => {
      add(a);
      (ix.down.get(a) || []).forEach((d) => { if ((ix.node.get(d) || {}).k === 'view') add(d); });
    });
    p.m.forEach(add);
  });
  ix.rules = K.rules || [];
  ix.rules.forEach((r) => r.m.forEach((m) => push(ix.rulesOfField, m, r.id)));
  ix.questions = K.questions || [];
  ix.questions.forEach((q) => { if (q.m) push(ix.questionsOfField, q.m, q.id); });
  (K.syn || []).forEach((group) => {
    const words = group.flatMap((g) => String(g).toLowerCase().split(' ')).filter((w) => w.length > 2);
    group.forEach((g) => { const w = String(g).toLowerCase(); if (!w.includes(' ')) ix.syn.set(w, [...new Set([...(ix.syn.get(w) || []), ...words.filter((x) => x !== w)])]); });
  });
  (M.glossary || []).forEach((t) => (t.aka || []).forEach((a) => {
    const w = a.toLowerCase();
    if (!w.includes(' ')) ix.syn.set(w, [...new Set([...(ix.syn.get(w) || []), ...t.t.toLowerCase().split(' ')])]);
  }));

  // does this node reach a dashboard within a few steps?
  const reach = new Map();
  const reaches = (id, depth) => {
    if (reach.has(id)) return reach.get(id);
    if (depth > 6) return false;
    const n = ix.node.get(id);
    if (!n) return false;
    let r = n.k === 'dashboard';
    if (!r) r = (ix.down.get(id) || []).some((d) => reaches(d, depth + 1));
    reach.set(id, r);
    return r;
  };

  const ownerOf = (id, f) => {
    const terms = f ? (ix.termsOfField.get(id) || []) : [];
    const t = terms.map((x) => ix.term.get(x)).find((x) => x && x.own);
    if (t) return t.own;
    const p = (ix.prodOf.get(id) || []).map((x) => ix.product.get(x))[0];
    if (p) return p.own || p.sown;
    const n = ix.node.get(id);
    return (n && n.owner) || '';
  };

  // search documents, each with its facet values
  M.nodes.forEach((n) => {
    ix.docs.push({
      id: n.id, type: n.k, layer: layerOf(n), dom: n.dom, title: titleOf(n), name: n.name,
      sub: n.k === 'explore' ? n.name : (n.rel || n.label || ''), d: n.d || '',
      hay: `${n.name} ${n.label || ''} ${n.rel || ''} ${n.d || ''} ${(n.tags || []).join(' ')} ${n.sys || ''}`.toLowerCase(),
      boost: (n.k === 'explore' ? 3 : 0) + (n.k === 'dashboard' ? 5 : 0) + (n.layer === 'warehouse' ? 2 : 0) + (n.k === 'view' ? 1 : 0),
      doc: !!n.d, used: reaches(n.id, 0), prod: ix.prodOf.get(n.id) || [], own: ownerOf(n.id, false), chg: n.chg || '',
    });
  });
  M.fields.forEach((f) => {
    if (f.k === 'parameter' || f.k === 'filter') return;
    const terms = ix.termsOfField.get(f.id) || [];
    ix.docs.push({
      id: f.id, type: f.k, layer: f.k, dom: f.dom, title: fieldTitle(f), name: f.n, sub: f.id, d: f.d || '', hid: !!f.hid,
      hay: `${f.n} ${f.l || ''} ${f.id} ${f.d || ''} ${f.g || ''} ${terms.join(' ')}`.toLowerCase(),
      boost: (f.k === 'measure' ? 3 : 0) + (f.dash.length ? 4 : 0) + (terms.length ? 6 : 0) + ((ix.prodOf.get(f.id) || []).length ? 4 : 0) - (f.hid ? 6 : 0),
      doc: !!f.d, used: f.dash.length > 0, prod: ix.prodOf.get(f.id) || [], own: ownerOf(f.id, true), terms,
    });
  });
  (M.glossary || []).forEach((t) => ix.docs.push({
    id: t.t, type: 'term', layer: 'term', dom: t.dom, title: t.t, name: t.t, sub: (t.aka || []).join(', '), d: t.d,
    hay: `${t.t} ${(t.aka || []).join(' ')} ${t.d}`.toLowerCase(), boost: 30, doc: true, used: true,
    prod: [...new Set(t.m.flatMap((m) => ix.prodOf.get(m) || []))], own: t.own || '',
  }));
  (K.products || []).forEach((p) => ix.docs.push({
    id: `product:${p.id}`, type: 'product', layer: 'product', dom: '', title: p.name, name: p.name, sub: 'Data product', d: p.d,
    hay: `${p.name} ${p.d} ${(p.use || []).join(' ')}`.toLowerCase(), boost: 32, doc: true, used: true, prod: [p.id], own: p.own || p.sown || '',
  }));
  ix.rules.forEach((r) => ix.docs.push({
    id: `rule:${r.id}`, type: 'rule', layer: 'rule', dom: '', title: r.t, name: r.t, sub: 'Business rule', d: r.d,
    hay: `${r.t} ${r.d} ${r.terms.join(' ')}`.toLowerCase(), boost: 14, doc: true, used: true,
    prod: [...new Set(r.m.flatMap((m) => ix.prodOf.get(m) || []))], own: r.own || '',
  }));
  ix.questions.forEach((q) => ix.docs.push({
    id: `question:${q.id}`, type: 'question', layer: 'question', dom: '', title: q.q, name: q.q, sub: 'Verified question', d: q.a,
    hay: `${q.q} ${q.a} ${(q.also || []).join(' ')}`.toLowerCase(), boost: 16, doc: true, used: true,
    prod: q.m ? (ix.prodOf.get(q.m) || []) : [], own: '',
  }));
  ix.docs.forEach((d) => indexWords(ix, `${d.title} ${d.name}`));
  return ix;
}

function indexWords(ix, text) {
  String(text).toLowerCase().split(/[^a-z0-9]+/).forEach((w) => { if (w.length > 2) ix.vocab.set(w, (ix.vocab.get(w) || 0) + 1); });
}

/* Column-level documents, built the first time a search needs them. */
function columnDocs() {
  if (IX.colDocs) return IX.colDocs;
  const out = [];
  IX.node.forEach((n) => {
    if (!['source', 'seed', 'table', 'model', 'snapshot'].includes(n.k)) return;
    n.cols.forEach((c) => {
      if (c.gone) return;
      out.push({
        id: `col:${n.id}:${c.n}`, node: n.id, type: 'column', layer: layerOf(n), dom: n.dom, title: c.n, name: c.n,
        sub: `${n.name}${c.ty ? ` · ${c.ty}` : ''}`, d: c.d || '', hay: `${c.n} ${c.d || ''}`.toLowerCase(),
        boost: (n.layer === 'warehouse' ? 3 : 0) + (c.doc ? 2 : 0), doc: !!c.doc, used: (c.used || []).length > 0,
        prod: IX.prodOf.get(n.id) || [], own: '',
      });
    });
  });
  IX.colDocs = out;
  return out;
}

function invertRel(r) {
  if (r === 'many_to_one') return 'one_to_many';
  if (r === 'one_to_many') return 'many_to_one';
  return r;
}
const REL_TEXT = { many_to_one: 'many to one', one_to_many: 'one to many', one_to_one: 'one to one', many_to_many: 'many to many' };
const REL_GLYPH = { many_to_one: 'n : 1', one_to_many: '1 : n', one_to_one: '1 : 1', many_to_many: 'n : n' };

/* ------------------------------------------------------------------ search engine */

const TYPE_GROUP = {
  measure: 'metric', dimension: 'dimension', source: 'table', seed: 'table', table: 'table', model: 'table', snapshot: 'table',
  view: 'view', explore: 'explore', dashboard: 'dashboard', udd: 'dashboard', term: 'term', product: 'product', rule: 'rule',
  question: 'question', column: 'column',
};
const TYPE_FACETS = [['metric', 'Metrics'], ['dashboard', 'Dashboards'], ['table', 'Tables'], ['explore', 'Explores'], ['view', 'Looker views'],
  ['dimension', 'Dimensions'], ['column', 'Columns'], ['term', 'Glossary terms'], ['product', 'Data products'], ['question', 'Verified questions'], ['rule', 'Business rules']];
const TYPE_WORDS = {
  table: 'table', tables: 'table', metric: 'metric', metrics: 'metric', measure: 'metric', measures: 'metric', kpis: 'metric',
  dimension: 'dimension', dimensions: 'dimension', dashboard: 'dashboard', dashboards: 'dashboard', explore: 'explore', explores: 'explore',
  view: 'view', views: 'view', column: 'column', columns: 'column', term: 'term', terms: 'term', glossary: 'term', rule: 'rule', rules: 'rule',
  question: 'question', questions: 'question', product: 'product', products: 'product',
};
const LAYER_WORDS = { source: 'source', sources: 'source', raw: 'source', staging: 'staging', integration: 'integration', warehouse: 'warehouse', seed: 'seed', seeds: 'seed', external: 'external' };
const STOP = new Set('the a an of for our we is are do does did what how which who why when show me list all with by to this that find get give tell about and or in on from where there any can i you my us its it be was were has have had should would will much many each per me these those'.split(' '));
const QUESTION_START = /^(what|how|which|who|why|when|is|are|do|does|did|can|should|where)$/;

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* Spelling variants (British and US), plurals and glossary synonyms for one word. */
function variants(t) {
  const out = new Set([t]);
  [['isation', 'ization'], ['ised', 'ized'], ['ising', 'izing'], ['ise', 'ize'], ['yse', 'yze']].forEach(([a, b]) => {
    if (t.endsWith(a)) out.add(t.slice(0, -a.length) + b);
    if (t.endsWith(b)) out.add(t.slice(0, -b.length) + a);
  });
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) out.add(t.slice(0, -1));
  (IX.syn.get(t) || []).forEach((w) => out.add(w));
  return [...out];
}

function knownWord(t) {
  if (IX.vocab.has(t)) return true;
  if (variants(t).some((v) => IX.vocab.has(v))) return true;
  for (const w of IX.vocab.keys()) if (w.startsWith(t) || (t.length >= 5 && w.includes(t))) return true;
  return false;
}

function correctWord(t) {
  if (t.length < 4 || /\d/.test(t) || knownWord(t)) return null;
  const max = t.length >= 8 ? 2 : 1;
  let best = null;
  IX.vocab.forEach((freq, w) => {
    if (Math.abs(w.length - t.length) > max) return;
    const d = lev(t, w, max);
    if (d <= max && (!best || d < best.d || (d === best.d && freq > best.f))) best = { w, d, f: freq };
  });
  return best ? best.w : null;
}

function findDomain(text) {
  const t = text.trim().toLowerCase();
  if (!t) return '';
  for (const d of IX.domain.values()) {
    const label = d.label.toLowerCase();
    if (d.id === t || label === t || label.startsWith(`${t} `) || label.split(' ')[0] === t) return d.id;
  }
  if (t === 'clients' || t === 'crm' || t === 'contacts') return 'crm';
  return '';
}

function findDashboard(text, usage) {
  const t = text.trim().toLowerCase().replace(/ dashboard$/, '');
  if (t.length < 3) return null;
  const cands = [];
  IX.node.forEach((n) => { if (n.k === 'dashboard') cands.push({ key: n.id, title: titleOf(n) }); });
  ((usage && usage.dashboards) || []).forEach((d) => cands.push({ key: `udd.${d.id}`, title: d.title }));
  let best = null;
  cands.forEach((c) => {
    const title = c.title.toLowerCase();
    let s = 0;
    if (title === t) s = 100;
    else if (title.startsWith(t)) s = 80;
    else if (title.includes(t)) s = 60;
    else {
      const tw = t.split(' ').filter((w) => w.length > 2);
      const hit = tw.filter((w) => title.includes(w)).length;
      if (tw.length && hit / tw.length >= 0.6) s = 40 * (hit / tw.length);
    }
    if (s && (!best || s > best.s || (s === best.s && c.key.startsWith('dashboard.')))) best = { ...c, s };
  });
  return best;
}

/* Turn a typed query into words and filters. */
function parseQuery(raw, usage) {
  const original = String(raw || '').trim();
  let q = ` ${original.toLowerCase().replace(/[?!,;"“”]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const f = {};
  const chips = [];
  let intent = '';
  let subject = '';
  if (/^\s*sql\s*:/.test(q)) {
    f.sql = original.replace(/^\s*sql\s*:/i, '').trim();
    return { terms: [], f, chips: [['sql', `SQL contains “${f.sql}”`]], intent: 'sql', subject: f.sql, original };
  }
  if (/^\s*columns?\s*:/.test(q)) { f.type = 'column'; q = q.replace(/^\s*columns?\s*:/, ' '); }
  let m = q.match(/ where (?:does|do|did) (?:the )?(.+?) (?:number |figure )?come from /)
    || q.match(/ how (?:is|are) (?:the )?(.+?) (?:calculated|worked out|defined|derived|measured) /)
    || q.match(/ how (?:do|does) (?:we|you|it) (?:calculate|work out|measure) (?:the )?(.+?) $/)
    || q.match(/ (?:lineage (?:of|for)|trace|source of|sources of|derivation of) (?:the )?(.+?) $/);
  if (m) { intent = 'lineage'; subject = m[1].trim(); q = ` ${subject} `; }
  const undoc = / (undocumented|undescribed|without (?:a )?descriptions?|with no descriptions?|no descriptions?|missing (?:a )?descriptions?|not documented|not described) /;
  if (undoc.test(q)) { f.doc = 'no'; q = q.replace(undoc, ' '); }
  else if (/ (documented|described|certified) /.test(q)) { f.doc = 'yes'; q = q.replace(/ (documented|described|certified) /, ' '); }
  m = q.match(/ (?:used (?:in|on|by)|shown (?:in|on)|that feed|on) (?:the )?(.+?) $/);
  if (m) {
    const dsh = findDashboard(m[1], usage);
    if (dsh) { f.dash = dsh.key; chips.push(['dash', `Used on ${dsh.title}`]); q = q.replace(m[0], ' '); }
  }
  m = q.match(/ owned by (.+?) $/);
  if (m) { f.owner = m[1].trim(); chips.push(['owner', `Owner: ${f.owner}`]); q = q.replace(m[0], ' '); }
  m = q.match(/ in (?:the )?([a-z ]+?) (?:domain )?$/);
  if (m) { const dom = findDomain(m[1]); if (dom) { f.dom = dom; q = q.replace(m[0], ' '); } }
  const words = q.trim().split(' ').filter(Boolean);
  const isQuestion = !intent && (QUESTION_START.test(words[0] || '') || original.endsWith('?'));
  const rest = [];
  words.forEach((w) => {
    if (!f.type && TYPE_WORDS[w]) { f.type = TYPE_WORDS[w]; return; }
    if (!f.layer && LAYER_WORDS[w] && (f.type === 'table' || words.includes('tables') || words.includes('table'))) { f.layer = LAYER_WORDS[w]; f.type = 'table'; return; }
    rest.push(w);
  });
  if (isQuestion) intent = 'question';
  const terms = rest.filter((w) => !STOP.has(w) && w.length > 1);
  return { terms, f, chips, intent, subject, original, isQuestion };
}

function fieldOnDashboard(fid, key, usage) {
  if (key.startsWith('dashboard.')) return (IX.field.get(fid)?.dash || []).includes(key);
  const s = usage && usage.fieldDash.get(fid);
  return !!(s && s.has(key.slice(4)));
}

function passes(d, f, usage, skip = '') {
  if (f.type && skip !== 'type' && TYPE_GROUP[d.type] !== f.type) return false;
  if (f.layer && skip !== 'layer' && d.layer !== f.layer) return false;
  if (f.dom && skip !== 'dom' && d.dom !== f.dom) return false;
  if (f.doc && skip !== 'doc' && (d.doc ? 'yes' : 'no') !== f.doc) return false;
  if (f.used && skip !== 'used' && (d.used || (usage && usage.fieldDash.has(d.id)) ? 'yes' : 'no') !== f.used) return false;
  if (f.prod && skip !== 'prod' && !(d.prod || []).includes(f.prod)) return false;
  if (f.owner && skip !== 'owner' && !String(d.own || '').toLowerCase().includes(String(f.owner).toLowerCase())) return false;
  if (f.dash && skip !== 'dash' && !(IX.field.has(d.id) && fieldOnDashboard(d.id, f.dash, usage))) return false;
  if (f.hideHidden && d.hid) return false;
  if (f.knowledge && !['term', 'product', 'question', 'rule'].includes(d.type)) return false;
  return true;
}

function scoreDoc(d, groups) {
  let score = 0;
  const name = d.name.toLowerCase();
  const title = d.title.toLowerCase();
  for (const g of groups) {
    let best = 0;
    g.forEach((v, i) => {
      const w = i === 0 ? 1 : 0.75;
      let s = 0;
      if (name === v || title === v) s = 60;
      else if (name.startsWith(v) || title.startsWith(v)) s = 32;
      else if (new RegExp(`(^|[^a-z0-9])${escapeRe(v)}`).test(title) || name.includes(`_${v}`)) s = 26;
      else if (name.includes(v) || title.includes(v)) s = 16;
      else if (d.hay.includes(v)) s = 5;
      best = Math.max(best, s * w);
    });
    if (!best) return 0;
    score += best;
  }
  return score;
}

/* The full search: parse, correct, expand, score, then facet. */
function runSearch(raw, extra = {}, usage = null) {
  const parsed = parseQuery(raw, usage);
  const f = { ...parsed.f, ...extra };
  const corrections = [];
  const exact = /^["“].*["”]$/.test(String(raw || '').trim());
  const terms = parsed.terms.map((t) => { const c = exact ? null : correctWord(t); if (c) { corrections.push([t, c]); return c; } return t; });
  const groups = terms.map((t) => variants(t));
  const hlTerms = [...new Set(groups.flat())].filter((t) => t.length > 1);
  // glossary phrases in the query boost the metrics that calculate them
  const qtext = ` ${terms.join(' ')} `;
  const termHits = (META.glossary || []).filter((t) => [t.t, ...(t.aka || [])].some((p) => {
    const words = p.toLowerCase().split(' ');
    return words.every((w) => groups.some((g) => g.includes(w))) || qtext.includes(` ${p.toLowerCase()} `);
  }));
  const termMetric = new Set(termHits.flatMap((t) => t.m));
  const relatedTerms = !termHits.length && terms.length === 1 ? (META.glossary || []).filter((t) => t.t.toLowerCase().split(' ').some((w) => groups[0].includes(w))) : [];
  relatedTerms.forEach((t) => t.m.forEach((m) => termMetric.add(m)));
  let pool = IX.docs;
  if (usage && usage.dashboards) pool = pool.concat(uddDocs(usage));
  if (f.type === 'column' || (terms.length && terms.some((t) => t.length >= 3) && !f.type)) pool = pool.concat(columnDocs());
  const scored = [];
  for (const d of pool) {
    if (f.sql) continue;
    let s;
    if (groups.length) {
      s = scoreDoc(d, groups);
      if (!s) continue;
    } else {
      if (!Object.keys(f).some((k) => f[k] && k !== 'hideHidden')) continue;
      s = 1;
    }
    if (d.type === 'column') s *= 0.6;
    const used = USAGE_BOOST.get(d.id) || (usage && d.type === 'udd' ? d.runs : 0) || 0;
    s += d.boost + (used ? Math.min(20, Math.log10(used + 1) * 5) : 0) + (termMetric.has(d.id) ? 40 : 0) + (termHits.some((t) => t.t === d.id) ? 50 : 0) - Math.min(d.name.length, 40) / 25;
    scored.push({ d, s });
  }
  if (f.sql) {
    const needle = f.sql.toLowerCase();
    IX.field.forEach((fl) => { if ((fl.sql || '').toLowerCase().includes(needle)) { const d = IX.docs.find((x) => x.id === fl.id); if (d) scored.push({ d, s: 10 + d.boost, snip: snippet(fl.sql, needle) }); } });
    IX.node.forEach((n) => { const sql = n.sql || n.derived || ''; if (sql.toLowerCase().includes(needle)) { const d = IX.docs.find((x) => x.id === n.id); if (d) scored.push({ d, s: 8 + d.boost, snip: snippet(sql, needle) }); } });
  }
  scored.sort((a, b) => b.s - a.s);
  const results = scored.filter((x) => passes(x.d, f, usage));
  const facets = {};
  const count = (key, valFn, skipKey) => {
    const m = new Map();
    scored.forEach((x) => { if (!passes(x.d, f, usage, skipKey)) return; [].concat(valFn(x.d)).forEach((v) => { if (v !== '' && v !== undefined && v !== null) m.set(v, (m.get(v) || 0) + 1); }); });
    facets[key] = m;
  };
  count('type', (d) => TYPE_GROUP[d.type], 'type');
  count('dom', (d) => d.dom, 'dom');
  count('layer', (d) => (TYPE_GROUP[d.type] === 'table' ? d.layer : ''), 'layer');
  count('prod', (d) => d.prod || [], 'prod');
  count('owner', (d) => d.own || '', 'owner');
  count('doc', (d) => (d.doc ? 'yes' : 'no'), 'doc');
  count('used', (d) => (d.used || (usage && usage.fieldDash.has(d.id)) ? 'yes' : 'no'), 'used');
  const answer = buildAnswer(parsed, terms, groups, results, usage, termHits.length ? termHits : relatedTerms);
  return { parsed, f, terms, corrections, results, facets, answer, hlTerms, termHits: termHits.length ? termHits : relatedTerms };
}

function snippet(text, needle) {
  const s = String(text);
  const i = s.toLowerCase().indexOf(needle);
  const a = Math.max(0, i - 50);
  return `${a ? '…' : ''}${s.slice(a, i + needle.length + 70).replace(/\s+/g, ' ')}${i + needle.length + 70 < s.length ? '…' : ''}`;
}

function uddDocs(usage) {
  if (usage._docs) return usage._docs;
  usage._docs = usage.dashboards.map((d) => ({
    id: `udd.${d.id}`, type: 'udd', layer: 'dashboard', dom: '', title: d.title, name: d.title, sub: `Looker dashboard ${d.id}`,
    d: `Built in Looker. ${d.fields.size} fields from ${d.explores.size} explores.`, hay: `${d.title} ${[...d.explores].join(' ')}`.toLowerCase(),
    boost: 6, doc: false, used: true, prod: [...IX.product.values()].filter((p) => p.lds.includes(d.id)).map((p) => p.id),
    own: '', runs: d.runs,
  }));
  return usage._docs;
}

/* An answer card for questions and "where does X come from". */
function buildAnswer(parsed, terms, groups, results, usage, termHits = []) {
  if (parsed.intent === 'lineage') {
    if (termHits.length) {
      const t = termHits[0];
      const words = t.t.toLowerCase().split(' ').flatMap((w) => [w, w.replace(/is(ation|ed|e)$/, 'iz$1'), w.replace(/iz(ation|ed|e)$/, 'is$1')]).filter((w) => w.length > 3);
      const named = (fid) => { const f = IX.field.get(fid); const txt = `${f.n} ${f.l || ''}`.toLowerCase(); return words.some((w) => txt.includes(w.slice(0, Math.max(5, w.length - 3)))); };
      const cands = t.m.filter((m) => IX.field.has(m));
      const rank = (fid) => (named(fid) ? 10 : 0) - (/target|budget|forecast/.test(fid) ? 4 : 0) + Math.min(5, Math.log10((USAGE_BOOST.get(fid) || 0) + 1));
      const best = cands.sort((a, b) => rank(b) - rank(a))[0];
      if (best) return { kind: 'lineage', field: best, term: t.t };
    }
    const m = results.find((x) => x.d.type === 'measure') || results.find((x) => x.d.type === 'dimension');
    return m ? { kind: 'lineage', field: m.d.id } : null;
  }
  if (!terms.length) return null;
  let best = null;
  IX.questions.forEach((q) => {
    const words = new Set(`${q.q} ${(q.also || []).join(' ')}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
    const hit = groups.filter((g) => g.some((v) => words.has(v) || [...words].some((w) => w.startsWith(v) && v.length > 3))).length;
    const score = hit / groups.length;
    if (score > (best ? best.score : 0)) best = { q, score };
  });
  if (best && (best.score >= 0.67 || (parsed.intent === 'question' && best.score >= 0.5))) return { kind: 'question', question: best.q.id };
  if (parsed.intent === 'question') {
    const m = results.find((x) => x.d.type === 'measure');
    if (m) return { kind: 'metric', field: m.d.id };
  }
  return null;
}

/* Backwards-compatible helper: a ranked list of documents. */
function search(q, opts = {}) {
  const extra = {};
  if (opts.type === 'tables') extra.type = 'table';
  if (opts.dom && opts.dom !== 'all') extra.dom = opts.dom;
  if (opts.hideHidden) extra.hideHidden = true;
  return runSearch(q, extra).results.map((x) => x.d).filter((d) => d.type !== 'column');
}


function hl(text, terms) {
  const s = String(text || '');
  const ts = (terms || []).filter((t) => t && t.length > 1).sort((a, b) => b.length - a.length);
  if (!ts.length || !s) return s;
  const parts = s.split(new RegExp(`((?<![A-Za-z0-9])(?:${ts.map(escapeRe).join('|')}))`, 'ig'));
  return parts.map((part, i) => (i % 2 ? html`<mark>${part}</mark>` : part));
}

/* Upstream chain of a node, as a list of ids, nearest first. */
function upstreamChain(id, maxDepth = 6) {
  const seen = new Set([id]);
  const out = [];
  let frontier = [id];
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next = [];
    frontier.forEach((x) => (IX.node.get(x)?.up || []).forEach((u) => { if (!seen.has(u)) { seen.add(u); out.push({ id: u, depth: depth + 1 }); next.push(u); } }));
    frontier = next;
  }
  return out;
}

function physicalNodeOfView(viewName) {
  const v = IX.node.get(`view.${viewName}`);
  if (!v) return null;
  for (const u of v.up) {
    const n = IX.node.get(u);
    if (!n) continue;
    if (n.k === 'view') return physicalNodeOfView(n.name);
    return n;
  }
  return null;
}

/* ------------------------------------------------------------------ graph layout */

function layoutLineage(focus, upHops, downHops) {
  const ids = new Set([focus]);
  let truncated = false;
  const walk = (start, hops, dir) => {
    let frontier = [start];
    for (let h = 0; h < hops && frontier.length; h += 1) {
      const next = [];
      for (const id of frontier) {
        const nbrs = dir === 'up' ? (IX.node.get(id)?.up || []) : (IX.down.get(id) || []);
        for (const n of nbrs) {
          if (ids.has(n) || !IX.node.has(n)) continue;
          if (ids.size >= MAX_GRAPH) { truncated = true; break; }
          ids.add(n); next.push(n);
        }
      }
      frontier = next;
    }
  };
  walk(focus, upHops, 'up');
  walk(focus, downHops, 'down');
  return layoutSet(ids, truncated);
}

/* Lay out any set of assets left to right by lineage depth. */
function layoutSet(ids, truncated = false) {
  const edges = [];
  ids.forEach((id) => (IX.node.get(id).up || []).forEach((u) => { if (ids.has(u)) edges.push({ from: u, to: id }); }));
  // rank = longest path from a root inside the subgraph
  const rank = new Map();
  const visiting = new Set();
  const rk = (id) => {
    if (rank.has(id)) return rank.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let r = 0;
    (IX.node.get(id).up || []).forEach((u) => { if (ids.has(u)) r = Math.max(r, rk(u) + 1); });
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  ids.forEach(rk);
  // explores and dashboards line up in their own columns, after everything they read
  ['explore', 'dashboard'].forEach((kind) => {
    const of = [...ids].filter((id) => IX.node.get(id).k === kind);
    if (!of.length) return;
    const r = Math.max(...of.map((id) => rank.get(id)));
    of.forEach((id) => rank.set(id, r));
    ids.forEach((id) => { if (IX.node.get(id).k === 'dashboard' && kind === 'explore') rank.set(id, Math.max(rank.get(id), r + 1)); });
  });
  const cols = new Map();
  ids.forEach((id) => push(cols, rank.get(id), id));
  const maxRank = Math.max(...cols.keys());
  for (let r = 0; r <= maxRank; r += 1) {
    const c = cols.get(r) || [];
    c.sort((a, b) => (LAYERS[layerOf(IX.node.get(a))]?.rank || 0) - (LAYERS[layerOf(IX.node.get(b))]?.rank || 0) || titleOf(IX.node.get(a)).localeCompare(titleOf(IX.node.get(b))));
    cols.set(r, c);
  }
  const pos = () => { const m = new Map(); cols.forEach((c) => c.forEach((id, i) => m.set(id, i))); return m; };
  for (let pass = 0; pass < 3; pass += 1) {
    let p = pos();
    for (let r = 1; r <= maxRank; r += 1) {
      const c = cols.get(r) || [];
      const bc = (id) => { const ups = (IX.node.get(id).up || []).filter((u) => ids.has(u)); return ups.length ? ups.reduce((s, u) => s + p.get(u), 0) / ups.length : p.get(id); };
      c.sort((a, b) => bc(a) - bc(b));
    }
    p = pos();
    for (let r = maxRank - 1; r >= 0; r -= 1) {
      const c = cols.get(r) || [];
      const bc = (id) => { const ds = (IX.down.get(id) || []).filter((d) => ids.has(d)); return ds.length ? ds.reduce((s, d) => s + p.get(d), 0) / ds.length : p.get(id); };
      c.sort((a, b) => bc(a) - bc(b));
    }
  }
  const W = 232; const H = 50; const GX = 72; const GY = 14;
  const tallest = Math.max(...[...cols.values()].map((c) => c.length));
  const nodes = [];
  cols.forEach((c, r) => {
    const offset = ((tallest - c.length) * (H + GY)) / 2;
    c.forEach((id, i) => nodes.push({ id, x: r * (W + GX), y: offset + i * (H + GY), w: W, h: H }));
  });
  return { nodes, edges, width: (maxRank + 1) * (W + GX) - GX, height: tallest * (H + GY) - GY, truncated, count: ids.size };
}

/* Explore join diagram: base view on the left, each join to the right of the view it joins on. */
function layoutJoins(ex) {
  const joins = ex.joins || [];
  const a2v = IX.aliasToView.get(ex.name) || {};
  const parent = new Map();
  joins.filter((j) => !j.base).forEach((j) => {
    const partners = [...new Set((j.refs || []).map((r) => r.split('.')[0]).filter((a) => a !== j.a && a2v[a]))];
    parent.set(j.a, partners[0] || ex.base);
  });
  const children = new Map();
  parent.forEach((p, c) => push(children, p, c));
  const keyFields = new Map();
  joins.forEach((j) => (j.refs || []).forEach((r) => { const [a, f] = r.split('.'); if (!keyFields.has(a)) keyFields.set(a, new Set()); keyFields.get(a).add(f); }));
  const W = 236; const GX = 120; const GY = 18;
  const hOf = (a) => 46 + Math.min((keyFields.get(a) || new Set()).size, 4) * 20 + 10 + ((a2v[a] && a2v[a] !== a) ? 16 : 0);
  const nodes = [];
  let cursor = 0;
  const seen = new Set();
  const place = (a, depth) => {
    if (seen.has(a)) return null;
    seen.add(a);
    const kids = (children.get(a) || []).filter((k) => !seen.has(k));
    const h = hOf(a);
    const placed = kids.map((k) => place(k, depth + 1)).filter(Boolean);
    let y;
    if (placed.length) {
      y = (placed[0].y + placed[placed.length - 1].y + placed[placed.length - 1].h) / 2 - h / 2;
      y = Math.max(y, cursor === 0 ? 0 : y);
    } else { y = cursor; cursor += h + GY; }
    const node = { id: a, view: a2v[a] || a, x: depth * (W + GX), y, w: W, h, keys: [...(keyFields.get(a) || [])].slice(0, 4), more: Math.max(0, (keyFields.get(a) || new Set()).size - 4) };
    nodes.push(node);
    return node;
  };
  place(ex.base, 0);
  joins.forEach((j) => { if (!seen.has(j.a)) place(j.a, 1); });
  const minY = Math.min(...nodes.map((n) => n.y));
  nodes.forEach((n) => { n.y -= minY; });
  const edges = joins.filter((j) => !j.base).map((j) => ({ from: parent.get(j.a), to: j.a, join: j }));
  const width = Math.max(...nodes.map((n) => n.x + n.w));
  const height = Math.max(...nodes.map((n) => n.y + n.h));
  return { nodes, edges, width, height };
}

/* Neighbourhood diagram for one view: the views it is joined to, across all explores. */
function layoutNeighbours(viewName) {
  const rels = IX.joinsByView.get(viewName) || [];
  const partners = new Map();
  rels.forEach((r) => { if (r.other !== viewName && !partners.has(r.other)) partners.set(r.other, r); });
  const list = [...partners.values()].slice(0, 24);
  const W = 230; const H = 52; const GY = 12; const GX = 150;
  const left = list.filter((_, i) => i % 2 === 1);
  const right = list.filter((_, i) => i % 2 === 0);
  const colH = (c) => c.length * (H + GY) - GY;
  const height = Math.max(colH(left), colH(right), H);
  const nodes = [{ id: viewName, view: viewName, x: left.length ? W + GX : 0, y: height / 2 - H / 2, w: W, h: H, center: true }];
  const cx = nodes[0].x;
  const edges = [];
  const placeCol = (c, x) => c.forEach((r, i) => {
    const y = (height - colH(c)) / 2 + i * (H + GY);
    nodes.push({ id: r.other, view: r.other, x, y, w: W, h: H, rel: r });
    edges.push(x > cx ? { from: viewName, to: r.other, rel: r } : { from: r.other, to: viewName, rel: r, flip: true });
  });
  placeCol(left, 0);
  placeCol(right, cx + W + GX);
  return { nodes, edges, width: Math.max(...nodes.map((n) => n.x + n.w)), height, more: Math.max(0, partners.size - list.length) };
}

function edgePath(a, b) {
  const x1 = a.x + a.w; const y1 = a.y + a.h / 2;
  const x2 = b.x; const y2 = b.y + b.h / 2;
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

/* ------------------------------------------------------------------ the app */

export class RaDataCatalog extends DataApp {
  static properties = {
    route: { type: Object },
    q: { type: String },
    _ready: { type: Boolean },
    _error: { type: String },
    _tick: { type: Number },
    sType: { type: String },
    sDom: { type: String },
    sHidden: { type: Boolean },
    tLayer: { type: String },
    tDom: { type: String },
    tQ: { type: String },
    tUndoc: { type: Boolean },
    tLimit: { type: Number },
    lTab: { type: String },
    lQ: { type: String },
    mQ: { type: String },
    mDom: { type: String },
    mScope: { type: String },
    mLimit: { type: Number },
    mSort: { type: String },
    colQ: { type: String },
    colDoc: { type: String },
    colSort: { type: String },
    lgFocus: { type: String },
    lgUp: { type: Number },
    lgDown: { type: Number },
    lgSel: { type: String },
    lgHover: { type: String },
    lgPick: { type: String },
    erdSel: { type: String },
    treeOpen: { type: Object },
    _sugIdx: { type: Number },
    _sugOpen: { type: String },
    _resIdx: { type: Number },
    _scope: { type: String },
    hGroup: { type: String },
    rF: { type: Object },
    uSel: { type: String },
    kgHops: { type: Number },
    kgPath: { type: Array },
    kgOver: { type: String },
    kgHull: { type: Boolean },
    kgRecent: { type: Boolean },
    kgPreset: { type: String },
    hSel: { type: String },
    sf: { type: Object },
    sLimit: { type: Number },
    kgFocus: { type: String },
    kgSel: { type: String },
    kgF: { type: Object },
    _recentQ: { type: Array },
    _recentV: { type: Array },
    _usage: { type: Object },
  };

  constructor() {
    super();
    this.lookerModel = 'system__activity';
    this.explore = 'history';
    this.route = { view: 'home', id: '', tab: '' };
    this._history = [];
    this.q = '';
    this._ready = false;
    this._error = '';
    this._tick = 0;
    this.sType = 'all';
    this.sDom = 'all';
    this.sHidden = true;
    this.tLayer = 'all';
    this.tDom = 'all';
    this.tQ = '';
    this.tUndoc = false;
    this.tLimit = PAGE;
    this.lTab = 'explores';
    this.lQ = '';
    this.mQ = '';
    this.mDom = 'all';
    this.mScope = 'key';
    this.mLimit = PAGE;
    this.mSort = 'used';
    this.colQ = '';
    this.colDoc = 'all';
    this.colSort = 'table';
    this.lgFocus = '';
    this.lgUp = 2;
    this.lgDown = 2;
    this.lgSel = '';
    this.lgHover = '';
    this.lgPick = '';
    this.erdSel = '';
    this.treeOpen = new Set();
    this._sugIdx = 0;
    this._sugOpen = false;
    this._resIdx = -1;
    this._scope = 'all';
    this.hGroup = 'overall';
    this.rF = { dom: '', prod: '' };
    this.uSel = '';
    this.kgHops = 2;
    this.kgPath = null;
    this.kgOver = '';
    this.kgHull = true;
    this.kgRecent = false;
    this.kgPreset = '';
    this.hSel = '';
    this.sf = {};
    this.sLimit = 50;
    this.kgFocus = '';
    this.kgSel = '';
    this.kgF = { dom: '', prod: '', kinds: ['term', 'product', 'metric'] };
    this._recentQ = [];
    this._recentV = [];
    this._copied = '';
    this._toastMsg = '';
    this._usage = { state: 'loading', fields: new Map(), explores: new Map(), dashboards: [], fieldDash: new Map(), dashFields: new Map() };
    this._view = new Map();
    this._pendingFit = new Set();
    this._onKey = this._onKey.bind(this);
  }

  /* Dashboard filters and cross-filters, plus the usage window, for every System Activity widget. */
  getEffectiveFilters(local = {}) {
    const filters = { ...(this.dashboardFilters || {}), ...(this.crossFilters || {}) };
    return { ...filters, ...local };
  }

  /* field_usage has no query.view; translate an explore cross-filter to its own field. */
  _fieldUsageFilters() {
    const cf = this.crossFilters || {};
    const out = { 'field_usage.model': this._model() };
    if (cf['query.view']) out['field_usage.explore'] = cf['query.view'];
    return out;
  }

  _model() { return (META && META.model) || 'analytics'; }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._onKey);
    if (!this._fontStyle && FONT_CSS) {
      this._fontStyle = document.createElement('style');
      this._fontStyle.textContent = FONT_CSS;
      this.appendChild(this._fontStyle);
    }
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._onKey);
    if (this._usageCtrl) this._usageCtrl.abort();
    super.disconnectedCallback();
  }

  firstUpdated() {
    // The latest build comes from BigQuery (explore catalog_snapshot); the copy built into the app is the fallback.
    const remote = this._loadRemote();
    const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), 6000); });
    Promise.race([remote, timeout]).then(async (r) => {
      if (r) { META = r.meta; this._source = { kind: 'live', time: r.time }; } else { await loadMeta(); this._source = { kind: 'builtin', time: META.built }; }
      IX = buildIndex(META);
      this._ready = true;
      this._applyHash();
      this._loadUsage();
      if (!r) {
        remote.then((late) => {
          if (!late) return;
          META = late.meta; IX = buildIndex(META);
          this._countsCache = null; this._domCache = null; this._healthCache = null; this._pstat = null; this._quickKey = null; this._plCache = null; this._hrCache = null; this._kg = null; this._pfCache = null;
          this._source = { kind: 'live', time: late.time };
          this.requestUpdate();
        });
      }
    }).catch((err) => {
      this._error = String((err && err.message) || err);
      console.warn('[data-catalog] could not unpack the catalog', err);
    });
  }

  async _loadRemote() {
    try {
      // The model name comes from the built-in copy, so a client whose model is not called "analytics" still finds its live catalog.
      const builtin = META || await loadMeta().catch(() => null);
      const rows = await this.runQuery({
        model: (builtin && builtin.model) || 'analytics', explore: 'catalog_snapshot',
        fields: ['catalog_snapshot.chunk_index', 'catalog_snapshot.chunk', 'catalog_snapshot.built_time', 'catalog_snapshot.source_versions'],
        filters: { 'catalog_snapshot.is_latest_build': 'Yes' }, sorts: ['catalog_snapshot.chunk_index'], limit: '500',
      });
      if (!rows || !rows.length) return null;
      const chunks = [...rows].sort((a, b) => num(a['catalog_snapshot.chunk_index']) - num(b['catalog_snapshot.chunk_index'])).map((x) => String(x['catalog_snapshot.chunk'] || ''));
      const meta = await unpack(chunks.join(''));
      if (!meta || !meta.nodes) return null;
      return { meta, time: String(rows[0]['catalog_snapshot.built_time'] || meta.built || '') };
    } catch (err) {
      console.info('[data-catalog] live catalog not available, using the built-in copy');
      return null;
    }
  }

  _sourceLine() {
    const s = this._source || {};
    if (s.kind === 'live') return html`<span class="dc-src is-live" title="Loaded from BigQuery through Looker">Catalog updated ${shortDate(String(s.time).slice(0, 10))}${String(s.time).length > 10 ? `, ${String(s.time).slice(11, 16)}` : ''}</span>`;
    return html`<span class="dc-src" title="The live catalog in BigQuery could not be read, so the copy built into the app is shown">Built-in copy from ${shortDate(String(s.time || '').slice(0, 10))}</span>`;
  }

  updated() {
    this.querySelectorAll('.dc-graph').forEach((el) => this._applyView(el.dataset.key));
    if (this.route.view === 'graph' && (this._kgNeedBind || !(this._kgEls && this._kgEls.nodes[0] && this._kgEls.nodes[0].isConnected))) { this._kgNeedBind = false; this._kgBind(); }
    if (this._pendingFit.size) {
      const keys = [...this._pendingFit];
      this._pendingFit.clear();
      requestAnimationFrame(() => keys.forEach((k) => this._fit(k)));
    }
  }

  /* ---------------- live usage from System Activity (counts only, never who) */

  async _loadUsage() {
    if (this._usageCtrl) this._usageCtrl.abort();
    const ctrl = new AbortController();
    this._usageCtrl = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const model = this._model();
    const window90 = `${USAGE_DAYS} days`;
    const run = (q) => this.runQuery(q, ctrl.signal).catch((err) => { if (err && err.name === 'AbortError') throw err; console.warn('[data-catalog] usage query failed', err); return null; });
    try {
      const people = (META.usage || {}).show_people;
      const [fieldRows, exploreRows, dashRows, userRows] = await Promise.all([
        run({ model: 'system__activity', explore: 'field_usage', fields: ['field_usage.field', 'field_usage.times_used'], filters: { 'field_usage.model': model }, sorts: ['field_usage.times_used desc'], limit: '5000' }),
        run({ model: 'system__activity', explore: 'history', fields: ['query.view', 'history.query_run_count', 'history.explore_user'], filters: { 'query.model': model, 'history.created_date': window90 }, sorts: ['history.query_run_count desc'], limit: '500' }),
        run({ model: 'system__activity', explore: 'history', fields: ['dashboard.id', 'dashboard.title', 'query.view', 'query.formatted_fields', 'history.query_run_count', 'history.dashboard_user'], filters: { 'query.model': model, 'history.created_date': window90, 'dashboard.id': 'NOT NULL' }, sorts: ['history.query_run_count desc'], limit: '5000' }),
        people ? run({ model: 'system__activity', explore: 'history', fields: ['user.id', 'user.name', 'history.query_run_count'], filters: { 'query.model': model, 'history.created_date': window90, 'user.name': '-NULL' }, sorts: ['history.query_run_count desc'], limit: '60' }) : Promise.resolve([]),
      ]);
      if (ctrl.signal.aborted) return;
      const u = { state: 'ok', fields: new Map(), explores: new Map(), dashboards: [], fieldDash: new Map(), dashFields: new Map() };
      (fieldRows || []).forEach((r) => {
        const raw = String(r['field_usage.field'] || '');
        if (!raw.includes('.')) return;
        const id = IX.groupOf.get(raw) || raw;
        u.fields.set(id, (u.fields.get(id) || 0) + num(r['field_usage.times_used']));
      });
      (exploreRows || []).forEach((r) => {
        const x = String(r['query.view'] || '');
        if (x) u.explores.set(x, { runs: num(r['history.query_run_count']), users: num(r['history.explore_user']) });
      });
      const dmap = new Map();
      (dashRows || []).forEach((r) => {
        const id = String(r['dashboard.id'] || '');
        if (!id) return;
        const d = dmap.get(id) || { id, title: String(r['dashboard.title'] || `Dashboard ${id}`), runs: 0, users: 0, explores: new Set(), fields: new Set() };
        d.runs += num(r['history.query_run_count']);
        d.users = Math.max(d.users, num(r['history.dashboard_user']));
        const ex = String(r['query.view'] || '');
        if (ex) d.explores.add(ex);
        const a2v = IX.aliasToView.get(ex) || {};
        let list = [];
        try { list = JSON.parse(String(r['query.formatted_fields'] || '[]')); } catch (e) { list = []; }
        list.forEach((name) => {
          const [a, f] = String(name).split('.');
          if (!f) return;
          let fid = `${a2v[a] || a}.${f}`;
          fid = IX.groupOf.get(fid) || fid;
          if (!IX.field.has(fid)) return;
          d.fields.add(fid);
          if (!u.fieldDash.has(fid)) u.fieldDash.set(fid, new Set());
          u.fieldDash.get(fid).add(id);
        });
        dmap.set(id, d);
      });
      u.dashboards = [...dmap.values()].sort((a, b) => b.runs - a.runs);
      u.users = (userRows || []).filter((r) => r['user.id']).map((r) => ({ id: r['user.id'], name: String(r['user.name'] || ''), runs: num(r['history.query_run_count']) }));
      USAGE_BOOST.clear();
      u.fields.forEach((v, k) => USAGE_BOOST.set(k, v));
      u.explores.forEach((v, k) => USAGE_BOOST.set(`explore.${k}`, v.runs));
      u.dashboards.forEach((d) => u.dashFields.set(d.id, d));
      if (!fieldRows && !exploreRows && !dashRows) u.state = 'unavailable';
      this._usage = u;
      this._pfCache = null; this._kg = null; this._kgSim = null; this._conflictCache = null;
    } catch (err) {
      if (!ctrl.signal.aborted || !this._usage || this._usage.state === 'loading') this._usage = { ...this._usage, state: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------------- navigation */

  _go(view, id = '', tab = '') {
    const cur = this.route;
    if (cur.view !== view || cur.id !== id) this._history = [...this._history, cur].slice(-40);
    this._sugOpen = false;
    if (view === 'lineage') {
      this.lgFocus = id || this.lgFocus || this._defaultFocus();
      this.lgSel = this.lgFocus;
      this._refit('lineage');
    }
    if (view === 'node' || view === 'field') { this.colQ = ''; this.colDoc = 'all'; }
    if (view === 'search') { this.sLimit = 50; this._resIdx = -1; }
    this.route = { view, id, tab };
    this._remember(view, id);
    if ((view === 'rules' || view === 'questions') && id) {
      this.updateComplete.then(() => { const el = this.querySelector(`#${view === 'rules' ? 'rule' : 'q'}-${CSS.escape(id)}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); });
    } else this._scrollTop();
  }

  /* Recently viewed, for this session only (nothing is stored). */
  _remember(view, id) {
    let v = null;
    if (view === 'node' && IX.node.has(id)) { const n = IX.node.get(id); v = { id, type: n.k, layer: layerOf(n), title: titleOf(n) }; }
    if (view === 'field' && IX.field.has(id)) { const f = IX.field.get(id); v = { id, type: f.k, layer: f.k, title: fieldTitle(f) }; }
    if (view === 'term' && IX.term.has(id)) v = { id, type: 'term', layer: 'term', title: id };
    if (view === 'product' && IX.product.has(id)) v = { id: `product:${id}`, type: 'product', layer: 'product', title: IX.product.get(id).name };
    if (view === 'udd' && this._usage.dashFields.get(id)) v = { id: `udd.${id}`, type: 'udd', layer: 'dashboard', title: this._usage.dashFields.get(id).title };
    if (v) this._recentV = [v, ...this._recentV.filter((x) => x.id !== v.id)].slice(0, 10);
  }

  _open(rawId) {
    if (!rawId) return;
    const id = IX.groupOf.get(rawId) || rawId;
    if (IX.field.has(id)) this._go('field', id);
    else if (IX.term.has(id)) this._go('term', id);
    else if (IX.node.has(id)) this._go('node', id);
    else if (String(id).startsWith('udd.')) this._go('udd', id.slice(4));
    else if (String(id).startsWith('product:')) this._go('product', id.slice(8));
    else if (String(id).startsWith('rule:')) this._go('rule', id.slice(5));
    else if (String(id).startsWith('question:')) this._go('questions', id.slice(9));
  }

  _back() {
    const prev = this._history[this._history.length - 1];
    this._history = this._history.slice(0, -1);
    this.route = prev || { view: 'home', id: '', tab: '' };
    this._scrollTop();
  }

  _scrollTop() {
    this.updateComplete.then(() => {
      const main = this.querySelector('.dc-main');
      if (main && main.scrollIntoView && main.getBoundingClientRect().top < 0) main.scrollIntoView({ block: 'start' });
    });
  }

  _onKey(e) {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
      const input = this.querySelector('.dc-top .sbox input');
      if (input) { e.preventDefault(); input.focus(); input.select(); }
    }
  }

  /* Keys typed into our own inputs stay with us (the runtime refreshes on R). */
  _stopKeys(e) { e.stopPropagation(); }

  _defaultFocus() {
    let best = '';
    let score = -1;
    IX.node.forEach((n) => {
      if (n.k !== 'view') return;
      const s = (IX.down.get(n.id) || []).length * 3 + n.up.length + (IX.fieldsByView.get(n.name) || []).filter((f) => f.dash.length).length;
      if (s > score) { score = s; best = n.id; }
    });
    return best;
  }

  /* ---------------- pan and zoom for diagrams (DOM transform while dragging, no re-render) */

  _vp(key) { return this._view.get(key) || { x: 20, y: 20, k: 1 }; }

  _applyView(key) {
    const el = this.querySelector(`.dc-graph[data-key="${key}"] .g-canvas`);
    const v = this._vp(key);
    if (el) el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
    const z = this.querySelector(`.dc-graph[data-key="${key}"] .g-zoom-val`);
    if (z) z.textContent = `${Math.round(v.k * 100)}%`;
    if (key === 'kg' && el) { const was = el.classList.contains('kg-zoom'); el.classList.toggle('kg-zoom', v.k >= 0.8); if (was !== (v.k >= 0.8)) this._kgLabels(); }
  }

  /* Forget a diagram's position so it fits again on the next render. */
  _refit(key) {
    this._view.delete(key);
    this.requestUpdate();
  }

  /* Fit the diagram; if it is too big to read when fitted, centre on the focus node instead. */
  _fit(key, all = false) {
    const vp = this.querySelector(`.dc-graph[data-key="${key}"]`);
    const canvas = vp && vp.querySelector('.g-canvas');
    if (!vp || !canvas) return;
    const w = Number(canvas.dataset.w) || 1;
    const h = Number(canvas.dataset.h) || 1;
    const fx = Number(canvas.dataset.fx);
    const fy = Number(canvas.dataset.fy);
    const r = vp.getBoundingClientRect();
    if (!r.width) return;
    const fitK = Math.min(1, (r.width - 56) / w, (r.height - 72) / h);
    const k = Math.max(all ? 0.15 : (key === 'kg' ? 0.7 : (key.startsWith('prod:') ? 0.32 : 0.8)), fitK);
    let x = (r.width - w * k) / 2;
    let y = (r.height - h * k) / 2;
    if (w * k > r.width - 56 && Number.isFinite(fx)) x = Math.min(28, Math.max(r.width - 28 - w * k, r.width / 2 - fx * k));
    if (h * k > r.height - 72 && Number.isFinite(fy)) y = Math.min(28, Math.max(r.height - 44 - h * k, r.height / 2 - fy * k));
    this._view.set(key, { k, x, y });
    this._applyView(key);
  }

  _zoom(key, factor, cx, cy) {
    const v = this._vp(key);
    const vp = this.querySelector(`.dc-graph[data-key="${key}"]`);
    const r = vp ? vp.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
    const px = cx === undefined ? r.width / 2 : cx - r.left;
    const py = cy === undefined ? r.height / 2 : cy - r.top;
    const k = Math.max(0.2, Math.min(2.2, v.k * factor));
    const f = k / v.k;
    this._view.set(key, { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
    this._applyView(key);
  }

  _onWheel(key, e) {
    if (!(e.ctrlKey || e.metaKey) && Math.abs(e.deltaY) < 40 && !e.deltaX) {
      // trackpad scroll pans
    }
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 40) this._zoom(key, e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
    else { const v = this._vp(key); this._view.set(key, { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }); this._applyView(key); }
  }

  _onDown(key, e) {
    if (e.button !== 0 || e.target.closest('.g-node, .kg-node, .g-ctrl, .g-edge-label')) return;
    const v = this._vp(key);
    this._drag = { key, sx: e.clientX, sy: e.clientY, x: v.x, y: v.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('is-dragging');
  }

  _onMove(e) {
    const d = this._drag;
    if (!d) return;
    const dx = e.clientX - d.sx; const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const v = this._vp(d.key);
    this._view.set(d.key, { ...v, x: d.x + dx, y: d.y + dy });
    this._applyView(d.key);
  }

  _onUp(e) {
    if (!this._drag) return;
    e.currentTarget.classList.remove('is-dragging');
    this._drag = null;
  }

  _graphShell(key, g, inner, extra = nothing, focus = null) {
    if (!this._view.has(key)) this._pendingFit.add(key);
    const v = this._vp(key);
    const height = key === 'lineage' || key === 'kg' ? '' : `height:${Math.round(Math.max(300, Math.min(580, g.height * 0.8 + 140)))}px`;
    return html`
      <div class="dc-graph" data-key=${key} style=${height}
        @wheel=${(e) => this._onWheel(key, e)}
        @pointerdown=${(e) => this._onDown(key, e)}
        @pointermove=${(e) => this._onMove(e)}
        @pointerup=${(e) => this._onUp(e)}
        @pointercancel=${(e) => this._onUp(e)}>
        <div class="g-canvas" data-w=${g.width} data-h=${g.height} data-fx=${focus ? focus.x + focus.w / 2 : ''} data-fy=${focus ? focus.y + focus.h / 2 : ''} style="transform: translate(${v.x}px, ${v.y}px) scale(${v.k}); width:${g.width}px; height:${g.height}px">
          ${inner}
        </div>
        <div class="g-ctrl">
          <button title="Zoom in" @click=${() => this._zoom(key, 1.2)}>${icon('plus', 14)}</button>
          <span class="g-zoom-val"></span>
          <button title="Zoom out" @click=${() => this._zoom(key, 1 / 1.2)}>${icon('minus', 14)}</button>
          <button title="Fit to screen" @click=${() => this._fit(key, true)}>${icon('fit', 14)}</button>
        </div>
        <div class="g-hint">Drag to move. Scroll or pinch to zoom.</div>
        ${extra}
      </div>`;
  }

  /* ---------------- render: shell */

  render() {
    const brand = (META && META.brand) || {};
    const style = [
      brand.primary && `--c-primary:${brand.primary}`, brand.primary_soft && `--c-primary-soft:${brand.primary_soft}`,
      brand.primary_ink && `--c-primary-ink:${brand.primary_ink}`, brand.ink && `--c-ink:${brand.ink}`,
      brand.muted && `--c-muted:${brand.muted}`, brand.subtle && `--c-subtle:${brand.subtle}`,
      brand.border && `--c-border:${brand.border}`, brand.canvas && `--c-canvas:${brand.canvas}`, brand.card && `--c-card:${brand.card}`,
      brand.display && `--f-display:'${brand.display}'`,
      brand.heading && `--f-head:'${brand.heading}', system-ui, -apple-system, 'Segoe UI', sans-serif`,
      brand.primary && `--app-primary:${brand.primary}`,
    ].filter(Boolean).join(';');
    return html`
      ${STYLES}
      <div class="dc-root" style=${style}>
        ${this._error ? this._renderError() : (!this._ready ? this._renderLoading() : this._renderApp())}
      </div>`;
  }

  _renderLoading() {
    return html`<div class="dc-loading"><div class="dc-spinner"></div><p>Opening the catalog</p></div>`;
  }

  _renderError() {
    return html`<div class="dc-loading"><p class="dc-err-title">The catalog could not be opened.</p><p class="muted">${this._error}</p></div>`;
  }

  _renderApp() {
    const M = META;
    const section = this.route.view === 'node' || this.route.view === 'field' ? '' : SECTION_OF[this.route.view];
    return html`
      <aside class="dc-side">
        <div class="dc-brand" @click=${() => this._go('home')}>
          <div class="dc-logo">${this._logo()}</div>
          <div class="dc-product">${M.client.product || 'Data Catalog'}</div>
        </div>
        <nav class="dc-nav">
          ${NAV.map((g) => html`
            ${g.group ? html`<div class="dc-nav-group">${g.group}</div>` : nothing}
            ${g.items.map((it) => html`
              <button class="dc-nav-item ${section === it.id ? 'is-active' : ''}" @click=${() => this._go(it.id)}>
                ${icon(it.icon)}<span>${it.label}</span>
              </button>`)}
          `)}
        </nav>
        <div class="dc-side-foot">
          <div>${this._sourceLine()}</div>
          <div class="mono">${M.repos.lookml.repo}@${M.repos.lookml.commit}</div>
          <div class="mono">${M.repos.dbt.repo}@${M.repos.dbt.commit}</div>
        </div>
      </aside>
      <section class="dc-body">
        ${this._renderTopBar()}
        <main class="dc-main">${this._renderRoute()}</main>
      </section>`;
  }

  _logo() {
    return html`<span class="dc-logo-svg" .innerHTML=${META.client.logo_svg || ''}></span>`;
  }

  _renderTopBar() {
    return html`
      <header class="dc-top">
        ${this._history.length ? html`<button class="dc-back" title="Back" @click=${() => this._back()}>${icon('back')}</button>` : html`<span class="dc-back-sp"></span>`}
        <div class="dc-top-search">${this.route.view === 'home' ? nothing : this._searchBox('top')}</div>
        <div class="dc-top-meta">${this._sourceLine()}${this._usageBadge()}</div>
        ${this._toastMsg ? html`<div class="toast">${this._toastMsg}</div>` : nothing}
      </header>`;
  }

  _usageBadge() {
    const s = this._usage.state;
    if (s === 'loading') return html`<span class="dc-pill">Loading usage</span>`;
    if (s === 'ok') return html`<span class="dc-pill is-ok">Usage: last ${USAGE_DAYS} days</span>`;
    return html`<span class="dc-pill" title="Usage needs access to Looker System Activity">Usage not available</span>`;
  }

  _renderRoute() {
    const r = this.route;
    switch (r.view) {
      case 'search': return this._renderSearch();
      case 'domains': return this._renderDomains();
      case 'domain': return this._renderDomain(r.id);
      case 'tables': return this._renderTables();
      case 'looker': return this._renderLooker();
      case 'metrics': return this._renderMetrics();
      case 'dashboards': return this._renderDashboards();
      case 'udd': return this._renderUdd(r.id);
      case 'products': return this._renderProducts();
      case 'product': return this._renderProduct(r.id);
      case 'graph': return this._renderGraph();
      case 'rules': return this._renderRules();
      case 'rule': return this._renderRule(r.id);
      case 'questions': return this._renderQuestions();
      case 'lineage': return this._renderLineagePage();
      case 'glossary': return this._renderGlossary();
      case 'term': return this._renderTerm(r.id);
      case 'health': return this._renderHealth();
      case 'usage': return this._renderUsage();
      case 'node': return this._renderNode(r.id, r.tab);
      case 'field': return this._renderField(r.id);
      default: return this._renderHome();
    }
  }

  /* Deep link: #dc=<view>/<id>/<tab> opens a page directly (used for previews and shared links). */
  _applyHash() {
    let h = '';
    try { h = decodeURIComponent((window.location && window.location.hash) || ''); } catch (e) { h = ''; }
    const m = h.match(/dc=([^/]+)(?:\/([^/]*))?(?:\/(.*))?$/);
    if (!m) return;
    const [, view, id = '', tab = ''] = m;
    if (view === 'search') { this.q = id; this._go('search'); return; }
    if (view === 'lineage') { this._go('lineage', id); return; }
    if (view === 'health' && id) { this.hGroup = id; this.hSel = tab; this._go('health'); return; }
    if (view === 'home' && id) { this.q = id; this._scope = tab || 'all'; this._sugOpen = 'hero'; return; }
    this._go(view, id, tab);
  }

  /* ---------------- shared bits */

  _kindBadge(type, layer, compact = false) {
    const key = type === 'model' ? layer : (type === 'table' ? 'external' : type);
    const tint = (LAYERS[key] && LAYERS[key].tint) || (type === 'measure' ? 'metric' : type === 'udd' ? 'dash' : ['term', 'product', 'rule', 'question'].includes(type) ? 'know' : 'grey');
    let label = KIND_LABEL[type] || type;
    if (type === 'model') label = `${(LAYERS[layer] || {}).label || 'dbt'} model`;
    if (type === 'model' && layer === 'warehouse') label = 'Warehouse table';
    return html`<span class="kb t-${tint} ${compact ? 'is-compact' : ''}">${icon(KIND_ICON[type] || 'field', 12)}${compact ? nothing : html`<span>${label}</span>`}</span>`;
  }

  _domChip(dom) {
    const d = IX.domain.get(dom);
    if (!d) return nothing;
    return html`<button class="chip is-link is-dom" @click=${(e) => { e.stopPropagation(); this._go('domain', dom); }}>${domIcon(dom, 12)}${d.label}</button>`;
  }

  _nodeLink(id, opts = {}) {
    const n = IX.node.get(id);
    if (!n) return html`<span class="mono muted">${id}</span>`;
    return html`<button class="lnk ${opts.mono ? 'mono' : ''}" @click=${(e) => { e.stopPropagation(); this._open(id); }}>${opts.icon !== false ? this._kindBadge(n.k, layerOf(n), true) : nothing}<span>${opts.label || titleOf(n)}</span></button>`;
  }

  _fieldLink(id, opts = {}) {
    const f = IX.field.get(id);
    if (!f) return html`<span class="mono muted" title="This field is not defined in the LookML">${id}</span>`;
    return html`<button class="lnk" title=${id} @click=${(e) => { e.stopPropagation(); this._go('field', id); }}>${opts.icon !== false ? this._kindBadge(f.k, f.k, true) : nothing}<span>${opts.id ? html`<span class="mono">${id}</span>` : fieldTitle(f)}</span></button>`;
  }

  _pageHead(eyebrow, title, desc, right = nothing, crumbExtra = []) {
    return html`
      ${this._crumbs(crumbExtra)}
      <div class="ph">
        <div class="ph-main">
          ${eyebrow ? html`<div class="eyebrow">${eyebrow}</div>` : nothing}
          <h1>${title}</h1>
          ${desc ? html`<p class="ph-desc">${desc}</p>` : nothing}
        </div>
        ${right}
      </div>`;
  }

  _desc(text, kind = 'asset') {
    return text ? html`<p class="desc">${text}</p>` : html`<p class="desc is-empty">No description yet. Add one to the ${kind === 'dbt' ? 'dbt schema file' : 'LookML'} so people know what this is.</p>`;
  }

  _seg(options, value, onPick) {
    return html`<div class="seg">${options.map(([v, label]) => html`<button class=${v === value ? 'is-on' : ''} @click=${() => onPick(v)}>${label}</button>`)}</div>`;
  }

  _select(label, value, options, onPick) {
    return html`<label class="sel"><span>${label}</span><select .value=${value} @change=${(e) => onPick(e.target.value)} @keydown=${this._stopKeys}>${options.map(([v, l]) => html`<option value=${v} ?selected=${v === value}>${l}</option>`)}</select></label>`;
  }

  _filterInput(value, placeholder, onInput) {
    return html`<div class="fi">${icon('search', 14)}<input type="search" .value=${value} placeholder=${placeholder} @input=${(e) => onInput(e.target.value)} @keydown=${this._stopKeys} @keyup=${this._stopKeys} @keypress=${this._stopKeys}></div>`;
  }

  _domainOptions() { return [['all', 'All domains'], ...(META.domains || []).map((d) => [d.id, d.label])]; }

  _sqlBlock(sql, viewName) {
    if (!sql) return nothing;
    const parts = String(sql).split(/(\$\{[^}]+\}|'[^']*'|\b[A-Za-z_][A-Za-z0-9_]*\b|--[^\n]*)/g);
    return html`<pre class="code">${parts.map((p) => {
      if (!p) return nothing;
      if (p.startsWith('${')) {
        const inner = p.slice(2, -1);
        if (inner === 'TABLE') return html`<span class="c-tbl">${p}</span>`;
        let fid = inner.includes('.') ? inner : `${viewName}.${inner}`;
        fid = IX.groupOf.get(fid) || fid;
        if (IX.field.has(fid)) return html`<button class="c-ref" @click=${() => this._go('field', fid)}>${p}</button>`;
        return html`<span class="c-tbl">${p}</span>`;
      }
      if (p.startsWith("'")) return html`<span class="c-str">${p}</span>`;
      if (p.startsWith('--')) return html`<span class="c-com">${p}</span>`;
      if (SQL_KEYWORDS.has(p.toLowerCase())) return html`<span class="c-kw">${p}</span>`;
      return p;
    })}</pre>`;
  }

  _empty(text, action = nothing) { return html`<div class="empty"><span class="empty-ic">${icon('search', 14)}</span><span>${text}</span>${action}</div>`; }

  _stat(value, label, sub, onClick) {
    return html`<button class="stat ${onClick ? 'is-link' : ''}" @click=${onClick || (() => {})}><div class="stat-v">${value}</div><div class="stat-l">${label}</div>${sub ? html`<div class="stat-s">${sub}</div>` : nothing}</button>`;
  }

  _counts() {
    if (this._countsCache) return this._countsCache;
    const c = { source: 0, staging: 0, integration: 0, warehouse: 0, seed: 0, external: 0, view: 0, explore: 0, dashboard: 0, measure: 0, dimension: 0, systems: new Set() };
    IX.node.forEach((n) => { const l = layerOf(n); if (c[l] !== undefined) c[l] += 1; if (n.k === 'source' && n.sys) c.systems.add(n.sys); });
    IX.field.forEach((f) => { if (!f.hid && (f.k === 'measure' || f.k === 'dimension')) c[f.k] += 1; });
    this._countsCache = c;
    return c;
  }

  _footer() {
    const M = META;
    return html`<footer class="dc-foot">Built ${shortDate(M.built.slice(0, 10))} from ${M.repos.lookml.repo} (${M.repos.lookml.commit}) and ${M.repos.dbt.repo} (${M.repos.dbt.commit}). ${M.warehouse && M.warehouse.built ? ` Warehouse columns read from BigQuery on ${shortDate(M.warehouse.built)}.` : ''} Usage comes live from Looker System Activity and shows counts only.</footer>`;
  }

  _scoreRing(score) {
    const r = 42; const c = 2 * Math.PI * r;
    return html`
      <div class="ring">
        <svg viewBox="0 0 100 100" width="112" height="112" aria-hidden="true">
          <circle cx="50" cy="50" r=${r} class="ring-bg"></circle>
          <circle cx="50" cy="50" r=${r} class="ring-fg ${st(score)}" stroke-dasharray=${`${(c * score) / 100} ${c}`} transform="rotate(-90 50 50)"></circle>
        </svg>
        <div class="ring-v"><b class=${st(score)}>${score}</b><span>of 100</span></div>
      </div>`;
  }

  /* ---------------- domains */

  _domainStats() {
    if (this._domCache) return this._domCache;
    const s = new Map();
    (META.domains || []).forEach((d) => s.set(d.id, { tables: 0, views: 0, explores: 0, dashboards: 0, metrics: 0 }));
    IX.node.forEach((n) => {
      const x = s.get(n.dom); if (!x) return;
      if (['source', 'seed', 'table', 'model', 'snapshot'].includes(n.k)) x.tables += 1;
      else if (n.k === 'view') x.views += 1; else if (n.k === 'explore') x.explores += 1; else if (n.k === 'dashboard') x.dashboards += 1;
    });
    IX.field.forEach((f) => { const x = s.get(f.dom); if (x && f.k === 'measure' && !f.hid) x.metrics += 1; });
    this._domCache = s;
    return s;
  }

  _domainCards() {
    const stats = this._domainStats();
    return (META.domains || []).filter((d) => d.id !== 'other' || (stats.get('other') || {}).tables)
      .sort((a, b) => (stats.get(b.id).tables + stats.get(b.id).metrics) - (stats.get(a.id).tables + stats.get(a.id).metrics))
      .map((d) => {
        const x = stats.get(d.id);
        return html`
          <button class="dom-card acc-${IX.domain.get(d.id).i % 7}" @click=${() => this._go('domain', d.id)}>
            <div class="dom-t"><span class="acc-tile">${icon('domain', 13)}</span>${d.label}</div>
            <div class="dom-d">${d.text || ''}</div>
            <div class="dom-n"><span><b>${fmtInt(x.tables)}</b> tables</span><span><b>${fmtInt(x.metrics)}</b> metrics</span><span><b>${fmtInt(x.explores)}</b> explores</span></div>
          </button>`;
      });
  }

  _renderDomains() {
    const stats = this._domainStats();
    const rows = new Map(this._healthRows('domain').map((r) => [r.key, r]));
    const doms = (META.domains || []).filter((d) => d.id !== 'other' || (stats.get('other') || {}).tables)
      .sort((a, b) => (a.id === 'other') - (b.id === 'other') || (stats.get(b.id).tables + stats.get(b.id).metrics) - (stats.get(a.id).tables + stats.get(a.id).metrics));
    return html`
      ${this._pageHead('Browse', 'Domains', 'Every asset belongs to one business area. Warehouse tables take theirs from the dbt folder they live in; everything upstream and downstream follows the lineage.')}
      <div class="bento">${doms.map((d, i) => {
        const x = stats.get(d.id);
        const h = rows.get(d.id);
        const top = [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid && f.dom === d.id).sort((a, b) => this._fieldScore(b) - this._fieldScore(a))[0];
        const prod = [...IX.product.values()].find((p) => this._productDomain(p) === d.id);
        return html`
          <button class="dom-tile ${i < 2 ? 'c6' : 'c4'} acc-${IX.domain.get(d.id).i % 7}" @click=${() => this._go('domain', d.id)}>
            <span class="dom-ic">${domIcon(d.id, 20)}</span>
            <span class="dom-name">${d.label}</span>
            <span class="dom-text">${d.text || ''}</span>
            <span class="dom-foot">
            <span class="dom-nums"><span>${plural(x.tables, 'table')}</span><span>${plural(x.metrics, 'metric')}</span><span>${plural(x.explores, 'explore')}</span></span>
            ${h ? html`<span class="dom-health ${st(h.score)}"><span class="bar-track"><span class="bar-fill" style="width:${h.score}%"></span></span><span class="dom-hv">${h.score}% documented</span></span>` : nothing}
            <span class="dom-top">${prod ? html`<span>${icon('product', 12)} ${prod.name}</span>` : nothing}${top ? html`<span>${icon('metric', 12)} ${fieldTitle(top)}</span>` : nothing}${!top && !prod ? html`<span class="muted">No data product or metric yet</span>` : nothing}</span>
            </span>
          </button>`;
      })}</div>`;
  }

  _productDomain(p) {
    const c = new Map();
    p.assets.forEach((a) => { const d = (IX.node.get(a) || {}).dom; if (d) c.set(d, (c.get(d) || 0) + 1); });
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }

  /* ---------------- search: empty state */

  _searchStart() {
    const c = this._counts();
    const terms = (META.glossary || []).length;
    const trending = [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid && !isPlumbing(IX.node.get(`view.${f.v}`)))
      .sort((a, b) => (this._usage.fields.get(b.id) || 0) - (this._usage.fields.get(a.id) || 0)).slice(0, 6);
    const popular = [...new Set([...this._recentQ, ...(META.glossary || []).slice().sort((a, b) => b.m.reduce((s, m) => s + (USAGE_BOOST.get(m) || 0), 0) - a.m.reduce((s, m) => s + (USAGE_BOOST.get(m) || 0), 0)).slice(0, 6).map((t) => t.t.toLowerCase())])].slice(0, 8);
    const traceTerms = (META.glossary || []).filter((t) => t.m.length).slice(0, 5);
    const types = [
      ['metric', 'Metrics', c.measure, 'metrics', 't-metric', 'metric'],
      ['table', 'Tables', c.warehouse + c.staging + c.integration + c.source, 'tables', 't-wh', 'table'],
      ['dashboard', 'Dashboards', c.dashboard + (this._usage.dashboards || []).length, 'dashboards', 't-dash', 'dashboard'],
      ['term', 'Glossary terms', terms, 'glossary', 't-know', 'book'],
    ];
    return html`
      ${this._pageHead('Search', 'Search the catalog', 'Search names, descriptions, columns and SQL, or ask a question in plain English.')}
      <div class="bento">
        <section class="card c8">
          <div class="card-h"><h2>Ask a question</h2><button class="lnk-btn" @click=${() => this._go('questions')}>All questions ${icon('arrow', 14)}</button></div>
          <div class="q-cards">${IX.questions.slice(0, 6).map((q) => html`<button class="q-card" @click=${() => this._doSearch(q.q)}><span class="q-ic">${icon('question', 14)}</span><span>${q.q}</span></button>`)}</div>
        </section>
        <section class="card c4">
          <div class="card-h"><h2>Find by type</h2></div>
          <div class="type-list">${types.map(([k, label, n, route, cls, ic]) => html`<button class="type-row" @click=${() => this._go(route)}><span class="kb ${cls} is-compact">${icon(ic, 13)}</span><span class="type-l">${label}</span><span class="type-n">${fmtInt(n)}</span></button>`)}</div>
        </section>
        <section class="card c4">
          <div class="card-h"><h2>Trace a number</h2></div>
          <p class="muted small">Follow a metric back through Looker and dbt to the source system.</p>
          <div class="col-links is-wrap">${traceTerms.map((t) => html`<button class="lnk" @click=${() => this._doSearch(`where does ${t.t.toLowerCase()} come from`)}>${icon('lineage', 13)}<span>Where does ${t.t.toLowerCase()} come from?</span></button>`)}</div>
        </section>
        <section class="card c4">
          <div class="card-h"><h2>Trending metrics</h2><span class="muted small">Most used in queries</span></div>
          ${this._usage.state === 'ok' ? html`<ol class="rank">${trending.map((f) => html`<li><button class="rank-row" @click=${() => this._go('field', f.id)}><span class="rank-t"><span class="rank-tx">${fieldTitle(f)}</span></span><span class="rank-s">${fmtCompact(this._usage.fields.get(f.id) || 0)}</span></button></li>`)}</ol>` : this._empty(this._usage.state === 'loading' ? 'Loading usage.' : 'Needs access to Looker System Activity.')}
        </section>
        <section class="card c4">
          <div class="card-h"><h2>${this._recentQ.length ? 'Recent and popular searches' : 'Popular searches'}</h2></div>
          <div class="chips">${popular.map((t) => html`<button class="chip is-link is-lg" @click=${() => this._doSearch(t)}>${t}</button>`)}</div>
        </section>
        ${this._recentV.length ? html`<section class="card c6">
          <div class="card-h"><h2>Recently viewed</h2><span class="muted small">This session</span></div>
          <div class="col-links">${this._recentV.slice(0, 6).map((v) => html`<button class="lnk" @click=${() => this._open(v.id)}>${this._kindBadge(v.type, v.layer, true)}<span>${v.title}</span></button>`)}</div>
        </section>` : nothing}
        <section class="card ${this._recentV.length ? 'c6' : 'c12'} help-tile">
          <div class="card-h"><h2>Search tips</h2></div>
          <dl class="kv is-wide">
            <dt><span class="mono">column:</span></dt><dd>Search column names only, for example <button class="lnk" @click=${() => this._doSearch(`column: ${searchCfg().column_example || 'id'}`)}><span class="mono">column: ${searchCfg().column_example || 'id'}</span></button></dd>
            <dt><span class="mono">sql:</span></dt><dd>Search inside metric and model SQL, for example <button class="lnk" @click=${() => this._doSearch(`sql: ${searchCfg().sql_example || 'sum('}`)}><span class="mono">sql: ${searchCfg().sql_example || 'sum('}</span></button></dd>
            ${(searchCfg().filter_examples || []).length ? html`<dt>Filters in words</dt><dd>${searchCfg().filter_examples.map((t, i) => html`${i ? ', ' : ''}<button class="lnk" @click=${() => this._doSearch(t)}><span>${t}</span></button>`)}</dd>` : nothing}
          </dl>
        </section>
      </div>`;
  }

  _renderDomain(id) {
    const d = IX.domain.get(id);
    if (!d) return this._empty('This domain is not in the catalog.');
    const nodes = [...IX.node.values()].filter((n) => n.dom === id);
    const by = (pred) => nodes.filter(pred).sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    const wh = by((n) => n.k === 'model' && n.layer === 'warehouse');
    const ex = by((n) => n.k === 'explore');
    const dash = by((n) => n.k === 'dashboard');
    const metrics = [...IX.field.values()].filter((f) => f.dom === id && f.k === 'measure' && !f.hid)
      .sort((a, b) => this._fieldScore(b) - this._fieldScore(a)).slice(0, 24);
    const terms = (META.glossary || []).filter((t) => t.dom === id);
    const upstream = by((n) => ['source', 'seed', 'table'].includes(n.k) || (n.k === 'model' && n.layer !== 'warehouse'));
    return html`
      ${this._pageHead('Domain', d.label, d.text, nothing, [[d.label, null]])}
      <div class="stat-row">
        ${this._stat(fmtInt(wh.length), 'Warehouse tables')}
        ${this._stat(fmtInt(upstream.length), 'Upstream tables', 'Sources, staging, integration')}
        ${this._stat(fmtInt(ex.length), 'Explores')}
        ${this._stat(fmtInt(metrics.length), 'Key metrics', 'Shown below')}
      </div>
      ${terms.length ? html`<section class="card"><div class="card-h"><h2>Business terms</h2></div><div class="chips">${terms.map((t) => html`<button class="chip is-link" @click=${() => this._go('term', t.t)}>${t.t}</button>`)}</div></section>` : nothing}
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Warehouse tables</h2></div>${this._assetList(wh)}</section>
        <section class="card"><div class="card-h"><h2>Explores and dashboards</h2></div>${this._assetList([...ex, ...dash])}</section>
      </div>
      ${this._rulesTile(this._rulesFor('domain', id))}
      <section class="card"><div class="card-h"><h2>Most used metrics</h2></div>${this._metricTable(metrics, false)}</section>`;
  }

  _assetList(list, max = 30) {
    if (!list.length) return this._empty('None in this domain.');
    return html`<ul class="alist">${list.slice(0, max).map((n) => html`
      <li><button class="arow" @click=${() => this._open(n.id)}>
        ${this._kindBadge(n.k, layerOf(n), true)}
        <span class="arow-t">${titleOf(n)}</span>
        <span class="arow-d">${n.d || ''}</span>
      </button></li>`)}
      ${list.length > max ? html`<li class="muted small">${fmtInt(list.length - max)} more</li>` : nothing}
    </ul>`;
  }

  /* ---------------- search box (top bar and home hero share one query) */

  _searchBox(where) {
    const open = this._sugOpen === where;
    return html`
      <div class="sbox ${where === 'hero' ? 'is-hero' : ''} ${open ? 'is-open' : ''}">
        ${icon('search', where === 'hero' ? 20 : 16)}
        <input type="search" .value=${this.q} autocomplete="off" spellcheck="false"
          placeholder=${where === 'hero' ? 'Ask a question, or search metrics, tables, dashboards and terms' : 'Search or ask a question'}
          @input=${(e) => { this.q = e.target.value; this._sugIdx = 0; this._resIdx = -1; this._sugOpen = where; }}
          @keydown=${(e) => this._onSearchKey(e, where)} @keyup=${this._stopKeys} @keypress=${this._stopKeys}
          @focus=${() => { this._sugOpen = where; }} @blur=${() => setTimeout(() => { if (this._sugOpen === where) this._sugOpen = false; }, 180)}
          aria-label="Search the catalog" aria-expanded=${open ? 'true' : 'false'}>
        <kbd>/</kbd>
        ${open && !(this.route.view === 'search' && where === 'top' && this.q.trim()) ? this._sugPanel(where) : nothing}
      </div>`;
  }

  _quick() {
    const key = `${this._scope}|${this.q}`;
    if (this._quickKey === key && this._quickUsage === this._usage) return this._quickRes;
    this._quickKey = key;
    this._quickUsage = this._usage;
    this._quickRes = this.q.trim() ? runSearch(this.q, { hideHidden: true, ...(SCOPES[this._scope] || {}) }, this._usage) : null;
    return this._quickRes;
  }

  /* Live results, grouped: the answer first, then up to four per type. */
  _sugGroups() {
    const r = this._quick();
    if (!r) return [];
    const groups = [];
    if (r.answer) groups.push({ g: 'answer', label: 'Answer', items: [{ kind: 'answer', r }] });
    const order = ['metric', 'table', 'dashboard', 'term', 'product', 'question', 'rule', 'explore', 'view', 'dimension'];
    const per = this._scope === 'all' ? 3 : 8;
    order.forEach((g) => {
      if (this._scope !== 'all' && !(SCOPE_GROUPS[this._scope] || []).includes(g)) return;
      const items = r.results.filter((x) => TYPE_GROUP[x.d.type] === g).slice(0, per).map((x) => ({ kind: 'doc', d: x.d }));
      if (items.length) groups.push({ g, label: (TYPE_FACETS.find((t) => t[0] === g) || [])[1], items, total: r.results.filter((x) => TYPE_GROUP[x.d.type] === g).length });
    });
    return this._scope === 'all' ? groups.slice(0, 6) : groups;
  }

  _sugItems() { return this._sugGroups().flatMap((g) => g.items); }

  _scopeTabs() {
    return html`<div class="sug-scopes" @mousedown=${(e) => e.preventDefault()}>${Object.keys(SCOPES).map((k) => html`
      <button class=${this._scope === k ? 'is-on' : ''} @click=${() => { this._scope = k; this._sugIdx = 0; }}>${SCOPE_LABEL[k]}</button>`)}</div>`;
  }

  _sugPanel(where) {
    if (!this.q.trim()) {
      const recentV = this._recentV.slice(0, 4);
      return html`
        <div class="dc-sug is-panel" role="listbox" @mousedown=${(e) => e.preventDefault()}>
          <div class="sug-cols">
            <div>
              ${this._recentQ.length ? html`<div class="sug-h">Recent searches</div>${this._recentQ.slice(0, 4).map((t) => html`<button class="dc-sug-row" @click=${() => this._doSearch(t)}>${icon('search', 13)}<span class="dc-sug-t">${t}</span></button>`)}` : nothing}
              ${recentV.length ? html`<div class="sug-h">Recently viewed</div>${recentV.map((v) => html`<button class="dc-sug-row" @click=${() => { this._sugOpen = false; this._open(v.id); }}>${this._kindBadge(v.type, v.layer, true)}<span class="dc-sug-t">${v.title}</span></button>`)}` : nothing}
              <div class="sug-h">Suggested questions</div>
              ${IX.questions.slice(0, 5).map((q) => html`<button class="dc-sug-row" @click=${() => this._doSearch(q.q)}>${icon('question', 13)}<span class="dc-sug-t">${q.q}</span></button>`)}
            </div>
            <div>
              <div class="sug-h">Try</div>
              ${examples().map((t) => html`<button class="dc-sug-row" @click=${() => this._doSearch(t)}>${icon('arrow', 13)}<span class="dc-sug-t">${t}</span></button>`)}
              <div class="sug-h">Browse</div>
              ${[['metrics', 'Metrics'], ['dashboards', 'Dashboards'], ['products', 'Data products'], ['glossary', 'Glossary']].map(([v, l]) => html`<button class="dc-sug-row" @click=${() => { this._sugOpen = false; this._go(v); }}>${icon(NAV.flatMap((g) => g.items).find((x) => x.id === v).icon, 13)}<span class="dc-sug-t">${l}</span></button>`)}
            </div>
          </div>
        </div>`;
    }
    const groups = this._sugGroups();
    const r = this._quick();
    let idx = -1;
    return html`
      <div class="dc-sug is-panel" role="listbox" @mousedown=${(e) => e.preventDefault()}>
        ${this._scopeTabs()}
        ${r.corrections.length ? html`<div class="sug-note">Showing results for <b>${r.terms.join(' ')}</b></div>` : nothing}
        <div class="sug-body">
        ${groups.map((g) => html`
          <div class="sug-group">
            <div class="sug-h">${g.label}${g.total > g.items.length ? html`<span class="sug-n">${fmtInt(g.total)}</span>` : nothing}</div>
            ${g.items.map((it) => { idx += 1; const i = idx; return it.kind === 'answer' ? html`
              <button class="dc-sug-row is-answer ${i === this._sugIdx ? 'is-on' : ''}" @mouseenter=${() => { this._sugIdx = i; }} @click=${() => this._doSearch(this.q)}>
                <span class="kb t-know is-compact">${icon('question', 12)}</span>
                <span class="sug-main"><span class="dc-sug-t">${this._answerTitle(it.r.answer)}</span><span class="dc-sug-s">${this._answerSub(it.r.answer)}</span></span>
              </button>` : html`
              <button class="dc-sug-row ${i === this._sugIdx ? 'is-on' : ''}" @mouseenter=${() => { this._sugIdx = i; }} @click=${() => { this._sugOpen = false; this._openDoc(it.d); }}>
                ${this._kindBadge(it.d.type, it.d.layer, true)}
                <span class="sug-main"><span class="dc-sug-t">${hl(it.d.title, r.hlTerms)}</span><span class="dc-sug-s mono">${it.d.sub}</span></span>
              </button>`; })}
          </div>`)}
        ${!groups.length ? html`<div class="sug-note">No matches${this._scope !== 'all' ? ` in ${SCOPE_LABEL[this._scope]}` : ''}. Press Enter to search everything.</div>` : nothing}
        </div>
        <button class="dc-sug-all" @click=${() => this._doSearch(this.q)}>See all ${r.results.length ? fmtInt(r.results.length) : ''} results for “${this.q}” ${icon('arrow', 14)}<span class="sug-keys">↑ ↓ to move, Enter to open, Esc to close</span></button>
      </div>`;
  }

  _answerSub(a) {
    if (a.kind === 'question') return 'Verified question';
    const f = IX.field.get(a.field);
    return a.kind === 'lineage' ? `Lineage of ${f ? f.id : ''}` : 'Best matching metric';
  }

  _onSearchKey(e, where) {
    e.stopPropagation();
    const onPage = this.route.view === 'search' && where === 'top' && this.q.trim();
    if (onPage) {
      const list = this._navList || [];
      if (e.key === 'ArrowDown') { e.preventDefault(); this._resIdx = Math.min((this._resIdx ?? -1) + 1, list.length - 1); this._scrollRes(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._resIdx = Math.max((this._resIdx ?? 0) - 1, -1); this._scrollRes(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this._resIdx >= 0 && list[this._resIdx]) this._openDoc(list[this._resIdx]);
        else this._doSearch(this.q);
        return;
      }
      if (e.key === 'Escape') { e.target.blur(); }
      return;
    }
    const items = this._sugOpen === where ? this._sugItems() : [];
    if (e.key === 'ArrowDown') { e.preventDefault(); this._sugIdx = Math.min(this._sugIdx + 1, Math.max(items.length - 1, 0)); this._scrollSug(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._sugIdx = Math.max(this._sugIdx - 1, 0); this._scrollSug(); }
    else if (e.key === 'Tab' && this.q.trim() && this._sugOpen === where) {
      e.preventDefault();
      const keys = Object.keys(SCOPES);
      this._scope = keys[(keys.indexOf(this._scope) + (e.shiftKey ? keys.length - 1 : 1)) % keys.length];
      this._sugIdx = 0;
    }
    else if (e.key === 'Escape') { this._sugOpen = false; e.target.blur(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[this._sugIdx];
      if (it && it.kind === 'doc') { this._sugOpen = false; this._openDoc(it.d); } else this._doSearch(this.q);
    }
  }

  _scrollSug() {
    this.updateComplete.then(() => { const el = this.querySelector('.dc-sug .dc-sug-row.is-on'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); });
  }

  _scrollRes() {
    this.updateComplete.then(() => {
      const el = this.querySelector('.res.is-kb');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    });
  }

  _doSearch(q) {
    this.q = q;
    this._sugOpen = false;
    this._resIdx = -1;
    this.sf = this._scope !== 'all' && SCOPES[this._scope].type ? { type: SCOPES[this._scope].type } : {};
    const t = q.trim();
    if (t) this._recentQ = [t, ...this._recentQ.filter((x) => x !== t)].slice(0, 8);
    this._go('search');
  }

  _openDoc(d) {
    if (d.type === 'column') { this.colQ = d.name; this._go('node', d.node, 'columns'); this.colQ = d.name; return; }
    this._open(d.id);
  }

  _answerTitle(a) {
    if (a.kind === 'question') { const q = IX.questions.find((x) => x.id === a.question); return q ? q.q : ''; }
    const f = IX.field.get(a.field);
    return a.kind === 'lineage' ? `Where ${fieldTitle(f)} comes from` : fieldTitle(f);
  }

  /* ---------------- breadcrumbs and headers */

  _crumbs(extra = []) {
    const section = SECTION_OF[this.route.view];
    const items = [['Home', () => this._go('home')]];
    if (section && section !== 'home') items.push([SECTION_LABEL[section], () => this._go(section)]);
    extra.forEach((x) => items.push(x));
    return html`<nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, go, dom], i) => html`${i ? html`<span class="sep">/</span>` : nothing}${go && i < items.length - 1 ? html`<button class="lnk" @click=${go}>${dom ? domIcon(dom, 12) : nothing}<span>${label}</span></button>` : html`<span class="crumb-cur">${label}</span>`}`)}</nav>`;
  }

  /* Bento hero tile for asset pages: badge, title, path, description, chips, then a row of key facts. */
  _hero({ badge, title, mono = false, path = '', desc = '', descKind = 'lookml', chips = nothing, facts = [], side = nothing }) {
    const fs = facts.filter((f) => f && f.v !== undefined && f.v !== null && f.v !== '' && f.v !== 0 && f.v !== '0' && f.v !== '–');
    return html`
      <section class="hero-tile">
        <div class="hero-main">
          ${badge}
          <h1 class=${mono ? 'is-id' : ''} title=${title}>${title}</h1>
          ${path ? html`<div class="hero-path mono" title=${path}>${path}</div>` : nothing}
          ${desc ? html`<p class="hero-desc">${desc}</p>` : html`<p class="hero-desc is-empty">No description yet. Add one to the ${descKind === 'dbt' ? 'dbt schema file' : 'LookML'} so people know what this is.</p>`}
          <div class="chips">${chips}</div>
        </div>
        ${side}
      </section>
      ${fs.length ? html`<div class="facts">${fs.map((f) => html`<button class="fact ${f.go ? 'is-link' : ''} ${f.st || ''}" @click=${f.go || (() => {})}><span class="fact-v ${f.small ? 'is-sm' : ''}">${f.v}</span><span class="fact-l">${f.l}</span>${f.s ? html`<span class="fact-s">${f.s}</span>` : nothing}</button>`)}</div>` : nothing}`;
  }

  /* Rules that apply to an asset, a metric, a domain or a data product. */
  _rulesFor(kind, id) {
    return IX.rules.filter((r) => {
      if (kind === 'field') return r.m.includes(id);
      if (kind === 'node') {
        const n = IX.node.get(id);
        if (r.a.includes(id)) return true;
        if (n && n.k === 'view') return r.m.some((m) => (IX.field.get(m) || {}).v === n.name);
        if (n && n.k === 'dashboard') return r.m.some((m) => (IX.field.get(m)?.dash || []).includes(id));
        if (n && n.k === 'explore') return r.m.some((m) => (IX.field.get(m)?.ex || []).includes(n.name));
        return false;
      }
      if (kind === 'udd') return r.lds.includes(id) || r.m.some((m) => (this._usage.fieldDash.get(m) || new Set()).has(id));
      if (kind === 'domain') return r.dom === id;
      if (kind === 'product') { const p = IX.product.get(id); return p && (r.m.some((m) => p.m.includes(m)) || r.a.some((a) => p.assets.includes(a))); }
      return false;
    });
  }

  _rulesTile(rules, title = 'Rules that apply') {
    if (!rules.length) return nothing;
    return html`<section class="card">
      <div class="card-h"><h2>${title}</h2><span class="muted small">${plural(rules.length, 'rule')}</span></div>
      <ul class="rule-list">${rules.map((r) => html`<li><button class="rule-row" @click=${() => this._go('rule', r.id)}>
        <span class="acc-tile cat-${r.cat}">${icon(RULE_CAT[r.cat]?.icon || 'rule', 14)}</span>
        <span class="rule-main"><span class="rule-t">${r.t}</span><span class="rule-d">${r.d}</span></span>
        ${this._draftChip(r)}</button></li>`)}</ul>
    </section>`;
  }

  /* Possible conflicts: one business term, several metrics that calculate it differently. */
  _conflicts() {
    if (this._conflictCache) return this._conflictCache;
    const out = [];
    (META.glossary || []).forEach((t) => {
      const stems = t.t.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).map((w) => w.slice(0, 5));
      if (!stems.length) return;
      const ms = [...IX.field.values()].filter((f) => { const txt = `${f.n} ${f.l || ''}`.toLowerCase(); return f.k === 'measure' && !f.hid && !/target|budget|forecast|variance|prior|count|task|issue/.test(txt)
        && stems.every((x) => txt.includes(x)) && (f.ty || '').match(/sum|average|number|max|min|avg/); });
      const sqls = new Set(ms.map((f) => String(f.sql || '').replace(/\s+/g, ' ').trim()));
      if (ms.length >= 3 && sqls.size >= 2) out.push({ term: t.t, metrics: ms.map((f) => f.id), distinct: sqls.size });
    });
    this._conflictCache = out;
    return out;
  }

  _draftChip(item) {
    if (!item || item.st === 'confirmed') return item && item.own ? html`<span class="chip">Owner: ${item.own}</span>` : nothing;
    return html`<span class="chip t-lemon is-draft" title="Drafted by the catalog build. Confirm it in catalog_builder/knowledge.yml or glossary.yml.">Draft, needs an owner</span>`;
  }

  /* ---------------- open in Looker */

  _lookerUrl(kind, id) {
    const base = String((META.client && META.client.looker_instance) || '').replace(/\/$/, '');
    if (!base) return '';
    if (kind === 'explore') return `${base}/explore/${this._model()}/${id}`;
    return `${base}/dashboards/${id}`;
  }

  _lookerBlock(kind, id, label) {
    const url = this._lookerUrl(kind, id);
    if (!url) return nothing;
    const canDrill = kind === 'explore' && isDrillingActive();
    return html`
      <div class="lk">
        <div class="lk-h">${icon('link', 14)}<span>Open in Looker</span></div>
        ${canDrill ? html`<button class="btn is-primary is-block" @click=${(e) => openTileDrillMenu([{ type: 'drill', label: `Explore ${label}`, url: `/explore/${this._model()}/${id}` }], e)}>Explore ${label}</button>` : nothing}
        <div class="lk-row">
          <input class="lk-url mono" readonly .value=${url} @focus=${(e) => e.target.select()} @keydown=${this._stopKeys} aria-label="Looker link">
          <button class="btn" @click=${(e) => this._copy(url, e)}>${this._copied === url ? 'Copied' : 'Copy'}</button>
        </div>
        <p class="muted small">${canDrill ? 'Or copy the link.' : 'Looker tiles cannot open new tabs, so copy the link and paste it into your browser.'}</p>
      </div>`;
  }

  async _copy(text, e) {
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (err) { ok = false; }
    if (!ok) {
      const input = e && e.target && e.target.parentElement && e.target.parentElement.querySelector('input');
      if (input) { input.focus(); input.select(); try { ok = document.execCommand('copy'); } catch (err) { ok = false; } }
    }
    this._copied = ok ? text : '';
    if (!ok) this._toastMsg = 'Copying is blocked here. The link is selected: press Cmd+C or Ctrl+C.';
    this.requestUpdate();
    setTimeout(() => { this._copied = ''; this._toastMsg = ''; this.requestUpdate(); }, 3500);
  }

  /* ---------------- home */

  _renderHome() {
    const M = META;
    const health = this._health();
    const u = this._usage;
    const uses = (f) => this._usage.fields.get(f.id) || 0;
    const popular = [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid && !isPlumbing(IX.node.get(`view.${f.v}`)))
      .sort((a, b) => uses(b) - uses(a) || this._fieldScore(b) - this._fieldScore(a)).slice(0, 6);
    const changed = [...IX.node.values()].filter((n) => n.chg && !isPlumbing(n) && ['model', 'view', 'dashboard'].includes(n.k) && (n.k !== 'model' || n.layer === 'warehouse') && (n.k !== 'view' || (IX.exploresByView.get(n.name) || []).length))
      .sort((a, b) => b.chg.localeCompare(a.chg) || titleOf(a).localeCompare(titleOf(b))).slice(0, 7);
    const tasks = [
      { icon: 'metric', t: 'Find a metric', d: 'Look up what a number means, how it is calculated and where to use it.', go: () => { this.mScope = 'key'; this._go('metrics'); } },
      { icon: 'dashboard', t: 'Understand a dashboard', d: 'See the metrics behind each dashboard and who uses it.', go: () => this._go('dashboards') },
      { icon: 'lineage', t: 'Trace where a number comes from', d: 'Follow a metric back through Looker and dbt to the source system.', go: () => this._doSearch('where does utilisation come from') },
      { icon: 'health', t: 'Check data quality', d: 'Find undocumented and untested tables and broken fields.', go: () => this._go('health') },
    ];
    return html`
      <section class="hero">
        <div class="eyebrow">${M.client.name} · ${M.client.product}</div>
        <h1 class="hero-t">What do you want to know?</h1>
        <p class="hero-d">${M.client.tagline || ''}</p>
        ${this._searchBox('hero')}
        <div class="hero-try"><span>Try</span>${examples().map((t) => html`<button class="chip is-link" @click=${() => this._doSearch(t)}>${t}</button>`)}</div>
      </section>

      <button class="health-band" @click=${() => this._go('health')}>
        <span class="hb-score"><b class=${st(health.score)}>${health.score}</b><span>of 100</span></span>
        <span class="hb-title">Documentation health</span>
        ${health.items.slice(0, 4).map((it) => html`<span class="hb-item ${st(it.pct)}"><span class="hb-bar"><i style="width:${it.pct}%"></i></span><span class="hb-v">${it.pct}%</span><span class="hb-l">${it.label}</span></span>`)}
        <span class="hb-go">See the gaps ${icon('arrow', 14)}</span>
      </button>

      <section>
        <div class="sec-h"><h2>Start here</h2></div>
        <div class="tasks">${tasks.map((t) => html`
          <button class="task" @click=${t.go}>
            <span class="task-ic">${icon(t.icon, 18)}</span>
            <span class="task-t">${t.t}</span>
            <span class="task-d">${t.d}</span>
            <span class="task-go">${icon('arrow', 14)}</span>
          </button>`)}</div>
      </section>

      ${this._recentV.length ? html`<section class="card"><div class="card-h"><h2>You looked at</h2><span class="muted small">This session</span></div>
        <div class="chips">${this._recentV.slice(0, 8).map((v) => html`<button class="lnk" @click=${() => this._open(v.id)}>${this._kindBadge(v.type, v.layer, true)}<span>${v.title}</span></button>`)}</div></section>` : nothing}

      <div class="grid-3">
        <section class="card">
          <div class="card-h"><h2>Popular metrics</h2><button class="lnk-btn" @click=${() => this._go('metrics')}>All metrics ${icon('arrow', 14)}</button></div>
          <ol class="rank">${popular.map((f) => html`<li><button class="rank-row" @click=${() => this._go('field', f.id)}><span class="rank-t"><span class="rank-tx">${fieldTitle(f)}</span></span><span class="rank-s">${uses(f) ? `${fmtCompact(uses(f))} uses` : (f.dash.length ? plural(f.dash.length, 'dashboard') : '')}</span></button></li>`)}</ol>
        </section>
        <section class="card">
          <div class="card-h"><h2>Popular dashboards</h2><button class="lnk-btn" @click=${() => this._go('dashboards')}>All dashboards ${icon('arrow', 14)}</button></div>
          ${u.state === 'loading' ? html`<div class="skel is-short"></div>` : (u.dashboards && u.dashboards.length ? html`
            <ol class="rank">${u.dashboards.slice(0, 6).map((d) => html`<li><button class="rank-row" @click=${() => this._go('udd', d.id)}><span class="rank-t"><span class="rank-tx">${d.title}</span></span><span class="rank-s">${fmtCompact(d.runs)} queries</span></button></li>`)}</ol>` : this._empty(u.state === 'ok' ? 'No dashboard queries recorded in the last 90 days.' : 'Needs access to Looker System Activity.'))}
        </section>
        <section class="card">
          <div class="card-h"><h2>Recently changed</h2><span class="muted small">From the repos</span></div>
          ${changed.length ? html`<ol class="rank">${changed.map((n) => html`<li><button class="rank-row" @click=${() => this._open(n.id)}><span class="rank-t">${this._kindBadge(n.k, layerOf(n), true)}<span class="rank-tx">${titleOf(n)}</span></span><span class="rank-s">${shortDate(n.chg)}</span></button></li>`)}</ol>` : this._empty('No recent changes found.')}
        </section>
      </div>

      ${IX.product.size ? html`<section>
        <div class="sec-h"><h2>Data products</h2><button class="lnk-btn" @click=${() => this._go('products')}>All data products ${icon('arrow', 14)}</button></div>
        <div class="prod-grid">${[...IX.product.values()].slice(0, 6).map((p) => this._productCard(p, true))}</div>
      </section>` : nothing}



      <section>
        <div class="sec-h"><h2>Browse by domain</h2><button class="lnk-btn" @click=${() => this._go('domains')}>All domains ${icon('arrow', 14)}</button></div>
        <div class="chips">${(M.domains || []).filter((d) => d.id !== 'other').map((d) => html`<button class="chip is-link is-lg" @click=${() => this._go('domain', d.id)}>${d.label}</button>`)}</div>
      </section>
      ${this._footer()}`;
  }

  /* ---------------- search page */

  _renderSearch() {
    const q = this.q.trim();
    if (!q) return this._searchStart();
    const r = runSearch(q, { ...this.sf, hideHidden: !this.sf.hidden }, this._usage);
    const f = r.f;
    const flat = !!(f.type);
    const groups = [];
    if (!flat) {
      const order = r.parsed.intent ? ['question', 'metric', 'term', 'dashboard', 'explore', 'table', 'rule', 'product', 'view', 'dimension', 'column'] : ['term', 'product', 'metric', 'dashboard', 'explore', 'table', 'view', 'question', 'rule', 'dimension', 'column'];
      order.forEach((g) => { const items = r.results.filter((x) => TYPE_GROUP[x.d.type] === g); if (items.length) groups.push({ g, items }); });
    }
    const list = flat ? r.results.slice(0, this.sLimit) : groups.flatMap((g) => g.items.slice(0, g.g === 'column' ? 4 : 5));
    this._navList = list.map((x) => x.d);
    const chips = [];
    if (r.parsed.f.type) chips.push(['type', (TYPE_FACETS.find((t) => t[0] === r.parsed.f.type) || [])[1]]);
    if (r.parsed.f.layer) chips.push(['layer', `${(LAYERS[r.parsed.f.layer] || {}).label} layer`]);
    if (r.parsed.f.dom) chips.push(['dom', (IX.domain.get(r.parsed.f.dom) || {}).label]);
    if (r.parsed.f.doc) chips.push(['doc', r.parsed.f.doc === 'no' ? 'No description' : 'Described']);
    r.parsed.chips.forEach((c) => chips.push(c));
    let idx = -1;
    const row = (x) => { idx += 1; return this._resultRow(x, r, idx); };
    return html`
      ${this._crumbs([[`“${q}”`, null]])}
      <div class="s-layout">
        <aside class="facets ${this._fOpen ? 'is-open' : ''}">
          <button class="btn f-toggle" @click=${() => { this._fOpen = !this._fOpen; this.requestUpdate(); }}>${icon('domain', 14)} ${this._fOpen ? 'Hide filters' : 'Filters'}${Object.keys(this.sf).filter((k) => k !== 'hidden').length ? ` (${Object.keys(this.sf).filter((k) => k !== 'hidden').length})` : ''}</button>
          <div class="f-body">${this._facetPanel(r)}</div>
        </aside>
        <div class="s-main">
          <div class="s-head">
            <h1 class="s-title">${fmtInt(r.results.length)} ${r.results.length === 1 ? 'result' : 'results'} <span class="muted">for “${q}”</span></h1>
            ${chips.length ? html`<div class="chips s-chips"><span class="muted small">Read as</span>${chips.map(([k, label]) => html`<span class="chip is-filter">${label}</span>`)}</div>` : nothing}
            ${r.corrections.length ? html`<p class="dym">Showing results for <b>${r.corrections.reduce((s, [a, b]) => s.replace(new RegExp(`\\b${escapeRe(a)}\\b`, 'i'), b), q)}</b>. <button class="lnk" @click=${() => this._doSearch(`"${q}"`)}><span>Search only for “${q}”</span></button></p>` : nothing}
            ${!r.results.length ? this._noResults(r) : nothing}
            ${r.termHits && r.termHits.length && !r.parsed.f.type ? html`<p class="syn small">Includes metrics for ${r.termHits.slice(0, 5).map((t, i) => html`${i ? ', ' : ''}<button class="lnk" @click=${() => this._go('term', t.t)}><span>${t.t}</span></button>`)} from the glossary.</p>` : nothing}
          </div>
          ${r.answer ? this._answerCard(r.answer) : nothing}
          ${flat ? html`<div class="results">${list.map(row)}</div>
            ${r.results.length > this.sLimit ? html`<button class="more" @click=${() => { this.sLimit += 50; }}>Show more</button>` : nothing}` : groups.map((g) => html`
            <section class="r-group">
              <div class="r-group-h"><h2>${(TYPE_FACETS.find((t) => t[0] === g.g) || [])[1]}</h2><span class="muted small">${fmtInt(g.items.length)}</span>
                ${g.items.length > (g.g === 'column' ? 4 : 5) ? html`<button class="lnk-btn" @click=${() => { this.sf = { ...this.sf, type: g.g }; this.sLimit = 50; }}>Show all ${fmtInt(g.items.length)} ${icon('arrow', 13)}</button>` : nothing}</div>
              <div class="results">${g.items.slice(0, g.g === 'column' ? 4 : 5).map(row)}</div>
            </section>`)}
          <p class="muted small s-help">Use ↑ and ↓ in the search box to move through results and Enter to open one.</p>
        </div>
      </div>`;
  }

  _noResults(r) {
    const near = r.terms.map((t) => correctWord(t)).filter(Boolean);
    return html`<div class="empty is-big">${icon('search', 22)}<p>Nothing matches.</p>
      ${near.length ? html`<p>Did you mean <button class="lnk" @click=${() => this._doSearch(near.join(' '))}><span>${near.join(' ')}</span></button>?</p>` : html`<p class="muted small">Try fewer words, a table or field name, or clear the filters.</p>`}
      ${Object.keys(this.sf).length ? html`<button class="btn" @click=${() => { this.sf = {}; }}>Clear filters</button>` : nothing}</div>`;
  }

  _facetPanel(r) {
    const sf = this.sf;
    const set = (k, v) => { const n = { ...this.sf }; if (n[k] === v) delete n[k]; else n[k] = v; this.sf = n; this.sLimit = 50; this._resIdx = -1; };
    const group = (k, title, values) => {
      const vals = values.filter(([v]) => (r.facets[k].get(v) || 0) > 0 || sf[k] === v);
      if (!vals.length) return nothing;
      return html`<div class="fg"><div class="fg-h">${title}</div>${vals.map(([v, label]) => html`
        <button class="fv ${sf[k] === v || (r.parsed.f[k] === v && !(k in sf)) ? 'is-on' : ''}" @click=${() => set(k, v)}>
          <span class="fv-l">${label}</span><span class="fv-n">${fmtInt(r.facets[k].get(v) || 0)}</span></button>`)}</div>`;
    };
    const owners = [...r.facets.owner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v]) => [v, v]);
    return html`
      <div class="fg-top"><span>Filter</span>${Object.keys(sf).filter((k) => k !== 'hidden').length ? html`<button class="lnk-btn" @click=${() => { this.sf = {}; }}>Clear</button>` : nothing}</div>
      ${group('type', 'Type', TYPE_FACETS)}
      ${group('used', 'Used on dashboards', [['yes', 'Yes'], ['no', 'No']])}
      ${group('doc', 'Described', [['yes', 'Yes'], ['no', 'No']])}
      ${group('prod', 'Data product', [...IX.product.values()].map((p) => [p.id, p.name]))}
      ${group('dom', 'Domain', (META.domains || []).map((d) => [d.id, html`<span class="fv-dom">${domIcon(d.id, 12)}${d.label}</span>`]))}
      ${group('layer', 'Layer', ['source', 'staging', 'integration', 'warehouse', 'seed', 'external'].map((l) => [l, LAYERS[l].label]))}
      ${group('owner', 'Owner', owners)}
      <label class="tog fg-tog"><input type="checkbox" .checked=${!!sf.hidden} @change=${(e) => { this.sf = { ...this.sf, hidden: e.target.checked || undefined }; }}><span>Include hidden fields</span></label>`;
  }

  _resultRow(x, r, idx) {
    const d = x.d;
    const extra = [];
    if (d.type === 'measure' || d.type === 'dimension') {
      const f = IX.field.get(d.id);
      const dashN = f.dash.length + ((this._usage.fieldDash.get(f.id) || new Set()).size);
      if (dashN) extra.push(html`<span class="chip">${plural(dashN, 'dashboard')}</span>`);
      const uses = this._usage.fields.get(f.id);
      if (uses) extra.push(html`<span class="chip">${fmtCompact(uses)} uses</span>`);
    }
    if (d.type === 'udd') extra.push(html`<span class="chip">${fmtCompact(d.runs)} queries</span>`);
    (d.prod || []).slice(0, 1).forEach((p) => extra.push(html`<span class="chip t-know">${(IX.product.get(p) || {}).name}</span>`));
    if (d.terms && d.terms.length) extra.push(html`<span class="chip t-know">${d.terms[0]}</span>`);
    if (IX.domain.get(d.dom) && !['term', 'product', 'rule', 'question'].includes(d.type)) extra.push(html`<span class="chip">${IX.domain.get(d.dom).label}</span>`);
    return html`
      <button class="res ${idx === this._resIdx ? 'is-kb' : ''}" @click=${() => this._openDoc(d)} @mouseenter=${() => { this._resIdx = idx; }}>
        <div class="res-l">${this._kindBadge(d.type, d.layer)}</div>
        <div class="res-m">
          <div class="res-t"><span class="res-tt">${hl(d.title, r.hlTerms)}</span>${d.sub && d.sub !== d.title ? html`<span class="res-s mono">${hl(d.sub, r.hlTerms)}</span>` : nothing}</div>
          ${x.snip ? html`<div class="res-d mono">${hl(x.snip, [r.f.sql.toLowerCase()])}</div>` : (d.d ? html`<div class="res-d">${hl(d.d, r.hlTerms)}</div>` : html`<div class="res-d is-empty">No description</div>`)}
        </div>
        <div class="res-r">${extra}</div>
      </button>`;
  }

  _answerCard(a) {
    if (a.kind === 'question') {
      const q = IX.questions.find((x) => x.id === a.question);
      if (!q) return nothing;
      return html`
        <section class="answer">
          <div class="answer-h"><span class="eyebrow">Verified question</span>${this._draftChip(q)}</div>
          <h2 class="answer-t">${q.q}</h2>
          <p class="answer-d">${q.a}</p>
          ${this._answerLinks(q.m, q.x, q.dsh, q.ld)}
        </section>`;
    }
    const f = IX.field.get(a.field);
    if (!f) return nothing;
    const tree = this._derive(f.id, 0, new Set());
    const st = this._treeStats(tree);
    const phys = physicalNodeOfView(f.v);
    const live = [...(this._usage.fieldDash.get(f.id) || new Set())].sort((x, y) => ((this._usage.dashFields.get(y) || {}).runs || 0) - ((this._usage.dashFields.get(x) || {}).runs || 0))[0];
    return html`
      <section class="answer">
        <div class="answer-h"><span class="eyebrow">${a.kind === 'lineage' ? 'Where it comes from' : 'Best match'}</span>${(f.gl || []).length ? html`<span class="chip t-know">${f.gl[0]}</span>` : nothing}</div>
        <h2 class="answer-t">${fieldTitle(f)} <span class="mono muted small">${f.id}</span></h2>
        <p class="answer-d">${f.d || 'No description yet.'}</p>
        ${a.kind === 'lineage' ? (() => {
          const srcN = phys ? upstreamChain(phys.id, 8).filter((c) => IX.node.get(c.id)?.k === 'source').length : 0;
          const steps = [html`${icon('metric', 13)} Looker metric`, st.fields ? plural(st.fields, 'field') : '', st.columns ? plural(st.columns, 'column') : '', phys ? phys.name : '', srcN ? plural(srcN, 'source table') : ''].filter(Boolean);
          return html`<div class="answer-path">${steps.map((x, i) => html`${i ? icon('back', 12) : nothing}<span class="ap-step">${x}</span>`)}</div>`;
        })() : nothing}
        ${(() => {
          const rules = IX.rules.filter((r) => r.m.includes(f.id) || (a.term && r.terms.includes(a.term)) || (f.gl || []).some((t) => r.terms.includes(t)));
          return rules.length ? html`<div class="answer-rules">${rules.slice(0, 3).map((r) => html`<button class="answer-rule" @click=${() => this._go('rule', r.id)}>${icon('rule', 13)}<span><b>${r.t}.</b> ${r.d}</span></button>`)}</div>` : nothing;
        })()}
        ${this._answerLinks(f.id, f.ex[0] || '', f.dash[0] || '', live || '')}
      </section>`;
  }

  _answerLinks(fid, ex, dsh, ld) {
    const f = IX.field.get(fid);
    const phys = f ? physicalNodeOfView(f.v) : null;
    const dashes = [];
    const seen = new Set();
    const addDash = (id, title, go) => { const k = title.trim().toLowerCase(); if (seen.has(id) || seen.has(k)) return; seen.add(id); seen.add(k); dashes.push({ title, go }); };
    if (dsh && IX.node.has(dsh)) addDash(dsh, titleOf(IX.node.get(dsh)), () => this._go('node', dsh));
    if (ld && this._usage.dashFields.get(ld)) addDash(`udd.${ld}`, this._usage.dashFields.get(ld).title, () => this._go('udd', ld));
    return html`<div class="answer-links">
      ${f ? html`<button class="btn is-primary" @click=${() => this._go('field', fid)}>${icon('metric', 14)} ${fieldTitle(f)}</button>` : nothing}
      ${ex && IX.node.has(`explore.${ex}`) ? html`<button class="btn" @click=${() => this._go('node', `explore.${ex}`)}>${icon('explore', 14)} ${titleOf(IX.node.get(`explore.${ex}`))}</button>` : nothing}
      ${dashes.map((d) => html`<button class="btn" @click=${d.go}>${icon('dashboard', 14)} ${d.title}</button>`)}
      ${phys ? html`<button class="btn" @click=${() => this._go('lineage', phys.id)}>${icon('lineage', 14)} Lineage</button>` : nothing}
    </div>`;
  }

  /* ---------------- knowledge: data products */

  _productStats(p) {
    if (!this._pstat) this._pstat = new Map();
    if (this._pstat.has(p.id)) return this._pstat.get(p.id);
    const nodes = p.assets.map((a) => IX.node.get(a)).filter(Boolean);
    const tables = nodes.filter((n) => ['model', 'source', 'seed', 'snapshot', 'table'].includes(n.k));
    const tests = tables.flatMap((n) => n.tests);
    const byType = new Map();
    tests.forEach((t) => byType.set(t.t, (byType.get(t.t) || 0) + 1));
    const dates = tables.map((n) => n.modified).filter(Boolean).sort();
    const cols = tables.flatMap((n) => n.cols.filter((c) => !c.nest && !c.gone));
    const s = {
      tables, explores: nodes.filter((n) => n.k === 'explore'), dashboards: nodes.filter((n) => n.k === 'dashboard'),
      tests: tests.length, byType, untested: tables.filter((n) => !n.tests.length), missing: tables.filter((n) => n.whErr === 'missing'),
      oldest: dates[0] || '', newest: dates[dates.length - 1] || '', cols: cols.length, colsDoc: cols.filter((c) => c.doc).length,
      described: tables.filter((n) => n.d).length,
    };
    this._pstat.set(p.id, s);
    return s;
  }

  _productCard(p, compact = false) {
    const s = this._productStats(p);
    return html`
      <button class="prod-card acc-${[...IX.product.keys()].indexOf(p.id) % 7}" @click=${() => this._go('product', p.id)}>
        <div class="prod-top"><span class="acc-tile">${icon('product', 13)}</span><span class="prod-t">${p.name}</span></div>
        <div class="prod-d">${p.d}</div>
        <div class="prod-f">
          <span><b>${s.tables.length}</b> tables</span><span><b>${p.m.length}</b> metrics</span><span><b>${s.dashboards.length + p.lds.length}</b> dashboards</span>
          ${compact ? nothing : html`<span><b>${fmtInt(s.tests)}</b> dbt tests</span>`}
        </div>
        <div class="prod-b">${this._draftChip(p)}${s.newest ? html`<span class="muted small">Data updated ${shortDate(s.oldest === s.newest ? s.newest : s.oldest)}</span>` : nothing}</div>
      </button>`;
  }

  _renderProducts() {
    return html`
      ${this._pageHead('Knowledge', 'Data products', 'Curated sets of tables, explores, metrics and dashboards for one business need, each with a purpose, an owner, its data quality and how fresh it is.')}
      <div class="prod-grid is-wide">${[...IX.product.values()].map((p) => this._productCard(p))}</div>
      ${!IX.product.size ? this._empty('No data products yet. Add them to catalog_builder/knowledge.yml.') : nothing}`;
  }

  _renderProduct(id) {
    const p = IX.product.get(id);
    if (!p) return this._empty('This data product is not in the catalog.');
    const s = this._productStats(p);
    const metrics = p.m.map((m) => IX.field.get(m)).filter(Boolean);
    const rules = this._rulesFor('product', p.id);
    const qs = IX.questions.filter((q) => p.m.includes(q.m) || (q.x && p.assets.includes(`explore.${q.x}`)));
    const terms = (META.glossary || []).filter((t) => t.m.some((m) => p.m.includes(m)));
    const testTypes = [...s.byType.entries()].sort((a, b) => b[1] - a[1]);
    return html`
      ${this._crumbs([[p.name, null]])}
      <div class="ah"><div class="ah-main">
        <span class="kb t-know">${icon('product', 12)}<span>Data product</span></span>
        <h1>${p.name}</h1>
        <p class="desc">${p.d}</p>
        <div class="chips">${this._draftChip(p)}${p.sown && !p.own ? html`<span class="chip">Suggested owner: ${p.sown}</span>` : nothing}${p.ref ? html`<span class="chip">Refresh: ${p.ref}</span>` : nothing}${(p.use || []).map((u) => html`<span class="chip is-tag">${u}</span>`)}</div>
      </div></div>
      <div class="stat-row">
        ${this._stat(fmtInt(s.tables.length), 'Tables', `${s.described} described`)}
        ${this._stat(fmtInt(metrics.length), 'Metrics')}
        ${this._stat(fmtInt(s.dashboards.length + p.lds.length), 'Dashboards')}
        ${this._stat(fmtInt(s.tests), 'dbt tests', `${s.tables.length - s.untested.length} of ${s.tables.length} tables tested`)}
        ${this._stat(s.oldest ? shortDate(s.oldest) : '–', 'Oldest data update', s.newest && s.newest !== s.oldest ? `Newest ${shortDate(s.newest)}` : 'From BigQuery')}
      </div>
      <section class="card is-flush">
        <div class="card-h pad"><h2>Lineage</h2><span class="muted small">Source systems to dbt to Looker to dashboards, for this product's assets</span></div>
        ${(this._plFull || new Set()).has(p.id) ? html`
          ${this._lineageGraph(`prod:${p.id}`, '', 0, 0, false, this._productLayout(p), new Set(p.assets))}
          <div class="pad-x"><button class="btn" @click=${() => { this._plFull.delete(p.id); this.requestUpdate(); }}>${icon('back', 14)} Back to the summary</button> ${this._legend()}</div>` : html`
          ${this._productFlow(p)}
          <div class="pad-x"><button class="btn" @click=${() => { this._plFull = this._plFull || new Set(); this._plFull.add(p.id); this.requestUpdate(); }}>${icon('lineage', 14)} See full lineage</button></div>`}
      </section>
      <section class="card is-flush"><div class="card-h pad"><h2>Metrics</h2></div>${this._metricTable(metrics, true)}</section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Tables</h2></div>
          <ul class="alist">${s.tables.map((n) => html`<li><button class="arow is-4" @click=${() => this._open(n.id)}>
            ${this._kindBadge(n.k, layerOf(n), true)}<span class="arow-t">${n.name}</span>
            <span class="arow-d">${n.whErr === 'missing' ? 'Not found in the warehouse' : (n.wh ? `${n.bqType === 'view' ? 'View' : `${fmtCompact(n.rows)} rows`}, updated ${shortDate(n.modified)}` : '')}</span>
            <span class="arow-n">${n.tests.length ? plural(n.tests.length, 'test') : html`<span class="t-warn">No tests</span>`}</span></button></li>`)}</ul></section>
        <section class="card"><div class="card-h"><h2>Data quality</h2><span class="muted small">From dbt tests and BigQuery</span></div>
          <dl class="kv is-wide">
            <dt>dbt tests</dt><dd>${testTypes.length ? testTypes.map(([t, n]) => html`<span class="chip is-tiny">${t} ${n}</span>`) : 'None'}</dd>
            <dt>Tables with no tests</dt><dd>${s.untested.length ? s.untested.map((n) => this._nodeLink(n.id, { icon: false })) : 'None'}</dd>
            <dt>Columns described</dt><dd>${fmtInt(s.colsDoc)} of ${fmtInt(s.cols)} (${pct(s.colsDoc, s.cols)}%)</dd>
            <dt>Freshness</dt><dd>${s.oldest ? `Every table updated between ${shortDate(s.oldest)} and ${shortDate(s.newest)}` : 'Not known'}</dd>
            ${s.missing.length ? html`<dt>Missing tables</dt><dd class="t-warn">${s.missing.map((n) => n.name).join(', ')}</dd>` : nothing}
          </dl></section>
      </div>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Explores</h2></div>${s.explores.length ? html`<div class="chips">${s.explores.map((n) => this._nodeLink(n.id))}</div>` : this._empty('None listed.')}</section>
        <section class="card"><div class="card-h"><h2>Dashboards</h2></div>
          <div class="col-links">${s.dashboards.map((n) => this._nodeLink(n.id))}${p.lds.filter((ld) => { const d = this._usage.dashFields.get(ld); return !d || !s.dashboards.some((n) => titleOf(n) === d.title); }).map((ld) => { const d = this._usage.dashFields.get(ld); return html`<button class="lnk" @click=${() => this._go('udd', ld)}>${this._kindBadge('udd', 'dashboard', true)}<span>${d ? d.title : `Looker dashboard ${ld}`}</span></button>`; })}</div></section>
      </div>
      <div class="grid-2">
        <div>${rules.length ? this._rulesTile(rules, 'Business rules') : html`<section class="card"><div class="card-h"><h2>Business rules</h2></div>${this._empty('None linked yet.')}</section>`}</div>
        <section class="card"><div class="card-h"><h2>Questions it answers</h2></div>${qs.length ? html`<ul class="plain">${qs.map((q) => html`<li><button class="lnk" @click=${() => this._go('questions', q.id)}><span>${q.q}</span></button></li>`)}</ul>` : this._empty('None linked yet.')}</section>
      </div>
      ${terms.length ? html`<section class="card"><div class="card-h"><h2>Glossary terms</h2><button class="lnk-btn" @click=${() => { this.kgFocus = `product:${p.id}`; this.kgSel = `product:${p.id}`; this._go('graph'); }}>See in context graph ${icon('arrow', 14)}</button></div><div class="chips">${terms.map((t) => html`<button class="chip is-link t-know" @click=${() => this._go('term', t.t)}>${t.t}</button>`)}</div></section>` : nothing}`;
  }

  /* ---------------- knowledge: rules and questions */

  _renderRules() {
    const f = this.rF;
    let rules = IX.rules;
    if (f.dom) rules = rules.filter((r) => r.dom === f.dom);
    if (f.prod) rules = rules.filter((r) => this._rulesFor('product', f.prod).includes(r));
    const cats = Object.keys(RULE_CAT).filter((c) => rules.some((r) => r.cat === c));
    const conflicts = this._conflicts();
    const tested = IX.rules.filter((r) => r.tests.length).length;
    return html`
      ${this._pageHead('Knowledge', 'Business rules', 'How the numbers are meant to be read: the rules behind each metric, in plain English, with where each one is enforced.')}
      <div class="facts is-4">
        <div class="fact"><span class="fact-v">${IX.rules.length}</span><span class="fact-l">Rules</span></div>
        <div class="fact ${st(pct(tested, IX.rules.length))}"><span class="fact-v">${tested}</span><span class="fact-l">Checked by a dbt test</span></div>
        <div class="fact"><span class="fact-v">${IX.rules.filter((r) => r.st !== 'confirmed').length}</span><span class="fact-l">Need an owner</span></div>
        <div class="fact ${conflicts.length ? 's-warn' : ''}"><span class="fact-v">${conflicts.length}</span><span class="fact-l">Possible conflicts</span></div>
      </div>
      <div class="toolbar"><div class="toolbar-l">
        ${this._select('Domain', f.dom, [['', 'All domains'], ...(META.domains || []).filter((d) => IX.rules.some((r) => r.dom === d.id)).map((d) => [d.id, d.label])], (v) => { this.rF = { ...this.rF, dom: v }; })}
        ${this._select('Data product', f.prod, [['', 'All data products'], ...[...IX.product.values()].map((p) => [p.id, p.name])], (v) => { this.rF = { ...this.rF, prod: v }; })}
      </div></div>
      ${cats.map((c) => html`
        <section class="rule-group">
          <div class="sec-h"><h2><span class="acc-tile cat-${c}">${icon(RULE_CAT[c].icon, 14)}</span>${RULE_CAT[c].label}</h2><span class="muted small">${RULE_CAT[c].text}</span></div>
          <div class="bento">${rules.filter((r) => r.cat === c).map((r) => html`
            <button class="card c6 rule-card" @click=${() => this._go('rule', r.id)}>
              <div class="kn-h"><h3>${r.t}</h3>${this._draftChip(r)}</div>
              <p class="kn-d">${r.d}</p>
              <div class="rule-meta">
                ${r.dom ? html`<span class="chip is-dom">${domIcon(r.dom, 12)}${(IX.domain.get(r.dom) || {}).label}</span>` : nothing}
                <span class="chip">${plural(r.m.length, 'metric')}</span>
                ${r.tests.length ? html`<span class="chip s-good-chip">${icon('check', 11)} dbt test</span>` : html`<span class="chip s-warn-chip">No dbt test</span>`}
              </div>
            </button>`)}</div>
        </section>`)}
      ${!rules.length ? this._empty('No rules match these filters.') : nothing}
      ${conflicts.length ? html`<section class="card">
        <div class="card-h"><h2>Possible conflicts</h2><span class="muted small">One business term, several metrics that calculate it differently</span></div>
        <ul class="rule-list">${conflicts.map((c) => html`<li class="conflict"><button class="lnk" @click=${() => this._go('term', c.term)}><span><b>${c.term}</b></span></button>
          <span class="muted small">${plural(c.metrics.length, 'metric')} with ${c.distinct} different definitions. Agree one, or add a rule that says when to use each.</span>
          <div class="chips">${c.metrics.slice(0, 8).map((m) => this._fieldLink(m))}${c.metrics.length > 8 ? html`<span class="muted small">+${c.metrics.length - 8}</span>` : nothing}</div></li>`)}</ul>
      </section>` : nothing}`;
  }

  _renderRule(id) {
    const r = IX.rules.find((x) => x.id === id);
    if (!r) return this._empty('This rule is not in the catalog.');
    const metrics = r.m.map((m) => IX.field.get(m)).filter(Boolean);
    const assets = r.a.map((a) => IX.node.get(a)).filter(Boolean);
    const testsFound = r.tests.map((t) => {
      const on = [...IX.node.values()].filter((n) => (n.tests || []).some((x) => x.d === t));
      return { t, on };
    });
    return html`
      ${this._crumbs([[r.t, null]])}
      ${this._hero({
        badge: html`<span class="kb cat-${r.cat}">${icon(RULE_CAT[r.cat]?.icon || 'rule', 12)}<span>${RULE_CAT[r.cat]?.label || 'Business rule'}</span></span>`,
        title: r.t, desc: r.d,
        chips: html`${this._domChip(r.dom)}${this._draftChip(r)}${r.terms.map((t) => html`<button class="chip is-link t-know" @click=${() => this._go('term', t)}>${icon('book', 11)} ${t}</button>`)}`,
        facts: [{ v: metrics.length, l: 'Metrics' }, { v: assets.length, l: 'Tables and dashboards' }, { v: r.tests.length ? r.tests.length : '', l: 'dbt tests', st: 's-good' }],
      })}
      <div class="bento">
        ${r.why ? html`<section class="card c6"><div class="card-h"><h2>Why it matters</h2></div><p class="body">${r.why}</p></section>` : nothing}
        <section class="card c6"><div class="card-h"><h2>Owner and status</h2></div>
          <dl class="kv is-wide"><dt>Status</dt><dd>${r.st === 'confirmed' ? 'Confirmed' : 'Draft, needs an owner'}</dd><dt>Owner</dt><dd>${r.own || 'Not set'}</dd>${r.src ? html`<dt>Source</dt><dd>${r.src}</dd>` : nothing}</dl>
        </section>
        <section class="card c6"><div class="card-h"><h2>Applies to</h2></div>
          <div class="col-links">${metrics.map((f) => this._fieldLink(f.id))}${assets.map((n) => this._nodeLink(n.id))}${r.lds.filter((ld) => { const d = this._usage.dashFields.get(ld); return !d || !assets.some((n) => titleOf(n) === d.title); }).map((ld) => { const d = this._usage.dashFields.get(ld); return html`<button class="lnk" @click=${() => this._go('udd', ld)}>${this._kindBadge('udd', 'dashboard', true)}<span>${d ? d.title : `Looker dashboard ${ld}`}</span></button>`; })}</div>
        </section>
        <section class="card c6"><div class="card-h"><h2>Checked by dbt</h2></div>
          ${testsFound.length ? html`<ul class="rule-list">${testsFound.map((x) => html`<li class="test-row ${x.on.length ? '' : 'is-missing'}">${icon(x.on.length ? 'check' : 'warn', 13)}<span class="mono">${x.t}</span>${x.on.length ? html`<span class="muted small">on ${x.on.slice(0, 3).map((n, i) => html`${i ? ', ' : ''}<button class="lnk" @click=${() => this._go('node', n.id)}><span>${n.name}</span></button>`)}</span>` : html`<span class="muted small">not found in the dbt project</span>`}</li>`)}</ul>`
            : html`<p class="body muted">No dbt test checks this rule yet. Add a singular test in the dbt repo's tests folder and list it under <span class="mono">tested_by</span> in knowledge.yml.</p>`}
        </section>
        <section class="card c12"><div class="card-h"><h2>Where it is implemented</h2></div>
          ${r.impl.length ? r.impl.map((it) => {
            if (it.k === 'lookml' && IX.field.get(it.id)) { const f = IX.field.get(it.id); return html`<div class="impl"><div class="impl-h"><span class="chip">LookML</span>${this._fieldLink(f.id, { id: true })}</div>${this._sqlBlock(f.sql, f.v)}</div>`; }
            if (it.k === 'dbt_model' && IX.node.get(it.id)) { const n = IX.node.get(it.id); return html`<div class="impl"><div class="impl-h"><span class="chip">dbt model</span>${this._nodeLink(n.id)}<span class="mono muted small">${n.path || ''}</span></div></div>`; }
            return html`<div class="impl"><span class="chip">${it.k}</span><span class="mono">${it.ref}</span><span class="muted small">not found</span></div>`;
          }) : this._empty('Not linked to code yet. Add implemented_in to the rule in knowledge.yml.')}
        </section>
      </div>`;
  }

  _renderQuestions() {
    const sel = this.route.id;
    return html`
      ${this._pageHead('Knowledge', 'Verified questions', 'Common business questions and where to answer them: the metric, the explore and the dashboard. Search uses these to answer questions typed in plain English.')}
      <div class="kn-list">${IX.questions.map((q) => html`
        <article class="card kn-card ${sel === q.id ? 'is-sel' : ''}" id=${`q-${q.id}`}>
          <div class="kn-h"><h2>${q.q}</h2>${this._draftChip(q)}</div>
          <p class="kn-d">${q.a}</p>
          ${this._answerLinks(q.m, q.x, q.dsh, q.ld)}
          ${(q.also || []).length ? html`<p class="muted small">Also matches: ${q.also.join(', ')}</p>` : nothing}
        </article>`)}</div>`;
  }

  /* ---------------- knowledge: glossary */

  _renderGlossary() {
    const terms = [...(META.glossary || [])].sort((a, b) => a.t.localeCompare(b.t));
    return html`
      ${this._pageHead('Knowledge', 'Glossary', 'Business terms in plain English, each linked to the metrics that calculate it, the rules that apply and the data products that use it.')}
      <div class="gl-list">
        ${terms.map((t) => html`
          <article class="card gl-card">
            <div class="gl-h"><button class="gl-t" @click=${() => this._go('term', t.t)}>${t.t}</button>${t.dom ? this._domChip(t.dom) : nothing}</div>
            ${t.aka && t.aka.length ? html`<div class="gl-aka">Also called ${t.aka.join(', ')}</div>` : nothing}
            <p class="gl-d">${t.d}</p>
            <div class="chips">${t.m.slice(0, 4).map((m) => this._fieldLink(m))}${t.m.length > 4 ? html`<span class="muted small">+${t.m.length - 4}</span>` : nothing}</div>
            <div class="gl-f">${this._draftChip(t)}${t.own ? html`<span class="muted small">Suggested owner: ${t.own}</span>` : nothing}</div>
          </article>`)}
      </div>`;
  }

  _renderTerm(id) {
    const t = IX.term.get(id);
    if (!t) return this._empty('This term is not in the glossary.');
    const metrics = t.m.map((m) => IX.field.get(m)).filter(Boolean);
    const rules = IX.rules.filter((r) => r.terms.includes(t.t));
    const qs = IX.questions.filter((q) => t.m.includes(q.m));
    const prods = [...IX.product.values()].filter((p) => p.m.some((m) => t.m.includes(m)));
    return html`
      ${this._crumbs([[t.t, null]])}
      <div class="ah"><div class="ah-main">
        <span class="kb t-know">${icon('book', 12)}<span>Glossary term</span></span>
        <h1>${t.t}</h1>
        <p class="desc">${t.d}</p>
        <div class="chips">${t.dom ? this._domChip(t.dom) : nothing}${this._draftChip(t)}${t.own ? html`<span class="chip">Suggested owner: ${t.own}</span>` : nothing}${t.aka && t.aka.length ? html`<span class="chip is-tag">Also called ${t.aka.join(', ')}</span>` : nothing}</div>
      </div></div>
      <section class="card is-flush"><div class="card-h pad"><h2>Metrics that calculate it</h2><button class="lnk-btn" @click=${() => { this.kgFocus = `term:${t.t}`; this.kgSel = `term:${t.t}`; this._go('graph'); }}>See in context graph ${icon('arrow', 14)}</button></div>${this._metricTable(metrics, true)}</section>
      <div class="grid-3">
        <section class="card"><div class="card-h"><h2>Business rules</h2></div>${rules.length ? html`<ul class="plain">${rules.map((r) => html`<li><button class="lnk" @click=${() => this._go('rule', r.id)}><span>${r.t}</span></button></li>`)}</ul>` : this._empty('None yet.')}</section>
        <section class="card"><div class="card-h"><h2>Questions</h2></div>${qs.length ? html`<ul class="plain">${qs.map((q) => html`<li><button class="lnk" @click=${() => this._go('questions', q.id)}><span>${q.q}</span></button></li>`)}</ul>` : this._empty('None yet.')}</section>
        <section class="card"><div class="card-h"><h2>Data products</h2></div>${prods.length ? html`<div class="col-links">${prods.map((p) => html`<button class="lnk" @click=${() => this._go('product', p.id)}><span class="kb t-know is-compact">${icon('product', 12)}</span><span>${p.name}</span></button>`)}</div>` : this._empty('None yet.')}</section>
      </div>`;
  }

  /* ---------------- knowledge: context graph (force-directed, simulated in the app) */

  /* The full graph of concepts and the assets behind them, built once per catalog. */
  _kgFull() {
    if (this._kg) return this._kg;
    const nodes = new Map();
    const edges = new Map();
    const add = (id, kind, label, extra = {}) => { if (isPlumbing(IX.node.get(id))) return null; if (!nodes.has(id)) nodes.set(id, { id, kind, label, dom: '', prods: new Set(), ...extra }); return nodes.get(id); };
    const link = (a, b) => { if (a === b || !nodes.has(a) || !nodes.has(b)) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; if (!edges.has(k)) edges.set(k, { a, b }); };
    const terms = META.glossary || [];
    const metricIds = new Set([...terms.flatMap((t) => t.m), ...[...IX.product.values()].flatMap((p) => p.m), ...IX.rules.flatMap((r) => r.m), ...IX.questions.map((q) => q.m).filter(Boolean)]);
    terms.forEach((t) => add(`term:${t.t}`, 'term', t.t, { dom: t.dom || '' }));
    IX.product.forEach((p) => add(`product:${p.id}`, 'product', p.name));
    IX.rules.forEach((r) => add(`rule:${r.id}`, 'rule', r.t));
    metricIds.forEach((m) => {
      const f = IX.field.get(m);
      if (!f) return;
      add(m, 'metric', fieldTitle(f), { dom: f.dom });
      f.ex.slice(0, 2).forEach((x) => { const n = IX.node.get(`explore.${x}`); if (n) { add(n.id, 'explore', titleOf(n), { dom: n.dom }); } });
      f.dash.forEach((d) => { const n = IX.node.get(d); if (n) add(n.id, 'dashboard', titleOf(n), { dom: n.dom }); });
      [...(this._usage.fieldDash.get(m) || new Set())].slice(0, 3).forEach((ld) => { const d = this._usage.dashFields.get(ld); if (d) add(`udd.${ld}`, 'dashboard', d.title, { dom: f.dom }); });
      const phys = physicalNodeOfView(f.v);
      if (phys) add(phys.id, 'table', phys.name, { dom: phys.dom });
    });
    IX.product.forEach((p) => p.assets.forEach((a) => { const n = IX.node.get(a); if (n) add(a, n.k === 'explore' ? 'explore' : n.k === 'dashboard' ? 'dashboard' : 'table', titleOf(n), { dom: n.dom }); }));
    // links
    terms.forEach((t) => t.m.forEach((m) => link(`term:${t.t}`, m)));
    IX.rules.forEach((r) => { r.m.forEach((m) => link(`rule:${r.id}`, m)); r.terms.forEach((t) => link(`rule:${r.id}`, `term:${t}`)); });
    IX.product.forEach((p) => { p.m.forEach((m) => link(`product:${p.id}`, m)); p.assets.forEach((a) => link(`product:${p.id}`, a)); });
    metricIds.forEach((m) => {
      const f = IX.field.get(m);
      if (!f || !nodes.has(m)) return;
      f.ex.slice(0, 2).forEach((x) => link(m, `explore.${x}`));
      f.dash.forEach((d) => link(m, d));
      [...(this._usage.fieldDash.get(m) || new Set())].slice(0, 3).forEach((ld) => link(m, `udd.${ld}`));
      const phys = physicalNodeOfView(f.v);
      if (phys) link(m, phys.id);
    });
    // which data products each node belongs to (for the filter), and a domain for products and rules
    IX.product.forEach((p) => {
      const pid = `product:${p.id}`;
      nodes.get(pid).prods.add(p.id);
      [...p.m, ...p.assets].forEach((a) => { if (nodes.has(a)) nodes.get(a).prods.add(p.id); });
      terms.filter((t) => t.m.some((m) => p.m.includes(m))).forEach((t) => nodes.get(`term:${t.t}`).prods.add(p.id));
      IX.rules.filter((r) => r.m.some((m) => p.m.includes(m))).forEach((r) => nodes.get(`rule:${r.id}`).prods.add(p.id));
      const doms = new Map();
      p.assets.forEach((a) => { const d = (IX.node.get(a) || {}).dom; if (d) doms.set(d, (doms.get(d) || 0) + 1); });
      nodes.get(pid).dom = [...doms.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    });
    const adj = new Map();
    edges.forEach((e) => { push(adj, e.a, e.b); push(adj, e.b, e.a); });
    nodes.forEach((n) => { if (!n.dom && n.kind === 'rule') { const d = (adj.get(n.id) || []).map((x) => nodes.get(x).dom).find(Boolean); n.dom = d || ''; } });
    this._kg = { nodes, edges: [...edges.values()], adj };
    return this._kg;
  }

  /* The visible subgraph after focus and filters, capped for speed. */
  _kgView() {
    const G = this._kgFull();
    const f = this.kgF;
    const kinds = new Set(f.kinds);
    let ids;
    let pathSet = null;
    if (this.kgPath && this.kgPath.length) {
      pathSet = new Set(this.kgPath);
      ids = new Set(this.kgPath);
      this.kgPath.forEach((x) => (G.adj.get(x) || []).slice(0, 4).forEach((y) => ids.add(y)));
    } else if (this.kgFocus && G.nodes.has(this.kgFocus)) {
      ids = new Set([this.kgFocus]);
      let frontier = [this.kgFocus];
      for (let h = 0; h < (this.kgHops || 2); h += 1) {
        const next = [];
        frontier.forEach((x) => (G.adj.get(x) || []).forEach((y) => { if (!ids.has(y)) { ids.add(y); next.push(y); } }));
        frontier = next;
      }
    } else ids = new Set(G.nodes.keys());
    const keep = [...ids].map((id) => G.nodes.get(id)).filter((n) => (n.id === this.kgFocus || (pathSet && pathSet.has(n.id)) || kinds.has(n.kind))
      && (!f.dom || n.dom === f.dom || n.id === this.kgFocus || (pathSet && pathSet.has(n.id))) && (!f.prod || n.prods.has(f.prod) || n.id === this.kgFocus || (pathSet && pathSet.has(n.id))));
    const rank = { product: 0, term: 1, rule: 2, metric: 3, explore: 4, dashboard: 5, table: 6 };
    keep.sort((a, b) => rank[a.kind] - rank[b.kind]);
    const capped = keep.slice(0, 320);
    const set = new Set(capped.map((n) => n.id));
    const edges = G.edges.filter((e) => set.has(e.a) && set.has(e.b));
    return { nodes: capped, edges, more: keep.length - capped.length, key: `${this.kgHull ? 'h' : ''}|${this.kgFocus}|${this.kgHops}|${(this.kgPath || []).join('>')}|${f.dom}|${f.prod}|${f.kinds.join(',')}|${capped.length}|${edges.length}` };
  }

  /* Shortest path between two graph nodes (breadth first, over the whole graph). */
  _kgFindPath(a, b) {
    const G = this._kgFull();
    if (!G.nodes.has(a) || !G.nodes.has(b)) return null;
    const prev = new Map([[a, null]]);
    const q = [a];
    while (q.length) {
      const x = q.shift();
      if (x === b) break;
      (G.adj.get(x) || []).forEach((y) => { if (!prev.has(y)) { prev.set(y, x); q.push(y); } });
    }
    if (!prev.has(b)) return [];
    const path = [];
    for (let x = b; x; x = prev.get(x)) path.unshift(x);
    return path;
  }

  _kgNodeByLabel(text) {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return '';
    const G = this._kgFull();
    let best = '';
    G.nodes.forEach((n) => { const l = n.label.toLowerCase(); if (l === t) best = n.id; else if (!best && l.startsWith(t)) best = n.id; });
    if (!best) G.nodes.forEach((n) => { if (!best && n.label.toLowerCase().includes(t)) best = n.id; });
    return best;
  }

  /* Pan the graph so a node sits in the middle, and select it. */
  _kgPanTo(id) {
    const S = this._kgSim;
    const i = S && S.idx.get(id);
    if (i === undefined) return false;
    const vp = this.querySelector('.dc-graph[data-key="kg"]');
    if (!vp) return false;
    const r = vp.getBoundingClientRect();
    const v = this._vp('kg');
    const k = Math.max(v.k, 0.9);
    const p = S.nodes[i];
    this._view.set('kg', { k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k });
    this._applyView('kg');
    this.kgSel = id;
    return true;
  }

  _kgSearch(text) {
    const id = this._kgNodeByLabel(text);
    if (!id) { this._toastMsg = `Nothing in the graph matches “${text}”.`; this.requestUpdate(); setTimeout(() => { this._toastMsg = ''; this.requestUpdate(); }, 2500); return; }
    if (!this._kgSim.idx.has(id)) { this.kgFocus = id; this.kgSel = id; this.kgPath = null; return; }
    this._kgPanTo(id);
  }

  /* Domain hulls: a soft outline around each domain's nodes, recomputed as the layout moves. */
  _kgHulls() {
    const S = this._kgSim;
    if (!S || !this.kgHull) return [];
    const G = this._kgFull();
    const by = new Map();
    S.nodes.forEach((p) => { const d = (G.nodes.get(p.id) || {}).dom; if (d && d !== 'other') push(by, d, p); });
    const hulls = [];
    by.forEach((ps, dom) => {
      if (ps.length < 3) return;
      const pts = [];
      ps.forEach((p) => { const r = p.r + 14; for (let a = 0; a < 8; a += 1) pts.push([p.x + r * Math.cos((a * Math.PI) / 4), p.y + r * Math.sin((a * Math.PI) / 4)]); });
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = []; pts.forEach((p) => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
      const upper = []; for (let i = pts.length - 1; i >= 0; i -= 1) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
      const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      const top = hull.reduce((m, p) => (p[1] < m[1] ? p : m), hull[0]);
      hulls.push({ dom, d: `M${hull.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`, lx: top[0], ly: top[1] - 6 });
    });
    return hulls;
  }

  _kgStart(view) {
    const W = 1600; const H = 1100;
    const prev = this._kgSim ? new Map(this._kgSim.nodes.map((n) => [n.id, n])) : new Map();
    const idx = new Map();
    const nodes = view.nodes.map((n, i) => {
      idx.set(n.id, i);
      const p = prev.get(n.id);
      const a = (2 * Math.PI * i) / Math.max(view.nodes.length, 1);
      const r = n.id === this.kgFocus ? 0 : 160 + (i % 7) * 40;
      return { id: n.id, kind: n.kind, x: p ? p.x : W / 2 + r * Math.cos(a), y: p ? p.y : H / 2 + r * Math.sin(a) * 0.75, vx: 0, vy: 0, fx: n.id === this.kgFocus ? W / 2 : null, fy: n.id === this.kgFocus ? H / 2 : null };
    });
    const links = view.edges.map((e) => ({ s: idx.get(e.a), t: idx.get(e.b) }));
    const deg = new Array(nodes.length).fill(0);
    links.forEach((l) => { deg[l.s] += 1; deg[l.t] += 1; });
    const big = { term: 12, product: 14, rule: 7, metric: 5, explore: 6, dashboard: 6, table: 5 };
    nodes.forEach((p, i) => { p.r = Math.round(Math.min(24, (big[p.kind] || 5) + Math.sqrt(deg[i]) * (p.kind === 'term' || p.kind === 'product' ? 2.2 : 1.2))); });
    const G0 = this._kgFull();
    const dom = this.kgHull ? nodes.map((p) => { const d = (G0.nodes.get(p.id) || {}).dom; return d && d !== 'other' ? d : ''; }) : null;
    let anchor = null;
    if (dom) {
      const counts = new Map(); dom.forEach((d) => { if (d) counts.set(d, (counts.get(d) || 0) + 1); });
      const ds = [...counts.keys()].sort((x, y) => counts.get(y) - counts.get(x));
      anchor = new Map(ds.map((d, k) => { const ang = (2 * Math.PI * k) / Math.max(ds.length, 1) - Math.PI / 2; const rad = ds.length > 1 ? 120 + 40 * ds.length : 0; return [d, { x: W / 2 + rad * Math.cos(ang), y: H / 2 + rad * 0.7 * Math.sin(ang) }]; }));
    }
    this._kgSim = { nodes, links, deg, idx, alpha: 1, W, H, key: view.key, dom, anchor };
    for (let i = 0; i < 220; i += 1) this._kgTick(); // settle before the first paint
    // fit the world to the settled layout
    const xs = nodes.map((p) => p.x); const ys = nodes.map((p) => p.y);
    const minX = Math.min(...xs) - 120; const minY = Math.min(...ys) - 40;
    nodes.forEach((p) => { p.x -= minX; p.y -= minY; if (p.fx !== null) { p.fx -= minX; p.fy -= minY; } });
    this._kgSim.W = Math.max(400, Math.max(...xs) - minX + 120);
    this._kgSim.H = Math.max(300, Math.max(...ys) - minY + 40);
    this._kgSim.alpha = Math.max(this._kgSim.alpha, 0.25);
  }

  _kgTick() {
    const S = this._kgSim;
    if (!S) return;
    const { nodes, links, deg } = S;
    const n = nodes.length;
    const a = S.alpha;
    const rep = 300;
    for (let i = 0; i < n; i += 1) {
      const p = nodes[i];
      for (let j = i + 1; j < n; j += 1) {
        const q = nodes[j];
        let dx = p.x - q.x; let dy = p.y - q.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = (i - j) * 0.1 + 0.5; dy = 0.3; d2 = 1; }
        if (d2 > 250000) continue;
        const f = (rep * a) / d2;
        p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
      }
    }
    links.forEach((l) => {
      const p = nodes[l.s]; const q = nodes[l.t];
      const dx = q.x - p.x; const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = 26 + nodes[l.s].r + nodes[l.t].r + Math.min(deg[l.s], deg[l.t]) * 2;
      const k = ((d - rest) / d) * 0.22 * a / Math.max(1, Math.sqrt(Math.min(deg[l.s], deg[l.t])));
      p.vx += dx * k; p.vy += dy * k; q.vx -= dx * k; q.vy -= dy * k;
    });
    if (S.dom && S.anchor) {
      nodes.forEach((p, i) => { const c = S.anchor.get(S.dom[i]); if (c) { p.vx += (c.x - p.x) * 0.05 * a; p.vy += (c.y - p.y) * 0.05 * a; } });
    }
    nodes.forEach((p) => {
      p.vx += (S.W / 2 - p.x) * 0.03 * a; p.vy += (S.H / 2 - p.y) * 0.045 * a;
      if (p.fx !== null) { p.x = p.fx; p.y = p.fy; p.vx = 0; p.vy = 0; return; }
      p.vx *= 0.55; p.vy *= 0.55;
      p.x += Math.max(-30, Math.min(30, p.vx)); p.y += Math.max(-30, Math.min(30, p.vy));
    });
    S.alpha = Math.max(0, S.alpha - 0.012);
  }

  _kgPaint() {
    const S = this._kgSim;
    const els = this._kgEls;
    if (!S || !els) return;
    S.nodes.forEach((p, i) => { const el = els.nodes[i]; if (el) el.style.transform = `translate(${p.x - p.r}px, ${p.y - p.r}px)`; });
    S.links.forEach((l, i) => {
      const el = els.lines[i];
      if (!el) return;
      const p = S.nodes[l.s]; const q = S.nodes[l.t];
      el.setAttribute('x1', p.x); el.setAttribute('y1', p.y); el.setAttribute('x2', q.x); el.setAttribute('y2', q.y);
    });
    if (this.kgHull) {
      const hulls = this._kgHulls();
      const byDom = new Map(hulls.map((h) => [h.dom, h]));
      (els.hulls || []).forEach((el) => { const h = byDom.get(el.dataset.dom); el.setAttribute('d', h ? h.d : ''); });
      (els.hlabels || []).forEach((el) => { const h = byDom.get(el.dataset.dom); el.style.display = h ? '' : 'none'; if (h) el.style.transform = `translate(${h.lx}px, ${h.ly}px) translate(-50%, -100%)`; });
    }
    this._kgMinimap();
    this._kgLblTick = ((this._kgLblTick || 0) + 1) % 8;
    if (this._kgLblTick === 0 || S.alpha < 0.01) this._kgLabels();
  }

  _kgMinimap() {
    const S = this._kgSim;
    const mm = this.querySelector('.kg-mini svg');
    if (!S || !mm) return;
    const sc = Math.min(160 / S.W, 110 / S.H);
    const dots = mm.querySelectorAll('circle');
    S.nodes.forEach((p, i) => { const c = dots[i]; if (c) { c.setAttribute('cx', (p.x * sc).toFixed(1)); c.setAttribute('cy', (p.y * sc).toFixed(1)); } });
    const vp = this.querySelector('.dc-graph[data-key="kg"]');
    const rect = mm.querySelector('rect.kg-mini-view');
    if (vp && rect) {
      const r = vp.getBoundingClientRect(); const v = this._vp('kg');
      rect.setAttribute('x', ((-v.x / v.k) * sc).toFixed(1)); rect.setAttribute('y', ((-v.y / v.k) * sc).toFixed(1));
      rect.setAttribute('width', ((r.width / v.k) * sc).toFixed(1)); rect.setAttribute('height', ((r.height / v.k) * sc).toFixed(1));
    }
  }

  _kgMiniClick(e) {
    const S = this._kgSim;
    const svg = e.currentTarget;
    const b = svg.getBoundingClientRect();
    const sc = Math.min(160 / S.W, 110 / S.H);
    const wx = (e.clientX - b.left) / sc; const wy = (e.clientY - b.top) / sc;
    const vp = this.querySelector('.dc-graph[data-key="kg"]');
    const r = vp.getBoundingClientRect(); const v = this._vp('kg');
    this._view.set('kg', { ...v, x: r.width / 2 - wx * v.k, y: r.height / 2 - wy * v.k });
    this._applyView('kg');
  }

  _kgLoop() {
    if (this._kgRaf) return;
    const step = () => {
      this._kgRaf = 0;
      if (this.route.view !== 'graph' || !this.isConnected || !this._kgSim) return;
      if (this._kgSim.alpha > 0.004 || this._kgDrag) {
        this._kgTick();
        this._kgPaint();
        this._kgRaf = requestAnimationFrame(step);
      }
    };
    this._kgRaf = requestAnimationFrame(step);
  }

  _kgBind() {
    const root = this.querySelector('.dc-graph[data-key="kg"]');
    if (!root) return;
    this._kgEls = {
      nodes: [...root.querySelectorAll('.kg-node')].sort((a, b) => a.dataset.i - b.dataset.i),
      lines: [...root.querySelectorAll('line.kg-edge')].sort((a, b) => a.dataset.i - b.dataset.i),
      hulls: [...root.querySelectorAll('path.kg-hull')],
      hlabels: [...root.querySelectorAll('.kg-hull-label')],
    };
    this._kgPaint();
    this._kgLoop();
  }

  _kgWorld(e) {
    const vp = this.querySelector('.dc-graph[data-key="kg"]');
    const r = vp.getBoundingClientRect();
    const v = this._vp('kg');
    return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k };
  }

  _kgDown(e, i) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = this._kgSim.nodes[i];
    const w = this._kgWorld(e);
    this._kgDrag = { i, dx: p.x - w.x, dy: p.y - w.y, moved: false, sx: e.clientX, sy: e.clientY, pinned: p.fx !== null };
    e.currentTarget.setPointerCapture(e.pointerId);
    this._kgSim.alpha = Math.max(this._kgSim.alpha, 0.3);
    this._kgLoop();
  }

  _kgMove(e) {
    const d = this._kgDrag;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    const w = this._kgWorld(e);
    const p = this._kgSim.nodes[d.i];
    p.fx = w.x + d.dx; p.fy = w.y + d.dy;
    this._kgSim.alpha = Math.max(this._kgSim.alpha, 0.3);
  }

  _kgUp(e) {
    const d = this._kgDrag;
    if (!d) return;
    this._kgDrag = null;
    const p = this._kgSim.nodes[d.i];
    if (!d.pinned && p.id !== this.kgFocus) { p.fx = null; p.fy = null; }
    if (!d.moved) { this.kgSel = p.id; }
    this._kgLoop();
  }

  _kgHover(id) {
    const els = this._kgEls;
    const S = this._kgSim;
    if (!els || !S) return;
    const nb = new Set(id ? [id, ...((this._kgFull().adj.get(id)) || [])] : []);
    els.nodes.forEach((el, i) => { el.classList.toggle('is-dim', !!id && !nb.has(S.nodes[i].id)); el.classList.toggle('is-nb', !!id && nb.has(S.nodes[i].id) && S.nodes[i].id !== id); });
    els.lines.forEach((el, i) => { const l = S.links[i]; const hot = id && (S.nodes[l.s].id === id || S.nodes[l.t].id === id); el.classList.toggle('is-hot', !!hot); el.classList.toggle('is-dim', !!id && !hot); });
    this._kgHoverId = id;
    this._kgLabels();
  }

  /* Place each visible label beside its circle where it does not cover another label or circle.
     Higher-priority labels go first; a label with no free spot is hidden until hover. */
  _kgLabels() {
    const S = this._kgSim;
    const els = this._kgEls;
    if (!S || !els) return;
    const G = this._kgFull();
    const PRI = { product: 5, term: 4, rule: 3, metric: 2, dashboard: 1, explore: 1, table: 0 };
    const items = [];
    els.nodes.forEach((el, i) => {
      const lab = el.querySelector('.kg-label');
      if (!lab) return;
      lab.classList.remove('is-hidden');
      if (!lab.offsetWidth) return;
      const p = S.nodes[i];
      const n = G.nodes.get(p.id) || {};
      const forced = el.classList.contains('is-sel') || el.classList.contains('is-center') || p.id === this._kgHoverId;
      const pri = (forced ? 100 : 0) + (el.classList.contains('is-nb') || el.classList.contains('is-path') ? 50 : 0) + (PRI[n.kind] || 0) * 10 + Math.min(9, S.deg[i]);
      items.push({ el, lab, p, w: lab.offsetWidth, h: lab.offsetHeight, pri, forced });
    });
    items.sort((a, b) => b.pri - a.pri);
    const placed = [];
    const hit = (x, y, w, h, self) => {
      if (placed.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y)) return true;
      return S.nodes.some((q) => q !== self && q.x + q.r + 2 > x && q.x - q.r - 2 < x + w && q.y + q.r + 2 > y && q.y - q.r - 2 < y + h);
    };
    items.forEach((it) => {
      const { p, w, h } = it;
      const cands = [[p.x + p.r + 6, p.y - h / 2], [p.x - p.r - 6 - w, p.y - h / 2], [p.x - w / 2, p.y - p.r - 4 - h], [p.x - w / 2, p.y + p.r + 4]];
      let pick = cands.find(([x, y]) => !hit(x, y, w, h, p));
      if (!pick && it.forced) pick = cands[0];
      if (!pick) { it.lab.classList.add('is-hidden'); return; }
      placed.push({ x: pick[0], y: pick[1], w, h });
      it.lab.style.left = `${(pick[0] - (p.x - p.r)).toFixed(1)}px`;
      it.lab.style.top = `${(pick[1] - (p.y - p.r)).toFixed(1)}px`;
    });
  }

  _renderGraph() {
    const view = this._kgView();
    if (!this._kgSim || this._kgSim.key !== view.key) { this._kgStart(view); this._kgNeedBind = true; this._view.delete('kg'); }
    const KCLS = { term: 't-know', product: 't-know', metric: 't-metric', explore: 't-lemon', dashboard: 't-dash', table: 't-wh', rule: 't-know' };
    const KICON = { term: 'book', product: 'product', metric: 'metric', explore: 'explore', dashboard: 'dashboard', table: 'model', rule: 'rule' };
    const KLABEL = { term: 'Glossary term', product: 'Data product', metric: 'Metric', explore: 'Explore', dashboard: 'Dashboard', table: 'Table', rule: 'Business rule' };
    const G = this._kgFull();
    const S = this._kgSim;
    const shell = { width: S.W, height: S.H };
    const pathEdges = new Set();
    (this.kgPath || []).forEach((x, i, a) => { if (i) { pathEdges.add(`${a[i - 1]}|${x}`); pathEdges.add(`${x}|${a[i - 1]}`); } });
    const pathSet = new Set(this.kgPath || []);
    const built = META.built ? new Date(META.built) : new Date();
    const recent = (id) => { const n = IX.node.get(id); return n && n.chg && (built - new Date(n.chg)) / 86400000 <= 45; };
    const ov = this.kgOver;
    const healthCls = (n) => {
      let d = false;
      if (n.kind === 'metric') d = !!(IX.field.get(n.id) || {}).d;
      else if (n.kind === 'term' || n.kind === 'product' || n.kind === 'rule') d = true;
      else d = !!(IX.node.get(n.id) || {}).d;
      return d ? 'ov-good' : 'ov-poor';
    };
    const sizeOf = (i, n) => {
      if (ov !== 'usage') return S.nodes[i].r;
      const u = USAGE_BOOST.get(n.id) || 0;
      return Math.round(Math.max(5, Math.min(26, 5 + Math.log10(u + 1) * 4.5)));
    };
    const hulls = this.kgHull ? this._kgHulls() : [];
    const sc = Math.min(160 / S.W, 110 / S.H);
    const inner = html`
      <svg class="g-edges" width=${S.W} height=${S.H} viewBox=${`0 0 ${S.W} ${S.H}`}>
        ${hulls.map((h) => html`<svg overflow="visible"><path class="kg-hull acc-${(IX.domain.get(h.dom) || { i: 0 }).i % 7}" data-dom=${h.dom} d=${h.d}></path></svg>`)}
        ${S.links.map((l, i) => { const a = S.nodes[l.s].id; const b = S.nodes[l.t].id; return html`<svg overflow="visible"><line class="kg-edge ${pathEdges.has(`${a}|${b}`) ? 'is-path' : ''}" data-i=${i}></line></svg>`; })}
      </svg>
      ${hulls.map((h) => html`<span class="kg-hull-label acc-${(IX.domain.get(h.dom) || { i: 0 }).i % 7}" data-dom=${h.dom}>${domIcon(h.dom, 12)}${(IX.domain.get(h.dom) || {}).label}</span>`)}
      ${view.nodes.map((n, i) => html`
        <button class="kg-node ${KCLS[n.kind]} ${n.id === this.kgFocus ? 'is-center' : ''} ${n.id === this.kgSel ? 'is-sel' : ''} ${pathSet.has(n.id) ? 'is-path' : ''} ${this.kgRecent && recent(n.id) ? 'is-recent' : ''} ${ov === 'health' ? healthCls(n) : ''} k-${n.kind}" data-i=${i}
          @pointerdown=${(e) => this._kgDown(e, i)} @pointermove=${(e) => this._kgMove(e)} @pointerup=${(e) => this._kgUp(e)} @pointercancel=${(e) => this._kgUp(e)}
          @mouseenter=${() => this._kgHover(n.id)} @mouseleave=${() => this._kgHover('')} @dblclick=${() => this._kgOpen(n)}
          title=${`${KLABEL[n.kind]}: ${n.label}`} style=${`--r:${sizeOf(i, n)}px`}><i class="kg-dot">${n.kind === 'term' || n.kind === 'product' ? icon(KICON[n.kind], Math.max(10, Math.min(16, sizeOf(i, n)))) : nothing}</i><span class="kg-label">${n.label}</span></button>`)}`;
    const mini = html`<div class="kg-mini" title="Overview. Click to move there."><svg width=${Math.round(S.W * sc)} height=${Math.round(S.H * sc)} @click=${(e) => this._kgMiniClick(e)}>
      ${S.nodes.map((p) => html`<svg overflow="visible"><circle r="1.8" class=${`m-${(G.nodes.get(p.id) || {}).kind}`}></circle></svg>`)}<rect class="kg-mini-view"></rect></svg></div>`;
    const focusNode = G.nodes.get(this.kgFocus);
    const kindToggle = (k) => html`<button class="chip is-link kg-kind ${this.kgF.kinds.includes(k) ? 'is-on' : ''}" @click=${() => { const ks = this.kgF.kinds.includes(k) ? this.kgF.kinds.filter((x) => x !== k) : [...this.kgF.kinds, k]; this.kgF = { ...this.kgF, kinds: ks }; }}><i class="sw ${KCLS[k]}"></i>${KLABEL[k]}</button>`;
    const presets = (META.knowledge || {}).presets || [];
    const labels = [...G.nodes.values()].filter((n) => ['term', 'product', 'rule', 'metric'].includes(n.kind)).map((n) => n.label);
    const title = this.kgPath && this.kgPath.length ? 'Context graph: path' : (focusNode ? `Context graph: ${focusNode.label}` : 'Context graph');
    return html`
      ${this._pageHead('Knowledge', title, 'Business concepts, data products and rules, linked to the metrics, tables, explores and dashboards behind them.', nothing, focusNode ? [[focusNode.label, null]] : [])}
      <div class="kg-bar">
        <div class="kg-row">
          <div class="fi kg-find">${icon('search', 14)}<input type="search" list="kg-labels" placeholder="Find in graph" @keydown=${(e) => { e.stopPropagation(); if (e.key === 'Enter') this._kgSearch(e.target.value); }} @keyup=${this._stopKeys} @keypress=${this._stopKeys}></div>
          <datalist id="kg-labels">${labels.slice(0, 400).map((l) => html`<option value=${l}></option>`)}</datalist>
          <div class="seg kg-presets">${presets.map((p) => html`<button class=${this.kgPreset === p.id ? 'is-on' : ''} @click=${() => { this.kgPreset = p.id; this.kgFocus = p.focus; this.kgHops = p.hops || 2; this.kgPath = null; this.kgSel = p.focus; this.kgF = { ...this.kgF, kinds: p.kinds || this.kgF.kinds }; }}>${p.label}</button>`)}</div>
          ${focusNode || (this.kgPath && this.kgPath.length) ? html`<button class="btn" @click=${() => { this.kgFocus = ''; this.kgSel = ''; this.kgPath = null; this.kgPreset = ''; }}>${icon('back', 14)} Whole graph</button>` : nothing}
          ${focusNode ? this._select('Hops', String(this.kgHops || 2), [['1', '1 hop'], ['2', '2 hops'], ['3', '3 hops']], (v) => { this.kgHops = Number(v); }) : nothing}
        </div>
        <div class="kg-row">
          ${this._select('Domain', this.kgF.dom, [['', 'All domains'], ...(META.domains || []).map((d) => [d.id, d.label])], (v) => { this.kgF = { ...this.kgF, dom: v }; })}
          ${this._select('Data product', this.kgF.prod, [['', 'All data products'], ...[...IX.product.values()].map((p) => [p.id, p.name])], (v) => { this.kgF = { ...this.kgF, prod: v }; })}
          ${this._select('Size', ov === 'usage' ? 'usage' : 'links', [['links', 'By links'], ['usage', 'By usage']], (v) => { this.kgOver = v === 'usage' ? 'usage' : (ov === 'health' ? 'health' : ''); })}
          ${this._select('Colour', ov === 'health' ? 'health' : 'type', [['type', 'By type'], ['health', 'By documentation']], (v) => { this.kgOver = v === 'health' ? 'health' : ''; })}
          <label class="tog"><input type="checkbox" .checked=${!!this.kgHull} @change=${(e) => { this.kgHull = e.target.checked; this._kgNeedBind = true; }}><span>Domain areas</span></label>
          <label class="tog"><input type="checkbox" .checked=${!!this.kgRecent} @change=${(e) => { this.kgRecent = e.target.checked; }}><span>Recently changed</span></label>
        </div>
        <div class="kg-row">
          <div class="kg-kinds">${['term', 'product', 'rule', 'metric', 'explore', 'dashboard', 'table'].map(kindToggle)}</div>
        </div>
      </div>
      <div class="kg-layout">
        <div class="card is-flush kg-card">
          ${this._graphShell('kg', shell, inner, html`<div class="g-note is-info">${fmtInt(view.nodes.length)} nodes, ${fmtInt(view.edges.length)} links${view.more ? `. ${fmtInt(view.more)} more hidden: filter to see them` : ''}</div>${mini}`, null)}
        </div>
        <div class="kg-side">
          ${this._kgPanel(this.kgSel && G.nodes.get(this.kgSel), KCLS, KICON, KLABEL)}
          <section class="card kg-path-tile">
            <div class="card-h"><h2>How are two things connected?</h2></div>
            <div class="kg-path-in">
              <div class="fi">${icon('dot', 12)}<input list="kg-labels" placeholder="From" .value=${this._kgA || ''} @input=${(e) => { this._kgA = e.target.value; }} @keydown=${this._stopKeys} @keyup=${this._stopKeys}></div>
              <div class="fi">${icon('dot', 12)}<input list="kg-labels" placeholder="To" .value=${this._kgB || ''} @input=${(e) => { this._kgB = e.target.value; }} @keydown=${this._stopKeys} @keyup=${this._stopKeys}></div>
              <button class="btn is-primary" @click=${() => { const a = this._kgNodeByLabel(this._kgA); const b = this._kgNodeByLabel(this._kgB); const p = a && b ? this._kgFindPath(a, b) : null; this._kgPathMsg = !a || !b ? 'Pick two items from the list.' : (p && p.length ? '' : 'No connection found.'); this.kgPath = p && p.length ? p : null; this.kgSel = p && p.length ? b : this.kgSel; this.requestUpdate(); }}>Find path</button>
            </div>
            ${this._kgPathMsg ? html`<p class="small muted">${this._kgPathMsg}</p>` : nothing}
            ${this.kgPath && this.kgPath.length ? html`<ol class="kg-steps">${this.kgPath.map((id) => { const n = G.nodes.get(id); return html`<li><button class="lnk" @click=${() => { this.kgSel = id; this._kgPanTo(id); }}><span class="kb ${KCLS[n.kind]} is-compact">${icon(KICON[n.kind], 12)}</span><span>${n.label}</span></button></li>`; })}</ol>` : nothing}
          </section>
        </div>
      </div>`;
  }

  _kgPanel(n, KCLS, KICON, KLABEL) {
    if (!n) return html`<aside class="lg-panel"><h3 class="is-plain">How to read it</h3><p class="small muted">Large circles are glossary terms and data products; small dots are the metrics, tables and dashboards behind them. Hover a circle to name its neighbours, click it for details, double-click to open it. Drag circles to make room; zoom past 80% to see every label. Use the filters above to add rules, explores, dashboards and tables.</p></aside>`;
    const G = this._kgFull();
    const nb = (G.adj.get(n.id) || []).map((x) => G.nodes.get(x));
    const of = (k) => nb.filter((x) => x.kind === k);
    let desc = ''; let owner = '';
    if (n.kind === 'term') { const t = IX.term.get(n.label); desc = t.d; owner = t.own; }
    else if (n.kind === 'product') { const p = IX.product.get(n.id.slice(8)); desc = p.d; owner = p.own || (p.sown ? `${p.sown} (suggested)` : ''); }
    else if (n.kind === 'rule') { const r = IX.rules.find((x) => x.id === n.id.slice(5)); desc = r.d; owner = r.own; }
    else if (n.kind === 'metric') { const f = IX.field.get(n.id); desc = f.d || 'No description yet.'; owner = (IX.docs.find((d) => d.id === n.id) || {}).own || ''; }
    else { const a = IX.node.get(n.id); desc = (a && a.d) || (n.id.startsWith('udd.') ? 'A dashboard built in Looker.' : 'No description yet.'); owner = (a && a.owner) || ''; }
    const group = (k, title) => { const xs = of(k); return xs.length ? html`<div class="side-h">${title} (${xs.length})</div><div class="col-links">${xs.slice(0, 8).map((x) => html`<button class="lnk" @click=${() => { this.kgSel = x.id; }} @dblclick=${() => this._kgOpen(x)}><span class="kb ${KCLS[x.kind]} is-compact">${icon(KICON[x.kind], 12)}</span><span>${x.label}</span></button>`)}${xs.length > 8 ? html`<span class="muted small">${xs.length - 8} more</span>` : nothing}</div>` : nothing; };
    return html`
      <aside class="lg-panel kg-panel">
        <span class="kb ${KCLS[n.kind]}">${icon(KICON[n.kind], 12)}<span>${KLABEL[n.kind]}</span></span>
        <h3 class="is-plain">${n.label}</h3>
        <p class="small">${desc}</p>
        <dl class="kv">
          ${owner ? html`<dt>Owner</dt><dd>${owner}</dd>` : nothing}
          ${n.dom && IX.domain.get(n.dom) ? html`<dt>Domain</dt><dd>${IX.domain.get(n.dom).label}</dd>` : nothing}
          ${n.prods.size ? html`<dt>Data products</dt><dd>${[...n.prods].map((p) => IX.product.get(p).name).join(', ')}</dd>` : nothing}
          <dt>Links</dt><dd>${nb.length}</dd>
        </dl>
        <div class="lg-actions">
          <button class="btn is-primary" @click=${() => this._kgOpen(n)}>Open ${KLABEL[n.kind].toLowerCase()}</button>
          ${n.id !== this.kgFocus ? html`<button class="btn" @click=${() => { this.kgFocus = n.id; }}>Focus graph here</button>` : nothing}
        </div>
        ${group('term', 'Glossary terms')}${group('product', 'Data products')}${group('metric', 'Metrics')}${group('table', 'Tables')}${group('explore', 'Explores')}${group('dashboard', 'Dashboards')}${group('rule', 'Business rules')}
      </aside>`;
  }

  _kgOpen(n) {
    if (n.kind === 'term') this._go('term', n.id.slice(5));
    else if (n.kind === 'product') this._go('product', n.id.slice(8));
    else if (n.kind === 'rule') this._go('rule', n.id.slice(5));
    else this._open(n.id);
  }

  /* ---------------- tables */

  _renderTables() {
    const layers = [['all', 'All'], ['source', 'Sources'], ['staging', 'Staging'], ['integration', 'Integration'], ['warehouse', 'Warehouse'], ['seed', 'Seeds'], ['external', 'External']];
    const q = this.tQ.toLowerCase().trim();
    let list = [...IX.node.values()].filter((n) => ['source', 'seed', 'table', 'model', 'snapshot'].includes(n.k));
    const counts = new Map(layers.map(([l]) => [l, l === 'all' ? list.length : list.filter((n) => layerOf(n) === l).length]));
    if (this.tLayer !== 'all') list = list.filter((n) => layerOf(n) === this.tLayer);
    if (this.tDom !== 'all') list = list.filter((n) => n.dom === this.tDom);
    if (this.tUndoc) list = list.filter((n) => !n.d);
    if (q) list = list.filter((n) => `${n.name} ${n.rel || ''} ${n.d || ''} ${n.sys || ''}`.toLowerCase().includes(q));
    list.sort((a, b) => (LAYERS[layerOf(b)]?.rank || 0) - (LAYERS[layerOf(a)]?.rank || 0) || a.name.localeCompare(b.name));
    return html`
      ${this._pageHead('Browse', 'Tables', 'Every table in the warehouse, from the raw source tables to the business-ready warehouse tables Looker reads.')}
      <div class="toolbar">
        <div class="seg">${layers.map(([l, label]) => html`<button class=${l === this.tLayer ? 'is-on' : ''} @click=${() => { this.tLayer = l; this.tLimit = PAGE; }}>${label}<span class="seg-n">${fmtInt(counts.get(l))}</span></button>`)}</div>
        <div class="toolbar-r">
          ${this._filterInput(this.tQ, 'Filter by name', (v) => { this.tQ = v; this.tLimit = PAGE; })}
          ${this._select('Domain', this.tDom, this._domainOptions(), (v) => { this.tDom = v; this.tLimit = PAGE; })}
          <label class="tog"><input type="checkbox" .checked=${this.tUndoc} @change=${(e) => { this.tUndoc = e.target.checked; }}><span>Undocumented only</span></label>
        </div>
      </div>
      ${this.tLayer !== 'all' && LAYERS[this.tLayer] ? html`<p class="layer-note">${LAYERS[this.tLayer].text}</p>` : nothing}
      <div class="card is-flush">
        <table class="tbl is-fixed">
          <colgroup><col style="width:27%"><col style="width:10%"><col style="width:11%"><col><col style="width:84px"><col style="width:80px"><col style="width:60px"><col style="width:70px"></colgroup>
          <thead><tr><th>Table</th><th>Layer</th><th>Domain</th><th>Description</th><th class="r" title="Columns, and the share described">Columns</th><th class="r">Rows</th><th class="r">Tests</th><th class="r">Used by</th></tr></thead>
          <tbody>
            ${list.slice(0, this.tLimit).map((n) => html`
              <tr class="is-link" @click=${() => this._open(n.id)}>
                <td><div class="cell-t">${this._kindBadge(n.k, layerOf(n), true)}<span class="mono">${n.name}</span></div>${n.sys ? html`<div class="cell-s">${n.sys}</div>` : (n.rel ? html`<div class="cell-s mono">${n.rel}</div>` : nothing)}</td>
                <td>${(LAYERS[layerOf(n)] || {}).label || ''}</td>
                <td>${(IX.domain.get(n.dom) || {}).label || ''}</td>
                <td class="cell-d"><div class="clamp">${n.d ? n.d : html`<span class="muted">No description</span>`}</div></td>
                <td class="r">${(() => { const c = colStats(n); return c.total ? html`${fmtInt(c.total)}<div class="cell-sub ${st(pct(c.doc, c.total))}" title=${`${pct(c.doc, c.total)}% of columns described`}><span class="pct">${pct(c.doc, c.total)}%</span></div>` : ''; })()}</td>
                <td class="r">${n.whErr === 'missing' ? html`<span class="chip is-tiny t-peach" title="Not found in the warehouse">Missing</span>` : (n.wh ? (n.bqType === 'view' ? html`<span class="muted small">view</span>` : fmtCompact(n.rows)) : '')}</td>
                <td class="r">${n.tests.length || ''}</td>
                <td class="r">${(IX.down.get(n.id) || []).length || ''}</td>
              </tr>`)}
          </tbody>
        </table>
        ${!list.length ? this._empty('No tables match these filters.') : nothing}
      </div>
      ${list.length > this.tLimit ? html`<button class="more" @click=${() => { this.tLimit += PAGE; }}>Show ${Math.min(PAGE, list.length - this.tLimit)} more of ${fmtInt(list.length - this.tLimit)}</button>` : nothing}`;
  }

  /* ---------------- looker model */

  _renderLooker() {
    const q = this.lQ.toLowerCase().trim();
    const explores = [...IX.node.values()].filter((n) => n.k === 'explore' && (!q || `${n.name} ${n.label || ''} ${n.d || ''}`.toLowerCase().includes(q)));
    const views = [...IX.node.values()].filter((n) => n.k === 'view' && (!q || `${n.name} ${n.d || ''}`.toLowerCase().includes(q)));
    const u = this._usage;
    explores.sort((a, b) => ((u.explores.get(b.name) || {}).runs || 0) - ((u.explores.get(a.name) || {}).runs || 0) || !!a.hidden - !!b.hidden || titleOf(a).localeCompare(titleOf(b)));
    views.sort((a, b) => a.name.localeCompare(b.name));
    return html`
      ${this._pageHead('Browse', `Looker model: ${META.model}`, 'Explores are where people ask questions in Looker. Each one joins a set of views; each view describes one table and its fields and metrics.')}
      <div class="toolbar">
        ${this._seg([['explores', `Explores (${explores.length})`], ['views', `Views (${views.length})`]], this.lTab, (v) => { this.lTab = v; })}
        <div class="toolbar-r">${this._filterInput(this.lQ, 'Filter by name', (v) => { this.lQ = v; })}</div>
      </div>
      ${this.lTab === 'explores' ? html`
        <div class="ex-grid">${explores.map((ex) => {
          const use = u.explores.get(ex.name);
          const views2 = IX.viewsByExplore.get(ex.name) || [];
          const metrics = views2.reduce((s, v) => s + (IX.fieldsByView.get(v) || []).filter((f) => f.k === 'measure' && !f.hid).length, 0);
          return html`
            <button class="ex-card" @click=${() => this._go('node', ex.id)}>
              <div class="ex-top">${this._kindBadge('explore', 'explore', true)}<span class="ex-t">${titleOf(ex)}</span>${ex.hidden ? html`<span class="chip">Hidden</span>` : nothing}${ex.rowLevel ? html`<span class="chip" title="Row-level access filter">${icon('lock', 11)} Row-level</span>` : nothing}</div>
              <div class="ex-n mono">${ex.name}</div>
              <div class="ex-d">${ex.d || html`<span class="muted">No description</span>`}</div>
              <div class="ex-f">
                <span><b>${views2.length}</b> views</span><span><b>${fmtInt(metrics)}</b> metrics</span>
                ${use ? html`<span><b>${fmtInt(use.runs)}</b> queries</span><span><b>${use.users}</b> people</span>` : nothing}
              </div>
            </button>`;
        })}</div>` : html`
        <div class="card is-flush">
          <table class="tbl is-fixed">
            <colgroup><col style="width:34%"><col style="width:22%"><col style="width:14%"><col style="width:100px"><col style="width:84px"><col style="width:84px"></colgroup>
            <thead><tr><th>View</th><th>Reads from</th><th>Domain</th><th class="r">Dimensions</th><th class="r">Metrics</th><th class="r">Explores</th></tr></thead>
            <tbody>${views.map((v) => {
              const fs = IX.fieldsByView.get(v.name) || [];
              const phys = IX.node.get(v.up[0]);
              return html`
                <tr class="is-link" @click=${() => this._open(v.id)}>
                  <td><div class="cell-t">${this._kindBadge('view', 'view', true)}<span class="mono">${v.name}</span></div>${v.d ? html`<div class="cell-s">${v.d}</div>` : nothing}</td>
                  <td>${phys ? html`<span class="mono small">${phys.k === 'view' ? `nested in ${phys.name}` : phys.name}</span>` : (v.derived ? html`<span class="small">Derived table</span>` : html`<span class="muted small">Not mapped</span>`)}</td>
                  <td>${(IX.domain.get(v.dom) || {}).label || ''}</td>
                  <td class="r">${fs.filter((f) => f.k === 'dimension').length}</td>
                  <td class="r">${fs.filter((f) => f.k === 'measure').length}</td>
                  <td class="r">${(IX.exploresByView.get(v.name) || []).length || html`<span class="muted">0</span>`}</td>
                </tr>`;
            })}</tbody>
          </table>
        </div>`}`;
  }

  /* ---------------- metrics */

  _fieldScore(f) {
    return (this._usage.fields.get(f.id) || 0) / 50 + (f.dash.length + ((this._usage.fieldDash.get(f.id) || new Set()).size)) * 40 + (f.gl ? 60 : 0) + (f.d ? 5 : 0);
  }

  _renderMetrics() {
    const q = this.mQ.toLowerCase().trim();
    let list = [...IX.field.values()].filter((f) => f.k === 'measure');
    const liveDash = (f) => (this._usage.fieldDash.get(f.id) || new Set()).size;
    const scopes = [
      ['key', 'On a dashboard or in the glossary', (f) => !f.hid && (f.dash.length || liveDash(f) || f.gl)],
      ['all', 'All visible', (f) => !f.hid],
      ['undoc', 'Missing a description', (f) => !f.hid && !f.d],
      ['hidden', 'Hidden', (f) => f.hid],
    ];
    const scope = scopes.find((s) => s[0] === this.mScope) || scopes[0];
    const counts = new Map(scopes.map((s) => [s[0], list.filter(s[2]).length]));
    list = list.filter(scope[2]);
    if (this.mDom !== 'all') list = list.filter((f) => f.dom === this.mDom);
    if (q) list = list.filter((f) => `${f.id} ${f.l || ''} ${f.d || ''} ${(f.gl || []).join(' ')}`.toLowerCase().includes(q));
    if (this.mSort === 'used') list.sort((a, b) => this._fieldScore(b) - this._fieldScore(a));
    else list.sort((a, b) => fieldTitle(a).localeCompare(fieldTitle(b)));
    return html`
      ${this._pageHead('Browse', 'Metrics', 'Every measure in the Looker model. Open one to see its formula, every field and table it is built from, and where it is used.')}
      <div class="toolbar">
        <div class="seg">${scopes.map(([s, l]) => html`<button class=${s === this.mScope ? 'is-on' : ''} @click=${() => { this.mScope = s; this.mLimit = PAGE; }}>${l}<span class="seg-n">${fmtInt(counts.get(s))}</span></button>`)}</div>
        <div class="toolbar-r">
          ${this._filterInput(this.mQ, 'Filter metrics', (v) => { this.mQ = v; this.mLimit = PAGE; })}
          ${this._select('Domain', this.mDom, this._domainOptions(), (v) => { this.mDom = v; this.mLimit = PAGE; })}
          ${this._select('Sort', this.mSort, [['used', 'Most used'], ['name', 'Name']], (v) => { this.mSort = v; })}
        </div>
      </div>
      <div class="card is-flush">${this._metricTable(list.slice(0, this.mLimit), true)}</div>
      ${list.length > this.mLimit ? html`<button class="more" @click=${() => { this.mLimit += PAGE; }}>Show ${Math.min(PAGE, list.length - this.mLimit)} more of ${fmtInt(list.length - this.mLimit)}</button>` : nothing}`;
  }

  _metricTable(list, withView) {
    if (!list.length) return this._empty('No metrics match these filters.');
    return html`
      <table class="tbl is-fixed">
        <colgroup><col style="width:${withView ? 30 : 36}%">${withView ? html`<col style="width:17%">` : nothing}<col style="width:9%"><col><col style="width:96px"><col style="width:84px"></colgroup>
        <thead><tr><th>Metric</th>${withView ? html`<th>View</th>` : nothing}<th>Type</th><th>Description</th><th class="r">Dashboards</th><th class="r">Uses</th></tr></thead>
        <tbody>${list.map((f) => {
          const live = (this._usage.fieldDash.get(f.id) || new Set()).size;
          const uses = this._usage.fields.get(f.id);
          return html`
            <tr class="is-link" @click=${() => this._go('field', f.id)}>
              <td><div class="cell-t">${this._kindBadge('measure', 'measure', true)}<span>${fieldTitle(f)}</span></div><div class="cell-s"><span class="mono">${f.n}</span>${f.gl ? html`<span class="chip is-tiny t-know">${f.gl[0]}</span>` : nothing}</div></td>
              ${withView ? html`<td class="mono small">${f.v}</td>` : nothing}
              <td class="small">${f.ty}</td>
              <td class="cell-d"><div class="clamp">${f.d || html`<span class="muted">No description</span>`}</div></td>
              <td class="r">${f.dash.length + live || ''}</td>
              <td class="r">${uses ? fmtInt(uses) : ''}</td>
            </tr>`;
        })}</tbody>
      </table>`;
  }

  /* ---------------- dashboards */

  _renderDashboards() {
    const lookml = [...IX.node.values()].filter((n) => n.k === 'dashboard').sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    const u = this._usage;
    return html`
      ${this._pageHead('Browse', 'Dashboards', 'LookML dashboards kept in the repo, and every dashboard on the Looker instance that queried this model in the last 90 days, with the metrics each one shows.')}
      <section class="card">
        <div class="card-h"><h2>Used in the last ${USAGE_DAYS} days</h2><span class="muted small">From Looker System Activity</span></div>
        ${u.state === 'loading' ? html`<div class="skel"></div>` : (u.state !== 'ok' || !u.dashboards.length ? this._empty('Usage needs access to Looker System Activity.') : html`
          <table class="tbl is-fixed">
            <colgroup><col style="width:36%"><col><col style="width:84px"><col style="width:90px"><col style="width:80px"></colgroup>
            <thead><tr><th>Dashboard</th><th>Explores</th><th class="r">Metrics</th><th class="r">Queries</th><th class="r">People</th></tr></thead>
            <tbody>${u.dashboards.slice(0, 40).map((d) => html`
              <tr class="is-link" @click=${() => this._go('udd', d.id)}>
                <td><div class="cell-t">${this._kindBadge('udd', 'dashboard', true)}<span>${d.title}</span></div><div class="cell-s mono">Dashboard ${d.id}</div></td>
                <td class="small">${[...d.explores].slice(0, 3).map((x) => (IX.node.get(`explore.${x}`) ? titleOf(IX.node.get(`explore.${x}`)) : x)).join(', ')}${d.explores.size > 3 ? ` and ${d.explores.size - 3} more` : ''}</td>
                <td class="r">${[...d.fields].filter((f) => IX.field.get(f).k === 'measure').length}</td>
                <td class="r">${fmtInt(d.runs)}</td>
                <td class="r">${d.users}</td>
              </tr>`)}</tbody>
          </table>`)}
      </section>
      <section class="card">
        <div class="card-h"><h2>LookML dashboards in the repo</h2><span class="muted small">${plural(lookml.length, 'dashboard')}</span></div>
        <div class="ex-grid">${lookml.map((d) => {
          const ms = new Set(); (d.tiles || []).forEach((t) => t.f.forEach((f) => { if (IX.field.get(f)?.k === 'measure') ms.add(f); }));
          return html`
            <button class="ex-card" @click=${() => this._go('node', d.id)}>
              <div class="ex-top">${this._kindBadge('dashboard', 'dashboard', true)}<span class="ex-t">${titleOf(d)}</span>${d.inModel ? nothing : html`<span class="chip t-peach" title="The model file does not include this dashboard">Not in model</span>`}</div>
              <div class="ex-n mono">${d.path}</div>
              <div class="ex-d">${d.d || html`<span class="muted">No description</span>`}</div>
              <div class="ex-f"><span><b>${(d.tiles || []).length}</b> tiles</span><span><b>${ms.size}</b> metrics</span><span><b>${d.up.length}</b> explores</span></div>
            </button>`;
        })}</div>
      </section>`;
  }

  _renderUdd(id) {
    const d = this._usage.dashFields.get(id);
    if (!d) return this._usage.state === 'loading' ? html`<div class="skel"></div>` : this._empty('This dashboard has no recorded queries on this model in the last 90 days.');
    const byEx = new Map();
    [...d.fields].forEach((fid) => { const f = IX.field.get(fid); push(byEx, f.v, f); });
    const measures = [...d.fields].map((f) => IX.field.get(f)).filter((f) => f.k === 'measure');
    return html`
      ${this._pageHead('Looker dashboard', d.title, `Dashboard ${id} on the Looker instance. Built in Looker, not kept in the repo. Its metrics come from the queries it ran in the last ${USAGE_DAYS} days.`, nothing, [[d.title, null]])}
      <div class="asset"><div class="asset-main">
      <div class="stat-row">
        ${this._stat(fmtInt(d.runs), 'Queries', `Last ${USAGE_DAYS} days`)}
        ${this._stat(fmtInt(d.users), 'People')}
        ${this._stat(fmtInt(measures.length), 'Metrics')}
        ${this._stat(fmtInt(d.explores.size), 'Explores')}
      </div></div>
      <aside class="asset-side">${this._lookerBlock('dashboard', id, d.title)}</aside></div>
      ${(META.usage || {}).show_people ? this._dashUsers(id) : nothing}
      ${this._rulesTile(this._rulesFor('udd', id))}
      <section class="card">
        <div class="card-h"><h2>Explores it queries</h2></div>
        <div class="chips">${[...d.explores].map((x) => (IX.node.has(`explore.${x}`) ? this._nodeLink(`explore.${x}`) : html`<span class="chip">${x}</span>`))}</div>
      </section>
      <section class="card is-flush"><div class="card-h pad"><h2>Metrics on this dashboard</h2></div>${this._metricTable(measures, true)}</section>
      <section class="card">
        <div class="card-h"><h2>Dimensions by view</h2></div>
        ${[...byEx.entries()].map(([v, fs]) => html`<div class="kv-group"><div class="kv-h">${this._nodeLink(`view.${v}`)}</div><div class="chips">${fs.filter((f) => f.k !== 'measure').map((f) => this._fieldLink(f.id, { icon: false }))}</div></div>`)}
      </section>`;
  }

  /* ---------------- documentation health */

  _health() {
    if (this._healthCache) return this._healthCache;
    const nodes = [...IX.node.values()];
    const models = nodes.filter((n) => n.k === 'model');
    const wh = models.filter((n) => n.layer === 'warehouse');
    const sources = nodes.filter((n) => n.k === 'source');
    const realCols = (list) => list.flatMap((n) => n.cols.filter((c) => !c.nest && !c.gone));
    const whCols = realCols(wh);
    const allCols = realCols(models);
    const measures = [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid);
    const dims = [...IX.field.values()].filter((f) => f.k === 'dimension' && !f.hid);
    const explores = nodes.filter((n) => n.k === 'explore' && !n.hidden);
    const tested = models.filter((n) => n.tests.length);
    const whPk = wh.filter((n) => { const ts = n.tests.map((t) => t.t); return ts.includes('unique') && ts.includes('not_null'); });
    const item = (label, a, b, note, go) => ({ label, a, b, pct: pct(a, b), note, go });
    const items = [
      item('Warehouse tables described', wh.filter((n) => n.d).length, wh.length, 'Description in the dbt schema file', () => { this.tLayer = 'warehouse'; this.tUndoc = true; this._go('tables'); }),
      item('Warehouse tables with a tested key', whPk.length, wh.length, 'unique and not_null tests on the primary key', () => { this.tLayer = 'warehouse'; this.tUndoc = false; this._go('tables'); }),
      item('Metrics described', measures.filter((f) => f.d).length, measures.length, 'Visible Looker measures with a description', () => { this.mScope = 'undoc'; this._go('metrics'); }),
      item('Explores described', explores.filter((n) => n.d).length, explores.length, 'Visible explores with a description', () => { this.lTab = 'explores'; this._go('looker'); }),
      item('dbt models described', models.filter((n) => n.d).length, models.length, 'All layers', () => { this.tLayer = 'all'; this.tUndoc = true; this._go('tables'); }),
      item('dbt models with any test', tested.length, models.length, 'At least one dbt test', () => { this.tLayer = 'all'; this.tUndoc = false; this._go('tables'); }),
      item('Warehouse table columns described', whCols.filter((c) => c.doc).length, whCols.length, 'Every column in BigQuery; described in dbt or by a Looker field', () => { this.tLayer = 'warehouse'; this.tUndoc = false; this._go('tables'); }),
      item('All dbt model columns described', allCols.filter((c) => c.doc).length, allCols.length, 'Staging, integration and warehouse', null),
      item('Dimensions described', dims.filter((f) => f.d).length, dims.length, 'Visible Looker dimensions', null),
      item('Source tables described', sources.filter((n) => n.d).length, sources.length, 'dbt source declarations', () => { this.tLayer = 'source'; this.tUndoc = true; this._go('tables'); }),
    ];
    const keyMetrics = measures.filter((f) => f.dash.length || f.gl);
    const ruled = new Set(IX.rules.flatMap((r) => r.m));
    items.push(item('Key metrics covered by a business rule', keyMetrics.filter((f) => ruled.has(f.id)).length, keyMetrics.length, 'Metrics on dashboards or in the glossary', () => this._go('rules')));
    const weights = [3, 2, 3, 2, 1, 1, 2, 1, 1, 1, 1];
    const score = Math.round(items.reduce((s, it, i) => s + it.pct * weights[i], 0) / weights.reduce((a, b) => a + b, 0));
    const orphanViews = nodes.filter((n) => n.k === 'view' && !(IX.exploresByView.get(n.name) || []).length && !n.nested);
    const outsideModel = nodes.filter((n) => n.k === 'dashboard' && !n.inModel);
    const broken = [];
    IX.field.forEach((f) => f.refs.forEach((r) => { if (!IX.field.has(r)) broken.push({ f, r }); }));
    const unmapped = nodes.filter((n) => n.k === 'view' && !n.up.length && !n.derived);
    const external = nodes.filter((n) => n.k === 'table');
    const priority = measures.filter((f) => !f.d && (f.dash.length || f.gl)).sort((a, b) => b.dash.length - a.dash.length);
    const missingTables = nodes.filter((n) => n.whErr === 'missing');
    const missingViews = [...new Set(missingTables.flatMap((t) => (IX.down.get(t.id) || []).filter((d) => IX.node.get(d)?.k === 'view')))].map((id) => IX.node.get(id));
    const gone = nodes.flatMap((n) => (n.cols || []).filter((c) => c.gone && c.src === 'dbt').map((c) => ({ n, c })));
    const goneFields = nodes.flatMap((n) => (n.cols || []).filter((c) => c.gone && c.src === 'lookml').flatMap((c) => (c.used || []).map((f) => ({ n, c, f }))));
    this._healthCache = { items, score, orphanViews, outsideModel, broken, unmapped, external, priority, missingTables, missingViews, gone, goneFields };
    return this._healthCache;
  }

  /* Documentation scores by grouping. Each row: checks (part of whole) and the gaps behind them. */
  _healthRows(group) {
    if (!this._hrCache) this._hrCache = new Map();
    if (this._hrCache.has(group)) return this._hrCache.get(group);
    const visible = (f) => !f.hid && (f.k === 'measure' || f.k === 'dimension');
    const fieldGaps = (fs) => fs.filter((f) => !f.d).map((f) => ({ id: f.id, title: f.id, kind: f.k }));
    const lookerRow = (key, label, sub, describedSelf, selfGap, fs, open) => {
      const checks = [];
      if (describedSelf !== null) checks.push({ label: sub, a: describedSelf ? 1 : 0, b: 1 });
      const fsd = fs.filter((f) => f.d).length;
      const metrics = fs.filter((f) => f.k === 'measure');
      checks.push({ label: 'Fields', a: fsd, b: fs.length });
      checks.push({ label: 'Metrics', a: metrics.filter((f) => f.d).length, b: metrics.length });
      checks.push({ label: 'Labels', a: fs.filter((f) => f.l).length, b: fs.length });
      const gaps = [];
      if (selfGap) gaps.push(selfGap);
      const mg = fieldGaps(metrics);
      if (mg.length) gaps.push({ label: 'Metrics with no description', items: mg });
      const dg = fieldGaps(fs.filter((f) => f.k === 'dimension'));
      if (dg.length) gaps.push({ label: 'Dimensions with no description', items: dg });
      return { key, label, checks, gaps, open, n: fs.length };
    };
    const tableRow = (key, label, tables, extraFields = [], open = null) => {
      const cols = tables.flatMap((n) => n.cols.filter((c) => !c.nest && !c.gone));
      const checks = [
        { label: 'Tables', a: tables.filter((n) => n.d).length, b: tables.length },
        { label: 'Columns', a: cols.filter((c) => c.doc).length, b: cols.length },
        { label: 'Tested', a: tables.filter((n) => n.tests.length).length, b: tables.length },
      ];
      if (extraFields.length) checks.push({ label: 'Metrics', a: extraFields.filter((f) => f.d).length, b: extraFields.length });
      const gaps = [];
      const ut = tables.filter((n) => !n.d).map((n) => ({ id: n.id, title: n.name, kind: n.k }));
      if (ut.length) gaps.push({ label: 'Tables with no description', items: ut });
      const nt = tables.filter((n) => !n.tests.length).map((n) => ({ id: n.id, title: n.name, kind: n.k }));
      if (nt.length) gaps.push({ label: 'Tables with no tests', items: nt });
      const um = fieldGaps(extraFields);
      if (um.length) gaps.push({ label: 'Metrics with no description', items: um });
      const uc = tables.map((n) => ({ n, c: n.cols.filter((c) => !c.nest && !c.gone && !c.doc).length })).filter((x) => x.c).sort((a, b) => b.c - a.c)
        .map((x) => ({ id: x.n.id, title: `${x.n.name} (${x.c} columns)`, kind: x.n.k, tab: 'columns' }));
      if (uc.length) gaps.push({ label: 'Tables with undescribed columns', items: uc });
      return { key, label, checks, gaps, open, n: tables.length };
    };
    const nodes = [...IX.node.values()];
    const fieldsOf = (views) => views.flatMap((v) => (IX.fieldsByView.get(v) || []).filter(visible));
    let rows = [];
    if (group === 'model') {
      const ex = nodes.filter((n) => n.k === 'explore' && !n.hidden);
      const vs = nodes.filter((n) => n.k === 'view');
      const r = lookerRow(META.model, `Model ${META.model}`, null, null, null, [...IX.field.values()].filter(visible), () => this._go('looker'));
      r.checks.unshift({ label: 'Views', a: vs.filter((n) => n.d).length, b: vs.length });
      r.checks.unshift({ label: 'Explores', a: ex.filter((n) => n.d).length, b: ex.length });
      r.gaps.unshift({ label: 'Explores with no description', items: ex.filter((n) => !n.d).map((n) => ({ id: n.id, title: titleOf(n), kind: 'explore' })) });
      rows = [r];
    } else if (group === 'explore') {
      rows = nodes.filter((n) => n.k === 'explore').map((n) => lookerRow(n.id, titleOf(n), 'Described', !!n.d,
        n.d ? null : { label: 'The explore itself', items: [{ id: n.id, title: titleOf(n), kind: 'explore' }] }, fieldsOf(IX.viewsByExplore.get(n.name) || []), () => this._open(n.id)));
    } else if (group === 'view') {
      rows = nodes.filter((n) => n.k === 'view' && (IX.fieldsByView.get(n.name) || []).some(visible)).map((n) => lookerRow(n.id, n.name, 'Described', !!n.d,
        n.d ? null : { label: 'The view itself', items: [{ id: n.id, title: n.name, kind: 'view' }] }, fieldsOf([n.name]), () => this._open(n.id)));
    } else if (group === 'layer') {
      rows = ['source', 'staging', 'integration', 'warehouse', 'seed', 'external'].map((l) => {
        const t = nodes.filter((n) => ['model', 'source', 'seed', 'snapshot', 'table'].includes(n.k) && layerOf(n) === l);
        return t.length ? tableRow(l, LAYERS[l].label, t, [], () => { this.tLayer = l; this._go('tables'); }) : null;
      }).filter(Boolean);
    } else if (group === 'domain') {
      rows = (META.domains || []).map((d) => {
        const t = nodes.filter((n) => ['model', 'source', 'seed', 'snapshot', 'table'].includes(n.k) && n.dom === d.id);
        const ms = [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid && f.dom === d.id);
        return t.length ? tableRow(d.id, d.label, t, ms, () => this._go('domain', d.id)) : null;
      }).filter(Boolean);
    } else if (group === 'product') {
      rows = [...IX.product.values()].map((p) => tableRow(p.id, p.name, p.assets.map((a) => IX.node.get(a)).filter((n) => n && !['explore', 'dashboard'].includes(n.k)),
        p.m.map((m) => IX.field.get(m)).filter(Boolean), () => this._go('product', p.id)));
    }
    rows.forEach((r) => {
      r.checks = r.checks.filter((c) => c.b > 0);
      r.checks.forEach((c) => { c.pct = pct(c.a, c.b); });
      r.score = r.checks.length ? Math.round(r.checks.reduce((x, c) => x + c.pct, 0) / r.checks.length) : 0;
      r.gapCount = r.gaps.reduce((x, g) => x + g.items.length, 0);
    });
    rows.sort((a, b) => a.score - b.score || b.n - a.n);
    this._hrCache.set(group, rows);
    return rows;
  }

  _renderHealthGroups() {
    const groups = [['overall', 'Overall'], ['model', 'Looker model'], ['explore', 'Explores'], ['view', 'Views'], ['layer', 'dbt layer'], ['domain', 'Domain'], ['product', 'Data product']];
    const bar = html`<div class="toolbar"><div class="toolbar-l"><span class="muted small">Score by</span>${this._seg(groups, this.hGroup, (v) => { this.hGroup = v; this.hSel = ''; })}</div></div>`;
    if (this.hGroup === 'overall') return bar;
    const rows = this._healthRows(this.hGroup);
    const sel = rows.find((r) => r.key === this.hSel);
    const heads = [...new Set(rows.flatMap((r) => r.checks.map((c) => c.label)))];
    const NOTE = {
      model: 'Share of explores, views, visible fields and metrics with a description, and fields with a label. Hidden fields are left out.',
      explore: 'For each explore: whether it is described, and the share of visible fields, metrics and labels across the views it joins. Lowest score first.',
      view: 'For each Looker view: whether it is described, and the share of its visible fields and metrics with a description and a label. Lowest score first.',
      layer: 'For each dbt layer: tables described, columns described (from BigQuery and dbt) and tables with at least one dbt test.',
      domain: 'For each domain: tables and columns described, tables tested, and Looker metrics described.',
      product: 'For each data product: its tables and columns described, tables tested, and its metrics described.',
    };
    return html`${bar}<p class="muted small">${NOTE[this.hGroup]} Pick a row to see its gaps.</p>
      <div class="hg">
        <section class="card is-flush hg-list">
          <table class="tbl is-fixed hg-tbl">
            <colgroup><col style="min-width:180px"><col style="width:120px">${heads.map(() => html`<col style="width:96px">`)}<col style="width:64px"></colgroup>
            <thead><tr><th>${groups.find((g) => g[0] === this.hGroup)[1]}</th><th>Score</th>${heads.map((h) => html`<th class="r">${h}</th>`)}<th class="r">Gaps</th></tr></thead>
            <tbody>${rows.map((r) => html`
              <tr class="is-link ${r.key === this.hSel ? 'is-sel' : ''}" @click=${() => { this.hSel = r.key === this.hSel ? '' : r.key; }}>
                <td><span class="hg-name">${r.label}</span></td>
                <td><div class="hg-score ${st(r.score)}"><span class="bar-track"><span class="bar-fill" style="width:${r.score}%"></span></span><b>${r.score}</b></div></td>
                ${heads.map((h) => { const c = r.checks.find((x) => x.label === h); return html`<td class="r">${c ? html`<span class="pct ${st(c.pct)}">${c.pct}%</span><div class="cell-sub">${fmtInt(c.a)} of ${fmtInt(c.b)}</div>` : html`<span class="muted">–</span>`}</td>`; })}
                <td class="r">${r.gapCount ? fmtInt(r.gapCount) : html`<span class="muted">0</span>`}</td>
              </tr>`)}</tbody>
          </table>
        </section>
        ${sel ? html`<aside class="card hg-gaps">
          <div class="card-h"><h2>${sel.label}</h2>${sel.open ? html`<button class="lnk-btn" @click=${sel.open}>Open ${icon('arrow', 14)}</button>` : nothing}</div>
          <div class="hg-score is-big ${st(sel.score)}"><span class="bar-track"><span class="bar-fill" style="width:${sel.score}%"></span></span><b>${sel.score}</b><span class="muted small">of 100</span></div>
          ${sel.gaps.length ? sel.gaps.map((g) => html`<div class="side-h">${g.label} (${fmtInt(g.items.length)})</div>
            <ul class="gap-list">${g.items.slice(0, 40).map((it) => html`<li><button class="lnk" @click=${() => { if (it.tab) this._go('node', it.id, it.tab); else this._open(it.id); }}>${this._kindBadge(it.kind, (IX.node.get(it.id) && layerOf(IX.node.get(it.id))) || it.kind, true)}<span class="mono">${it.title}</span></button></li>`)}
            ${g.items.length > 40 ? html`<li class="muted small">${fmtInt(g.items.length - 40)} more</li>` : nothing}</ul>`) : this._empty('No gaps. Everything here is described and tested.')}
        </aside>` : html`<aside class="card hg-gaps is-hint"><p class="muted">Pick a row to see its gaps: the undescribed explores, views, metrics, tables and columns, each linked to its page.</p></aside>`}
      </div>`;
  }

  _renderHealth() {
    const h = this._health();
    const live = this._usage.state === 'ok' ? [...IX.field.values()].filter((f) => f.k === 'measure' && !f.hid && !f.d && (this._usage.fieldDash.get(f.id) || new Set()).size && !h.priority.includes(f)) : [];
    const priority = [...h.priority, ...live];
    const head = this._pageHead('Govern', 'Documentation health', 'How much of the platform is described and tested, across dbt and Looker, and the gaps worth fixing first. Recalculated each time the catalog is built.');
    if (this.hGroup !== 'overall') return html`${head}${this._renderHealthGroups()}`;
    return html`
      ${head}
      ${this._renderHealthGroups()}
      <div class="grid-1-2">
        <section class="card score-card">
          ${this._scoreRing(h.score)}
          <div class="score-t">Documentation score</div>
          <p class="muted small">A weighted average of the checks on the right. Warehouse tables and metrics count most, because they are what people read.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>Checks</h2></div>
          <div class="bars">
            ${h.items.map((it) => html`
              <button class="bar-row ${it.go ? 'is-link' : ''}" @click=${it.go || (() => {})}>
                <div class="bar-l"><div>${it.label}</div><div class="muted small">${it.note}</div></div>
                <div class="bar-track ${st(it.pct)}"><div class="bar-fill" style="width:${it.pct}%"></div></div>
                <div class="bar-v"><b class=${st(it.pct)}>${it.pct}%</b><span class="muted small">${fmtInt(it.a)} of ${fmtInt(it.b)}</span></div>
              </button>`)}
          </div>
        </section>
      </div>
      <section class="card is-flush">
        <div class="card-h pad"><h2>Fix first: metrics on dashboards with no description</h2><span class="muted small">${plural(priority.length, 'metric')}</span></div>
        ${this._metricTable(priority.slice(0, 40), true)}
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Views in no explore</h2><span class="muted small">${plural(h.orphanViews.length, 'view')}</span></div>
          <p class="muted small">Nobody can query these in Looker. Join them to an explore or remove them.</p>${this._assetList(h.orphanViews, 14)}</section>
        <section class="card"><div class="card-h"><h2>Tables dbt does not build</h2><span class="muted small">${plural(h.external.length, 'table')}</span></div>
          <p class="muted small">Looker reads these tables but no dbt model creates them, so they have no lineage or tests.</p>${this._assetList(h.external, 14)}</section>
      </div>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Looker views reading tables that do not exist</h2><span class="muted small">${plural(h.missingViews.length, 'view')}</span></div>
          <p class="muted small">${plural(h.missingTables.length, 'table')} named in LookML or dbt sources were not in the warehouse on ${shortDate((META.warehouse || {}).built || '')}. Queries on these views fail.</p>${this._assetList(h.missingViews.length ? h.missingViews : h.missingTables, 14)}</section>
        <section class="card"><div class="card-h"><h2>Documented columns not in the warehouse</h2><span class="muted small">${plural(h.gone.length, 'column')}</span></div>
          <p class="muted small">Listed in a dbt schema file but missing from the table in BigQuery: renamed or removed columns whose documentation is out of date.</p>
          ${h.gone.length ? html`<ul class="alist">${h.gone.slice(0, 14).map((g) => html`<li class="brk">${this._nodeLink(g.n.id)}<span class="mono">${g.c.n}</span></li>`)}${h.gone.length > 14 ? html`<li class="muted small">${fmtInt(h.gone.length - 14)} more</li>` : nothing}</ul>` : this._empty('None found.')}</section>
      </div>
      <section class="card"><div class="card-h"><h2>Looker fields reading columns that are not in the table</h2><span class="muted small">${plural(h.goneFields.length, 'field')}</span></div>
        <p class="muted small">The column a field reads was not in the production table in BigQuery. If the view takes its dataset from a user attribute, the column may exist in another dataset; otherwise the field fails when queried.</p>
        ${h.goneFields.length ? html`<ul class="alist cols-2">${h.goneFields.slice(0, 24).map((g) => html`<li class="brk">${this._fieldLink(g.f, { id: true })}<span class="muted">reads</span><span class="mono">${g.n.alias || g.n.name}.${g.c.n}</span></li>`)}${h.goneFields.length > 24 ? html`<li class="muted small">${fmtInt(h.goneFields.length - 24)} more</li>` : nothing}</ul>` : this._empty('None found.')}
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Broken field references</h2><span class="muted small">${plural(h.broken.length, 'reference')}</span></div>
          ${h.broken.length ? html`<ul class="alist">${h.broken.map((b) => html`<li class="brk">${this._fieldLink(b.f.id, { id: true })}<span class="muted">refers to</span><span class="mono">${b.r}</span><span class="muted">which does not exist</span></li>`)}</ul>` : this._empty('None found.')}</section>
        <section class="card"><div class="card-h"><h2>Dashboards outside the model</h2><span class="muted small">${plural(h.outsideModel.length, 'dashboard')}</span></div>
          <p class="muted small">These files are in the repo but the model file does not include them, so Looker may not show them.</p>${this._assetList(h.outsideModel)}</section>
      </div>`;
  }

  /* ---------------- usage (live widgets) */

  _renderUsage() {
    const model = this._model();
    const win = `${USAGE_DAYS} days`;
    const u = this._usage;
    const people = (META.usage || {}).show_people;
    const sel = people ? (this.uSel || '') : '';
    const selName = sel ? ((u.users || []).find((x) => String(x.id) === sel) || {}).name : '';
    const uf = (local) => this.getEffectiveFilters({ 'query.model': model, ...(sel ? { 'user.id': sel } : {}), ...local });
    const head = this._pageHead('Govern', 'Usage', `How the ${model} model is used, live from Looker System Activity.${people ? ' Pick a person to see their use.' : ''}`);
    if (u.state === 'unavailable') {
      return html`${head}<section class="card empty-tile"><span class="empty-big">${icon('usage', 28)}</span><h2>Usage is not available to you</h2>
        <p class="body muted">These figures come from Looker System Activity, which needs the see_system_activity permission. Ask a Looker admin for access; everything else in the catalog works without it.</p></section>`;
    }
    return html`
      ${head}
      ${people ? html`<div class="toolbar"><div class="toolbar-l">
        ${this._select('Person', sel, [['', 'Everyone'], ...(u.users || []).map((x) => [String(x.id), x.name])], (v) => { this.uSel = v; })}
        ${sel ? html`<button class="btn" @click=${() => { this.uSel = ''; }}>${icon('close', 13)} Clear</button>` : nothing}
      </div></div>` : nothing}
      <section class="kpis">
        <app-kpi id="da-kpi-usage-queries" label="Queries" subtitle="Weekly, last 12 weeks" format="int" sparkline sparkline-agg="sum"
          looker-model="system__activity" explore="history"
          .query=${{ fields: ['history.created_week', 'history.query_run_count'], sorts: ['history.created_week desc'], limit: '12' }}
          .filters=${uf({ 'history.created_week': '12 weeks ago for 12 weeks' })}>
        </app-kpi>
        <app-kpi id="da-kpi-usage-dash-users" label="Dashboard users" subtitle=${`Last ${USAGE_DAYS} days`} format="int"
          looker-model="system__activity" explore="history" query-field="history.dashboard_user" .filters=${uf({ 'history.created_date': win })}>
        </app-kpi>
        <app-kpi id="da-kpi-usage-explore-users" label="Explore users" subtitle=${`Last ${USAGE_DAYS} days`} format="int"
          looker-model="system__activity" explore="history" query-field="history.explore_user" .filters=${uf({ 'history.created_date': win })}>
        </app-kpi>
        <app-kpi id="da-kpi-usage-dashboards" label="Dashboards run" subtitle=${`Last ${USAGE_DAYS} days`} format="int"
          looker-model="system__activity" explore="history" query-field="history.dashboard_run_count" .filters=${uf({ 'history.created_date': win })}>
        </app-kpi>
      </section>
      <div class="bento">
        <section class="card c8">
          <div class="card-h"><h2>Queries by week${selName ? `: ${selName}` : ''}</h2><span class="muted small">Last 26 weeks</span></div>
          <app-chart id="da-chart-usage-weekly" type="areaspline" height="280px" bare looker-model="system__activity" explore="history" color="var(--c-primary)" value-format="int"
            .query=${{ fields: ['history.created_week', 'history.query_run_count'], sorts: ['history.created_week'], limit: '26' }}
            .filters=${uf({ 'history.created_week': '26 weeks' })}>
          </app-chart>
        </section>
        ${people ? html`<section class="card c4 is-flush">
          <div class="card-h pad"><h2>Top people</h2><span class="muted small">Click a row to filter</span></div>
          <app-grid id="da-grid-usage-people" height="300px" bare looker-model="system__activity" explore="history"
            .columnDefs=${[{ field: 'user.name', headerName: 'Person', flex: 2, minWidth: 120 }, { field: 'history.query_run_count', headerName: 'Queries', type: 'rightAligned', flex: 1, minWidth: 80 }, { field: 'history.dashboard_run_count', headerName: 'Dashboards', type: 'rightAligned', flex: 1, minWidth: 90 }]}
            .query=${{ fields: ['user.id', 'user.name', 'history.query_run_count', 'history.dashboard_run_count'], sorts: ['history.query_run_count desc'], limit: '25' }}
            .filters=${this.getEffectiveFilters({ 'query.model': model, 'history.created_date': win, 'user.name': '-NULL' })}
            @app-grid-row-click=${(e) => { const id = e.detail && e.detail.row && e.detail.row['user.id']; if (id) this.uSel = String(id); }}>
          </app-grid>
        </section>` : html`<section class="card c4"><div class="card-h"><h2>People</h2></div><p class="body muted">Names are turned off for this catalog (usage.show_people in catalog.yml).</p></section>`}
        <section class="card c6">
          <div class="card-h"><h2>Most used explores${selName ? `: ${selName}` : ''}</h2><span class="muted small">Click a bar to filter the page</span></div>
          <app-chart id="da-chart-usage-explores" type="bar" height="300px" bare cross-filter="query.view" looker-model="system__activity" explore="history" color="var(--c-primary)" value-format="int"
            .query=${{ fields: ['query.view', 'history.query_run_count'], sorts: ['history.query_run_count desc'], limit: '12' }}
            .filters=${uf({ 'history.created_date': win })}>
          </app-chart>
        </section>
        <section class="card c6 is-flush">
          <div class="card-h pad"><h2>Most used dashboards${selName ? `: ${selName}` : ''}</h2><span class="muted small">Last ${USAGE_DAYS} days</span></div>
          <app-grid id="da-grid-usage-dashboards" height="340px" bare looker-model="system__activity" explore="history"
            .columnDefs=${[{ field: 'dashboard.id', headerName: 'ID', width: 70, maxWidth: 80 }, { field: 'dashboard.title', headerName: 'Dashboard', flex: 2, minWidth: 180 }, { field: 'history.query_run_count', headerName: 'Queries', type: 'rightAligned', flex: 1, minWidth: 90 }, { field: 'history.dashboard_user', headerName: 'People', type: 'rightAligned', flex: 1, minWidth: 80 }]}
            .query=${{ fields: ['dashboard.id', 'dashboard.title', 'history.query_run_count', 'history.dashboard_user'], sorts: ['history.query_run_count desc'], limit: '100' }}
            .filters=${uf({ 'history.created_date': win, 'dashboard.id': 'NOT NULL' })}>
          </app-grid>
        </section>
        <section class="card c12 is-flush">
          <div class="card-h pad"><h2>Most used fields</h2><span class="muted small">All time, everyone (System Activity does not record this per person)</span></div>
          <app-grid id="da-grid-usage-fields" height="360px" bare looker-model="system__activity" explore="field_usage"
            .columnDefs=${[{ field: 'field_usage.field', headerName: 'Field', flex: 2, minWidth: 200 }, { field: 'field_usage.explore', headerName: 'Explore', flex: 1, minWidth: 140 }, { field: 'field_usage.times_used', headerName: 'Times used', type: 'rightAligned', flex: 1, minWidth: 110 }]}
            .query=${{ fields: ['field_usage.field', 'field_usage.explore', 'field_usage.times_used'], sorts: ['field_usage.times_used desc'], limit: '200' }}
            .filters=${this._fieldUsageFilters()}>
          </app-grid>
        </section>
      </div>`;
  }

  /* ---------------- lineage page */

  _renderLineagePage() {
    const focus = IX.node.get(this.lgFocus) ? this.lgFocus : this._defaultFocus();
    const pickRes = this.lgPick.trim() ? search(this.lgPick, {}).filter((d) => IX.node.has(d.id)).slice(0, 8) : [];
    const n = IX.node.get(focus);
    return html`
      ${this._pageHead('Understand', 'Lineage', 'How data moves from source systems through dbt into Looker. Pick any asset to see what it is built from and what depends on it.')}
      ${this._flowBand()}
      <div class="toolbar">
        <div class="lg-pick">
          ${this._filterInput(this.lgPick, 'Focus on a table, view, explore or dashboard', (v) => { this.lgPick = v; })}
          ${pickRes.length ? html`<div class="dc-sug is-inline">${pickRes.map((d) => html`
            <button class="dc-sug-row" @click=${() => { this.lgFocus = d.id; this.lgSel = d.id; this.lgPick = ''; this._refit('lineage'); }}>${this._kindBadge(d.type, d.layer, true)}<span class="dc-sug-t">${d.title}</span><span class="dc-sug-s mono">${d.sub}</span></button>`)}</div>` : nothing}
        </div>
        <div class="toolbar-r">
          ${this._select('Upstream', String(this.lgUp), [['1', '1 step'], ['2', '2 steps'], ['3', '3 steps'], ['8', 'All']], (v) => { this.lgUp = Number(v); this._refit('lineage'); })}
          ${this._select('Downstream', String(this.lgDown), [['0', 'None'], ['1', '1 step'], ['2', '2 steps'], ['8', 'All']], (v) => { this.lgDown = Number(v); this._refit('lineage'); })}
        </div>
      </div>
      <div class="lg-wrap">
        ${this._lineageGraph('lineage', focus, this.lgUp, this.lgDown, true)}
        ${this._lineagePanel(this.lgSel && IX.node.get(this.lgSel) ? this.lgSel : focus)}
      </div>
      ${this._legend()}
      ${n ? nothing : nothing}`;
  }

  _flowBand() {
    const c = this._counts();
    const steps = [
      ['source', 'Source tables', c.source, `${c.systems.size} systems`, () => { this.tLayer = 'source'; this._go('tables'); }],
      ['staging', 'Staging', c.staging, 'Cleaned copies', () => { this.tLayer = 'staging'; this._go('tables'); }],
      ['integration', 'Integration', c.integration, 'Joined and matched', () => { this.tLayer = 'integration'; this._go('tables'); }],
      ['warehouse', 'Warehouse', c.warehouse, 'Business-ready', () => { this.tLayer = 'warehouse'; this._go('tables'); }],
      ['view', 'Looker views', c.view, `${fmtInt(c.measure)} metrics`, () => { this.lTab = 'views'; this._go('looker'); }],
      ['explore', 'Explores', c.explore, 'Where people query', () => { this.lTab = 'explores'; this._go('looker'); }],
      ['dashboard', 'Dashboards', c.dashboard + ((this._usage.dashboards || []).length), 'Repo and Looker', () => this._go('dashboards')],
    ];
    return html`<div class="flow-row">${steps.map(([l, label, n, sub, go], i) => html`
      <button class="flow-step t-${LAYERS[l].tint}" @click=${go}><div class="flow-n">${fmtInt(n)}</div><div class="flow-l">${label}</div><div class="flow-s">${sub}</div></button>
      ${i < steps.length - 1 ? html`<div class="flow-arrow">${icon('arrow', 14)}</div>` : nothing}`)}</div>`;
  }

  _legend() {
    return html`<div class="legend">${['source', 'staging', 'integration', 'warehouse', 'view', 'explore', 'dashboard', 'external'].map((l) => html`<span><i class="sw t-${LAYERS[l].tint}"></i>${LAYERS[l].label}</span>`)}</div>`;
  }

  /* A readable stage-by-stage summary of where a data product's data comes from. */
  _productFlowModel(p) {
    if (!this._pfCache) this._pfCache = new Map();
    if (this._pfCache.has(p.id)) return this._pfCache.get(p.id);
    const assets = p.assets.map((a) => IX.node.get(a)).filter(Boolean);
    const tables = assets.filter((n) => !['explore', 'dashboard'].includes(n.k));
    const explores = assets.filter((n) => n.k === 'explore');
    const dashes = assets.filter((n) => n.k === 'dashboard');
    const up = new Map(); // id -> hop distance from the product's tables
    tables.forEach((t) => upstreamChain(t.id, 12).forEach((c) => { if (!up.has(c.id) || up.get(c.id) > c.depth) up.set(c.id, c.depth); }));
    const all = new Map(tables.map((t) => [t.id, 0]));
    up.forEach((d, id) => { if (!all.has(id)) all.set(id, d); });
    const nodesOf = (fn) => [...all.keys()].map((id) => IX.node.get(id)).filter((n) => n && fn(n));
    const rank = (n) => (all.get(n.id) || 0) * 100 - (IX.down.get(n.id) || []).length;
    const lookerEnds = new Set([...explores, ...dashes].map((n) => n.id));
    const views = [];
    tables.forEach((t) => (IX.down.get(t.id) || []).forEach((v) => { const vn = IX.node.get(v); if (vn && vn.k === 'view' && !views.includes(vn) && (IX.down.get(v) || []).some((x) => lookerEnds.has(x) || (IX.node.get(x) || {}).k === 'explore')) views.push(vn); }));
    const sources = nodesOf((n) => n.k === 'source' || n.k === 'seed' || n.k === 'table');
    const bySys = new Map();
    sources.forEach((n) => { const k = n.k === 'seed' ? 'Seed files' : (n.sys || (n.k === 'table' ? 'Tables dbt does not build' : 'Other')); push(bySys, k, n); });
    const sysItems = [...bySys.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => ({ label: k, sub: plural(list.length, 'table'), go: () => this._open(list[0].id) }));
    const item = (n) => ({ label: titleOf(n), id: n.id, go: () => this._open(n.id) });
    const lds = p.lds.map((ld) => { const d = this._usage.dashFields.get(ld); return { label: d ? d.title : `Looker dashboard ${ld}`, go: () => this._go('udd', ld) }; })
      .filter((x) => !dashes.some((n) => titleOf(n) === x.label));
    const cols = [
      { key: 'source', title: 'Source systems', n: sources.length, unit: 'tables', items: sysItems },
      { key: 'staging', title: 'Staging', n: 0, items: [] },
      { key: 'integration', title: 'Integration', n: 0, items: [] },
      { key: 'warehouse', title: 'Warehouse', n: 0, items: [] },
      { key: 'view', title: 'Looker views and explores', n: views.length + explores.length, items: [...explores.map(item), ...views.map(item)] },
      { key: 'dashboard', title: 'Dashboards', n: dashes.length + lds.length, items: [...dashes.map(item), ...lds] },
    ];
    ['staging', 'integration', 'warehouse'].forEach((l) => {
      const c = cols.find((x) => x.key === l);
      const list = nodesOf((n) => n.k === 'model' && n.layer === l || (l === 'warehouse' && n.k === 'snapshot'));
      const inProduct = new Set(tables.map((t) => t.id));
      list.sort((a, b) => (inProduct.has(b.id) ? 1 : 0) - (inProduct.has(a.id) ? 1 : 0) || rank(a) - rank(b));
      c.n = list.length;
      c.items = list.map((n) => ({ ...item(n), star: inProduct.has(n.id) }));
    });
    const out = { cols: cols.filter((c) => c.n || c.key === 'dashboard') };
    this._pfCache.set(p.id, out);
    return out;
  }

  _productFlow(p) {
    const m = this._productFlowModel(p);
    const TINT = { source: 'sky', staging: 'stg', integration: 'int', warehouse: 'wh', view: 'peach', dashboard: 'dash' };
    return html`<div class="pflow">${m.cols.map((c, i) => html`
      ${i ? html`<div class="pflow-arrow">${icon('arrow', 16)}</div>` : nothing}
      <div class="pflow-col">
        <div class="pflow-h t-${TINT[c.key]}"><span class="pflow-n">${fmtInt(c.n)}</span><span class="pflow-t">${c.title}</span></div>
        <ul class="pflow-list">${c.items.slice(0, 5).map((it) => html`<li><button class="pflow-item ${it.star ? 'is-star' : ''}" title=${it.star ? 'Part of this data product' : ''} @click=${it.go}><span class="pflow-l">${it.label}</span>${it.sub ? html`<span class="pflow-s">${it.sub}</span>` : nothing}</button></li>`)}
          ${c.items.length > 5 ? html`<li class="pflow-more">+${fmtInt(c.items.length - 5)} more</li>` : nothing}
          ${!c.items.length ? html`<li class="pflow-more">None listed</li>` : nothing}</ul>
      </div>`)}</div>
      <p class="pad-x muted small">Each column is one stage, with the assets nearest this product first. Names in bold are the product's own tables. Click any name to open it.</p>`;
  }

  _productLayout(p) {
    if (!this._plCache) this._plCache = new Map();
    if (this._plCache.has(p.id)) return this._plCache.get(p.id);
    const ids = new Set(p.assets.filter((a) => IX.node.has(a)));
    const tables = [...ids].filter((a) => !['explore', 'dashboard'].includes(IX.node.get(a).k));
    // upstream to the sources, nearest first, capped so the diagram stays readable
    let frontier = tables;
    const cap = 45;
    let hidden = 0;
    for (let hop = 0; hop < 3 && frontier.length; hop += 1) {
      const next = [];
      frontier.forEach((id) => (IX.node.get(id).up || []).forEach((u) => {
        if (ids.has(u) || !IX.node.has(u)) return;
        if (ids.size < cap) { ids.add(u); next.push(u); } else hidden += 1;
      }));
      frontier = next;
    }
    const systems = new Set();
    tables.forEach((t) => upstreamChain(t, 10).forEach((c) => { const n = IX.node.get(c.id); if (n && n.k === 'source' && n.sys) systems.add(n.sys); }));
    const allUp = new Set(tables.flatMap((t) => upstreamChain(t, 10).map((c) => c.id)));
    // Looker views between the tables and the product's explores and dashboards
    const lookerEnds = new Set(p.assets.filter((a) => ['explore', 'dashboard'].includes((IX.node.get(a) || {}).k)));
    tables.forEach((t) => (IX.down.get(t) || []).forEach((v) => {
      const vn = IX.node.get(v);
      if (vn && vn.k === 'view' && (IX.down.get(v) || []).some((x) => lookerEnds.has(x))) ids.add(v);
    }));
    const g = layoutSet(ids, false);
    g.systems = [...systems].sort();
    g.hiddenUp = [...allUp].filter((x) => !ids.has(x)).length + 0 * hidden;
    this._plCache.set(p.id, g);
    return g;
  }

  _lineageGraph(key, focus, up, down, selectable, preset = null, emphasis = null) {
    const g = preset || layoutLineage(focus, up, down);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const hot = this.lgHover ? this._connected(this.lgHover, g) : null;
    const inner = html`
      <svg class="g-edges" width=${g.width} height=${g.height} viewBox=${`0 0 ${g.width} ${g.height}`}>
        ${g.edges.map((e) => html`<svg overflow="visible"><path class="g-edge ${hot ? (hot.has(e.from) && hot.has(e.to) ? 'is-hot' : 'is-dim') : ''}" d=${edgePath(byId.get(e.from), byId.get(e.to))}></path></svg>`)}
      </svg>
      ${g.nodes.map((p) => {
        const n = IX.node.get(p.id);
        const l = layerOf(n);
        return html`
          <button class="g-node t-${LAYERS[l].tint} ${p.id === focus || (emphasis && emphasis.has(p.id)) ? 'is-focus' : ''} ${p.id === this.lgSel && selectable ? 'is-sel' : ''} ${hot ? (hot.has(p.id) ? '' : 'is-dim') : ''}"
            style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"
            @mouseenter=${() => { this.lgHover = p.id; }} @mouseleave=${() => { this.lgHover = ''; }}
            @click=${() => { if (selectable) this.lgSel = p.id; else this._open(p.id); }}
            @dblclick=${() => { if (selectable) { this.lgFocus = p.id; this.lgSel = p.id; this._refit(key); } }}
            title=${selectable ? 'Click for details. Double-click to focus here.' : 'Open'}>
            <span class="g-ic">${icon(KIND_ICON[n.k] || 'field', 14)}</span>
            <span class="g-txt"><span class="g-t">${titleOf(n)}</span><span class="g-s">${(LAYERS[l] || {}).label}${n.k === 'source' && n.sys ? ` · ${n.sys}` : ''}</span></span>
          </button>`;
      })}`;
    const note = g.truncated ? html`<div class="g-note">Showing the first ${MAX_GRAPH} assets. Use fewer steps to see the rest.</div>` : nothing;
    return this._graphShell(key, g, inner, note, byId.get(focus) || null);
  }

  _connected(id, g) {
    const ids = new Set(g.nodes.map((n) => n.id));
    const out = new Set([id]);
    const walk = (start, dir) => {
      const stack = [start];
      while (stack.length) {
        const x = stack.pop();
        const nb = dir === 'up' ? (IX.node.get(x)?.up || []) : (IX.down.get(x) || []);
        nb.forEach((y) => { if (ids.has(y) && !out.has(y)) { out.add(y); stack.push(y); } });
      }
    };
    walk(id, 'up'); walk(id, 'down');
    return out;
  }

  _lineagePanel(id) {
    const n = IX.node.get(id);
    if (!n) return nothing;
    const up = n.up.length;
    const down = (IX.down.get(id) || []).length;
    return html`
      <aside class="lg-panel">
        ${this._kindBadge(n.k, layerOf(n))}
        <h3>${titleOf(n)}</h3>
        ${n.rel ? html`<div class="mono small muted">${n.rel}</div>` : nothing}
        ${n.d ? html`<p class="small">${n.d}</p>` : html`<p class="small muted">No description.</p>`}
        <dl class="kv">
          <dt>Domain</dt><dd>${(IX.domain.get(n.dom) || {}).label || ''}</dd>
          <dt>Built from</dt><dd>${plural(up, 'asset')}</dd>
          <dt>Used by</dt><dd>${plural(down, 'asset')}</dd>
          ${n.k === 'view' ? html`<dt>Fields</dt><dd>${fmtInt((IX.fieldsByView.get(n.name) || []).length)}</dd>` : nothing}
        </dl>
        <div class="lg-actions">
          <button class="btn is-primary" @click=${() => this._open(id)}>Open ${KIND_LABEL[n.k] ? KIND_LABEL[n.k].toLowerCase() : 'asset'}</button>
          ${id !== this.lgFocus ? html`<button class="btn" @click=${() => { this.lgFocus = id; this._refit('lineage'); }}>Focus here</button>` : nothing}
        </div>
      </aside>`;
  }

  /* ---------------- asset page (tables, views, explores, dashboards) */

  _renderNode(id, tab) {
    const n = IX.node.get(id);
    if (!n) return this._empty('This asset is not in the catalog.');
    const l = layerOf(n);
    const tabs = [['overview', 'Overview']];
    if (['source', 'seed', 'table', 'model', 'snapshot'].includes(n.k)) tabs.push(['columns', `Columns (${colStats(n).total})`]);
    if (n.k === 'view') tabs.push(['fields', `Fields (${(IX.fieldsByView.get(n.name) || []).length})`]);
    if (n.k === 'explore' && (n.joins || []).length > 1) tabs.push(['joins', `Joins (${(n.joins || []).length - 1})`]);
    if (n.k === 'dashboard') tabs.push(['tiles', `Tiles (${(n.tiles || []).length})`]);
    tabs.push(['lineage', 'Lineage']);
    if (n.k === 'view' || n.k === 'model' || n.k === 'source' || n.k === 'table') tabs.push(['relationships', 'Relationships']);
    if (n.sql || n.derived) tabs.push(['code', 'Code']);
    const cur = tabs.find((t) => t[0] === tab) ? tab : 'overview';
    const sectionFor = n.k === 'dashboard' ? 'dashboards' : (n.k === 'explore' || n.k === 'view' ? 'looker' : 'tables');
    const crumbItems = [[SECTION_LABEL[sectionFor], () => { if (sectionFor === 'tables') this.tLayer = l; if (sectionFor === 'looker') this.lTab = n.k === 'view' ? 'views' : 'explores'; this._go(sectionFor); }]];
    if (IX.domain.get(n.dom)) crumbItems.push([IX.domain.get(n.dom).label, () => this._go('domain', n.dom), n.dom]);
    crumbItems.push([titleOf(n), null]);
    const cst = colStats(n);
    const isTable = ['source', 'seed', 'table', 'model', 'snapshot'].includes(n.k);
    const fsv = IX.fieldsByView.get(n.name) || [];
    const use = n.k === 'explore' ? this._usage.explores.get(n.name) : null;
    const facts = isTable ? [
      { v: n.wh && n.bqType !== 'view' ? fmtCompact(n.rows) : '', l: 'Rows', s: n.wh && n.bqType !== 'view' ? fmtBytes(n.bytes) : '' },
      { v: n.modified ? shortDate(n.modified) : '', l: 'Last updated', small: true },
      { v: cst.total ? `${pct(cst.doc, cst.total)}%` : '', l: 'Columns described', s: cst.total ? `${fmtInt(cst.doc)} of ${fmtInt(cst.total)}` : '', st: cst.total ? st(pct(cst.doc, cst.total)) : '', go: () => { this.route = { ...this.route, tab: 'columns' }; } },
      { v: n.tests.length, l: 'dbt tests' },
      { v: upstreamChain(n.id).length, l: 'Upstream assets' },
      { v: (IX.down.get(n.id) || []).length, l: 'Used by' },
    ] : n.k === 'view' ? [
      { v: fsv.filter((f) => f.k === 'dimension').length, l: 'Dimensions' }, { v: fsv.filter((f) => f.k === 'measure').length, l: 'Metrics' },
      { v: (IX.exploresByView.get(n.name) || []).length, l: 'Explores' }, { v: (IX.joinsByView.get(n.name) || []).length, l: 'Joins' },
    ] : n.k === 'explore' ? [
      { v: (IX.viewsByExplore.get(n.name) || []).length, l: 'Views joined' },
      { v: (IX.viewsByExplore.get(n.name) || []).reduce((x, v) => x + (IX.fieldsByView.get(v) || []).filter((f) => f.k === 'measure' && !f.hid).length, 0), l: 'Metrics' },
      { v: use ? fmtCompact(use.runs) : '', l: 'Queries', s: `Last ${USAGE_DAYS} days` }, { v: use ? use.users : '', l: 'People', s: `Last ${USAGE_DAYS} days` },
    ] : [
      { v: (n.tiles || []).length, l: 'Tiles' }, { v: n.up.length, l: 'Explores' },
    ];
    return html`
      ${this._crumbs(crumbItems)}
      ${this._hero({
        badge: this._kindBadge(n.k, l), title: titleOf(n), mono: !(n.k === 'explore' || n.k === 'dashboard'),
        path: n.k === 'explore' ? n.name : (n.rel || ''), desc: n.d, descKind: isTable ? 'dbt' : 'lookml',
        chips: html`${this._domChip(n.dom)}${n.mat ? html`<span class="chip">${humanise(n.mat)}</span>` : nothing}${n.sys ? html`<span class="chip">${n.sys}</span>` : nothing}${n.hidden ? html`<span class="chip">Hidden in Looker</span>` : nothing}${n.rowLevel ? html`<span class="chip">${icon('lock', 11)} Row-level access</span>` : nothing}${n.pdt ? html`<span class="chip">Persisted derived table</span>` : nothing}${n.k === 'dashboard' && !n.inModel ? html`<span class="chip t-peach">Not included by the model file</span>` : nothing}${(n.tags || []).map((t) => html`<span class="chip is-tag">#${t}</span>`)}${n.owner ? html`<span class="chip">Owner: ${n.owner}</span>` : nothing}`,
        facts,
      })}
      <div class="tabs">${tabs.map(([t, label]) => html`<button class=${t === cur ? 'is-on' : ''} @click=${() => { this.route = { ...this.route, tab: t }; }}>${label}</button>`)}</div>
      <div class="asset">
        <div class="asset-main">${this._renderNodeTab(n, cur)}</div>
        <aside class="asset-side">${this._nodeSide(n)}</aside>
      </div>`;
  }

  _renderNodeTab(n, tab) {
    if (tab === 'columns') return this._columnsTab(n);
    if (tab === 'fields') return this._fieldsTab(n);
    if (tab === 'joins') return this._joinsTab(n);
    if (tab === 'tiles') return this._tilesTab(n);
    if (tab === 'lineage') return html`<div class="card is-flush">${this._lineageGraph(`lineage-tab:${n.id}`, n.id, 3, 3, false)}</div>${this._legend()}<p class="muted small">Three steps each way. Open the full lineage view to go further.</p><button class="btn" @click=${() => this._go('lineage', n.id)}>Open in lineage view</button>`;
    if (tab === 'relationships') return this._relationshipsTab(n);
    if (tab === 'code') return html`<section class="card"><div class="card-h"><h2>${n.k === 'view' ? 'Derived table SQL' : 'dbt model SQL'}</h2>${n.path ? html`<span class="mono small muted">${n.path}</span>` : nothing}</div>${this._sqlBlock(n.sql || n.derived, n.name)}${n.sqlLen && n.sql && n.sqlLen > n.sql.length ? html`<p class="muted small">Showing the first ${fmtInt(n.sql.length)} of ${fmtInt(n.sqlLen)} characters. The full file is in the repo.</p>` : nothing}</section>`;
    return html`${this._overviewTab(n)}${this._rulesTile(this._rulesFor('node', n.id))}`;
  }

  _overviewTab(n) {
    const down = (IX.down.get(n.id) || []).map((id) => IX.node.get(id));
    const up = n.up.map((id) => IX.node.get(id)).filter(Boolean);
    if (n.k === 'explore') {
      const views = IX.viewsByExplore.get(n.name) || [];
      const ms = views.flatMap((v) => (IX.fieldsByView.get(v) || []).filter((f) => f.k === 'measure' && !f.hid)).sort((a, b) => this._fieldScore(b) - this._fieldScore(a));
      const use = this._usage.explores.get(n.name);
      return html`
        <section class="card"><div class="card-h"><h2>How the views join</h2><button class="lnk-btn" @click=${() => { this.route = { ...this.route, tab: 'joins' }; }}>Join diagram ${icon('arrow', 14)}</button></div>${this._joinMini(n)}</section>
        <section class="card is-flush"><div class="card-h pad"><h2>Most used metrics</h2></div>${this._metricTable(ms.slice(0, 15), true)}</section>`;
    }
    if (n.k === 'dashboard') {
      const ms = new Set(); (n.tiles || []).forEach((t) => t.f.forEach((f) => { if (IX.field.get(f)?.k === 'measure') ms.add(f); }));
      return html`
        <section class="card"><div class="card-h"><h2>Explores it reads</h2></div><div class="chips">${n.up.map((u) => this._nodeLink(u))}</div></section>
        <section class="card is-flush"><div class="card-h pad"><h2>Metrics on this dashboard</h2></div>${this._metricTable([...ms].map((f) => IX.field.get(f)), true)}</section>
        ${n.filters && n.filters.length ? html`<section class="card"><div class="card-h"><h2>Filters</h2></div><div class="chips">${n.filters.map((f) => html`<span class="chip">${f}</span>`)}</div></section>` : nothing}`;
    }
    if (n.k === 'view') {
      const fs = IX.fieldsByView.get(n.name) || [];
      const ms = fs.filter((f) => f.k === 'measure' && !f.hid).sort((a, b) => this._fieldScore(b) - this._fieldScore(a));
      const explores = IX.exploresByView.get(n.name) || [];
      return html`
        <section class="card"><div class="card-h"><h2>Reads from</h2></div>
          ${up.length ? html`<div class="chips">${up.map((u) => this._nodeLink(u.id))}</div>` : (n.derived ? html`<p class="small">A derived table: Looker builds it from SQL. See the Code tab.</p>` : html`<p class="small muted">The table name could not be matched to a dbt model or source.</p>`)}
          ${up[0] && up[0].k === 'model' ? html`<p class="small muted">Built by ${plural(upstreamChain(up[0].id).length, 'upstream dbt asset')}. See the Lineage tab.</p>` : nothing}
        </section>
        <section class="card"><div class="card-h"><h2>Queried through</h2></div>${explores.length ? html`<div class="chips">${explores.map((x) => this._nodeLink(`explore.${x}`))}</div>` : html`<p class="small muted">This view is not in any explore, so nobody can query it.</p>`}</section>
        ${ms.length ? html`<section class="card is-flush"><div class="card-h pad"><h2>Metrics</h2></div>${this._metricTable(ms.slice(0, 15), false)}</section>` : nothing}`;
    }
    // tables
    const views = down.filter((d) => d && d.k === 'view');
    const models = down.filter((d) => d && d.k !== 'view');
    const chain = upstreamChain(n.id);
    const sources = chain.map((c) => IX.node.get(c.id)).filter((x) => x && x.k === 'source');
    const fks = IX.fkByNode.get(n.id) || [];
    return html`
      ${this._whNotice(n)}
      ${views.length ? html`<section class="card"><div class="card-h"><h2>Looker views that read it</h2></div><div class="chips">${views.map((v) => this._nodeLink(v.id))}</div></section>` : nothing}
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Built from</h2></div>${up.length ? this._assetList(up, 12) : html`<p class="small muted">${n.k === 'source' ? `Loaded from ${n.sys || 'a source system'}${n.loader ? ` by ${n.loader}` : ''}.` : 'Nothing upstream in dbt.'}</p>`}</section>
        <section class="card"><div class="card-h"><h2>Feeds</h2></div>${models.length ? this._assetList(models, 12) : html`<p class="small muted">No dbt model reads from this.</p>`}</section>
      </div>
      ${fks.length ? html`<section class="card"><div class="card-h"><h2>Keys tested in dbt</h2></div>${this._fkList(fks)}</section>` : nothing}`;
  }

  _whNotice(n) {
    if (n.whErr === 'missing') return html`<div class="notice">${icon('warn', 15)}<div><b>Not found in the warehouse.</b> This table did not exist when the warehouse was last read (${shortDate((META.warehouse || {}).built || '')}). Anything in Looker that reads it will fail.${String(n.rel || '').includes('{{') ? ' Looker picks this dataset from a user attribute; the catalog checked the default dataset, so the table may exist in another one.' : ''}</div></div>`;
    if (n.whErr === 'unreadable') return html`<div class="notice">${icon('warn', 15)}<div><b>Warehouse details not available.</b> The dataset could not be read with the catalog's access, so columns come from dbt and LookML only.</div></div>`;
    return nothing;
  }

  _fkList(fks) {
    return html`<ul class="alist">${fks.map((k) => html`<li class="fk">${icon('key', 13)}<span class="mono">${k.col}</span><span class="muted">${k.dir === 'out' ? 'refers to' : 'is referred to by'}</span>${k.to ? this._nodeLink(k.to, { label: `${k.toName}.${k.toCol}` }) : html`<span class="mono">${k.toName}.${k.toCol}</span>`}</li>`)}</ul>`;
  }

  _nodeSide(n) {
    const rows = [];
    const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push(html`<dt>${k}</dt><dd>${v}</dd>`); };
    add('Type', KIND_LABEL[n.k] === 'dbt model' ? `${(LAYERS[n.layer] || {}).label || ''} model` : KIND_LABEL[n.k]);
    add('Domain', (IX.domain.get(n.dom) || {}).label);
    if (n.rel) add('Table', html`<span class="mono">${wbr(n.rel)}</span>`);
    if (n.path) add('File', html`<span class="mono">${wbr(n.path)}</span>`);
    if (n.mat) add('Materialised as', humanise(n.mat));
    if (n.bqType) add('In BigQuery', humanise(n.bqType));
    if (n.wh && n.bqType !== 'view') { add('Rows', fmtInt(n.rows)); add('Size', fmtBytes(n.bytes)); }
    if (n.modified) add('Last modified', shortDate(n.modified));
    if (n.part) add('Partitioned by', html`<span class="mono">${n.part}</span>`);
    if (n.clus) add('Clustered by', html`<span class="mono">${n.clus}</span>`);
    if (n.key) add('Unique key', html`<span class="mono">${n.key}</span>`);
    if (n.fresh) add('Freshness', n.fresh);
    if (n.loader) add('Loaded by', n.loader);
    if (n.k === 'explore') { add('Base view', html`<span class="mono">${n.base}</span>`); if (n.group) add('Menu group', n.group); if (n.always) add('Always filtered', html`<span class="mono">${n.always}</span>`); }
    if (n.nested) add('Nested in', this._nodeLink(`view.${n.nested}`, { icon: false }));
    add('Upstream', fmtInt(n.up.length));
    add('Downstream', fmtInt((IX.down.get(n.id) || []).length));
    const use = n.k === 'explore' ? this._usage.explores.get(n.name) : null;
    return html`
      <section class="card side-card"><div class="card-h"><h2>Details</h2></div><dl class="kv">${rows}</dl></section>
      ${use ? html`<section class="card side-card"><div class="card-h"><h2>Usage</h2></div><dl class="kv"><dt>Queries</dt><dd>${fmtInt(use.runs)}</dd><dt>People</dt><dd>${use.users}</dd></dl><p class="muted small">Last ${USAGE_DAYS} days.</p></section>` : nothing}
      ${n.k === 'explore' ? html`<section class="card side-card">${this._lookerBlock('explore', n.name, titleOf(n))}</section>` : nothing}
      ${n.k === 'dashboard' && n.lid ? html`<section class="card side-card">${this._lookerBlock('dashboard', n.lid, titleOf(n))}</section>` : nothing}
      <section class="card side-card"><button class="btn is-block" @click=${() => this._go('lineage', n.id)}>${icon('lineage')} Open in lineage view</button></section>`;
  }

  _columnsTab(n) {
    const q = this.colQ.toLowerCase();
    const tests = new Map();
    n.tests.forEach((t) => { if (t.c) push(tests, t.c.toLowerCase(), t); });
    const tableTests = n.tests.filter((t) => !t.c);
    const top = n.cols.filter((c) => !c.nest && !c.gone);
    const counts = { all: top.length, undoc: top.filter((c) => !c.doc).length, doc: top.filter((c) => c.doc).length, gone: n.cols.filter((c) => c.gone).length };
    let cols = n.cols.filter((c) => !q || `${c.n} ${c.d || ''}`.toLowerCase().includes(q));
    if (this.colDoc === 'all') cols = cols.filter((c) => !c.gone);
    if (this.colDoc === 'undoc') cols = cols.filter((c) => !c.doc && !c.gone);
    if (this.colDoc === 'doc') cols = cols.filter((c) => c.doc && !c.gone);
    if (this.colDoc === 'gone') cols = cols.filter((c) => c.gone);
    if (this.colSort === 'docfirst') cols = [...cols].sort((a, b) => (b.doc ? 1 : 0) - (a.doc ? 1 : 0));
    const srcNote = n.wh ? `Read from BigQuery on ${shortDate((META.warehouse || {}).built || '')}.` : 'From dbt schema files and the Looker view; this table has no warehouse details.';
    return html`
      ${this._whNotice(n)}
      <div class="toolbar">
        <div class="toolbar-l">
          ${this._seg([['all', `All ${fmtInt(counts.all)}`], ['undoc', `Undescribed ${fmtInt(counts.undoc)}`], ['doc', `Described ${fmtInt(counts.doc)}`], ...(counts.gone ? [['gone', `Not in the warehouse ${fmtInt(counts.gone)}`]] : [])], this.colDoc, (v) => { this.colDoc = v; })}
          ${this._filterInput(this.colQ, 'Filter columns', (v) => { this.colQ = v; })}
        </div>
        <div class="toolbar-r">${this._select('Order', this.colSort, [['table', 'Table order'], ['docfirst', 'Described first']], (v) => { this.colSort = v; })}</div>
      </div>
      <p class="muted small">${srcNote} A column counts as described when dbt or a Looker field describes it. Descriptions marked BigQuery come from the table itself.</p>
      ${tableTests.length ? html`<p class="small">Table tests: ${tableTests.map((t) => html`<span class="chip">${t.t}</span>`)}</p>` : nothing}
      <div class="card is-flush">
        ${cols.length ? html`
        <table class="tbl is-fixed">
          <colgroup><col style="width:28px"><col style="width:24%"><col style="width:11%"><col><col style="width:11%"><col style="width:18%"></colgroup>
          <thead><tr><th></th><th>Column</th><th>Type</th><th>Description</th><th>Tests</th><th>Used by Looker fields</th></tr></thead>
          <tbody>${cols.map((c) => html`
            <tr class=${c.gone ? 'is-gone' : ''}>
              <td class="doc-cell">${c.doc ? html`<span class="doc-dot is-on" title="Described">${icon('check', 11)}</span>` : html`<span class="doc-dot" title="Not described"></span>`}</td>
              <td><span class="mono ${c.nest ? 'is-nest' : ''}" title=${c.n}>${c.nest ? c.n.split('.').slice(-1)[0] : c.n}</span>${c.nest ? html`<div class="cell-s mono is-nest-path">${c.n}</div>` : nothing}</td>
              <td class="mono small" title=${c.ty || ''}>${c.ty || (c.src === 'lookml' ? html`<span class="muted">unknown</span>` : '')}</td>
              <td class="cell-d"><div class="clamp">${c.gone ? html`<span class="chip is-tiny t-peach">Not in the warehouse</span> ` : nothing}${c.d || html`<span class="muted">No description</span>`}${c.dsrc === 'bigquery' ? html` <span class="chip is-tiny">BigQuery</span>` : (c.dsrc === 'lookml' ? html` <span class="chip is-tiny">Looker field</span>` : nothing)}</div></td>
              <td>${(tests.get(c.n.toLowerCase()) || []).map((t) => html`<span class="chip is-tiny" title=${t.d || ''}>${t.t}</span>`)}</td>
              <td><div class="used">${(c.used || []).slice(0, 2).map((f) => this._fieldLink(f, { icon: false }))}${(c.used || []).length > 2 ? html`<span class="muted small">+${c.used.length - 2}</span>` : nothing}</div></td>
            </tr>`)}</tbody>
        </table>` : this._empty(n.cols.length ? 'No columns match.' : 'No columns are known for this table.')}
      </div>
      ${n.nestedMore ? html`<p class="muted small">${fmtInt(n.nestedMore)} more nested fields are not listed.</p>` : nothing}`;
  }

  _fieldsTab(n) {
    const q = this.colQ.toLowerCase();
    const fs = (IX.fieldsByView.get(n.name) || []).filter((f) => !q || `${f.n} ${f.l || ''} ${f.d || ''}`.toLowerCase().includes(q));
    const groups = [['measure', 'Metrics'], ['dimension', 'Dimensions'], ['parameter', 'Parameters'], ['filter', 'Filter fields']];
    return html`
      <div class="toolbar">${this._filterInput(this.colQ, 'Filter fields', (v) => { this.colQ = v; })}</div>
      ${groups.map(([k, label]) => {
        const list = fs.filter((f) => f.k === k);
        if (!list.length) return nothing;
        return html`
          <section class="card is-flush"><div class="card-h pad"><h2>${label}</h2><span class="muted small">${list.length}</span></div>
            <table class="tbl is-fixed">
              <colgroup><col style="width:32%"><col style="width:11%"><col><col style="width:22%"></colgroup>
              <thead><tr><th>Field</th><th>Type</th><th>Description</th><th>Reads</th></tr></thead>
              <tbody>${list.map((f) => html`
                <tr class="is-link" @click=${() => this._go('field', f.id)}>
                  <td><div class="cell-t"><span>${fieldTitle(f)}</span>${f.hid ? html`<span class="chip is-tiny">Hidden</span>` : nothing}${f.pk ? html`<span class="chip is-tiny">${icon('key', 10)} Key</span>` : nothing}</div><div class="cell-s mono">${f.n}</div></td>
                  <td class="small">${f.ty}</td>
                  <td class="cell-d"><div class="clamp">${f.d || html`<span class="muted">No description</span>`}</div></td>
                  <td class="small mono">${f.cols.length ? f.cols.slice(0, 2).join(', ') : (f.refs.length ? plural(f.refs.length, 'field') : '')}</td>
                </tr>`)}</tbody>
            </table>
          </section>`;
      })}`;
  }

  _joinMini(ex) {
    const joins = (ex.joins || []).filter((j) => !j.base);
    if (!joins.length) return html`<p class="small muted">This explore has one view and no joins.</p>`;
    return html`<ul class="joins">${joins.slice(0, 12).map((j) => html`
      <li><span class="mono">${j.a}</span>${j.a !== j.v ? html`<span class="muted small"> (${j.v})</span>` : nothing}
        <span class="rel">${REL_GLYPH[j.rel] || j.rel}</span><span class="muted small">${humanise(j.type || 'left_outer')}</span></li>`)}
      ${joins.length > 12 ? html`<li class="muted small">${joins.length - 12} more</li>` : nothing}</ul>`;
  }

  _joinsTab(ex) {
    const g = layoutJoins(ex);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const key = `erd-${ex.name}`;
    const sel = (ex.joins || []).find((j) => j.a === this.erdSel && !j.base);
    const inner = html`
      <svg class="g-edges" width=${g.width} height=${g.height} viewBox=${`0 0 ${g.width} ${g.height}`}>
        ${g.edges.map((e) => { const a = byId.get(e.from); const b = byId.get(e.to); return a && b ? html`<svg overflow="visible"><path class="g-edge ${this.erdSel === e.to ? 'is-hot' : ''}" d=${edgePath(a, b)}></path></svg>` : nothing; })}
      </svg>
      ${g.edges.map((e) => {
        const a = byId.get(e.from); const b = byId.get(e.to);
        if (!a || !b) return nothing;
        const x = b.x - 30; const y = b.y + b.h / 2;
        return html`<button class="g-edge-label ${this.erdSel === e.to ? 'is-on' : ''}" style="left:${x}px;top:${y}px" @click=${() => { this.erdSel = e.to; }} title=${REL_TEXT[e.join.rel] || ''}>${REL_GLYPH[e.join.rel] || e.join.rel}</button>`;
      })}
      ${g.nodes.map((p) => html`
        <div class="g-node is-card t-peach ${p.id === ex.base ? 'is-focus' : ''}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
          <button class="erd-h" @click=${() => this._open(`view.${p.view}`)} title="Open view">${icon('view', 13)}<span class="mono">${p.id}</span></button>
          ${p.id !== p.view ? html`<div class="erd-as mono">view ${p.view}</div>` : nothing}
          <ul class="erd-f">${p.keys.map((k) => html`<li>${icon('key', 10)}<span class="mono">${k}</span></li>`)}${p.more ? html`<li class="muted">+${p.more} more</li>` : nothing}</ul>
        </div>`)}`;
    return html`
      <div class="card is-flush">${this._graphShell(key, g, inner, nothing, byId.get(ex.base))}</div>
      <p class="muted small">Each box is a view in this explore, showing the fields its joins use. Click a relationship label to see the join condition.</p>
      ${sel ? html`<section class="card"><div class="card-h"><h2>${sel.a} joins ${REL_TEXT[sel.rel] || sel.rel}</h2><span class="chip">${humanise(sel.type || 'left_outer')} join</span></div>${this._sqlBlock(sel.on, sel.v)}</section>` : nothing}
      <div class="card is-flush">
        <table class="tbl is-fixed">
          <colgroup><col style="width:22%"><col style="width:22%"><col style="width:13%"><col style="width:11%"><col></colgroup>
          <thead><tr><th>Join</th><th>View</th><th>Relationship</th><th>Type</th><th>Condition</th></tr></thead>
          <tbody>${(ex.joins || []).filter((j) => !j.base).map((j) => html`
            <tr class="is-link" @click=${() => { this.erdSel = j.a; }}>
              <td class="mono">${j.a}</td><td>${this._nodeLink(`view.${j.v}`, { icon: false })}</td>
              <td>${REL_TEXT[j.rel] || j.rel}</td><td class="small">${humanise(j.type || 'left_outer')}</td><td class="mono small cell-d">${j.on}</td>
            </tr>`)}</tbody>
        </table>
      </div>`;
  }

  _tilesTab(d) {
    return html`<div class="tiles">${(d.tiles || []).map((t) => html`
      <section class="card tile">
        <div class="card-h"><h2>${t.t || 'Untitled tile'}</h2><span class="chip">${humanise((t.type || '').replace(/^looker_/, ''))}</span></div>
        <div class="small muted">Explore ${IX.node.has(`explore.${t.x}`) ? this._nodeLink(`explore.${t.x}`, { icon: false }) : t.x}</div>
        <div class="chips">${t.f.map((f) => this._fieldLink(f))}</div>
      </section>`)}</div>`;
  }

  _relationshipsTab(n) {
    let viewName = n.k === 'view' ? n.name : '';
    if (!viewName) {
      const v = (IX.down.get(n.id) || []).map((id) => IX.node.get(id)).find((x) => x && x.k === 'view');
      viewName = v ? v.name : '';
    }
    const fks = IX.fkByNode.get(n.id) || [];
    const rels = viewName ? (IX.joinsByView.get(viewName) || []) : [];
    if (!rels.length && !fks.length) return this._empty('No relationships found. This table is not joined to another in any explore, and has no relationships test in dbt.');
    let diagram = nothing;
    if (rels.length) {
      const g = layoutNeighbours(viewName);
      const byId = new Map(g.nodes.map((x) => [x.id, x]));
      const inner = html`
        <svg class="g-edges" width=${g.width} height=${g.height} viewBox=${`0 0 ${g.width} ${g.height}`}>
          ${g.edges.map((e) => html`<svg overflow="visible"><path class="g-edge" d=${edgePath(byId.get(e.from), byId.get(e.to))}></path></svg>`)}
        </svg>
        ${g.edges.map((e) => { const a = byId.get(e.from); const b = byId.get(e.to); const x = (a.x + a.w + b.x) / 2; const y = (a.y + a.h / 2 + b.y + b.h / 2) / 2; const rel = e.flip ? invertRel(e.rel.rel) : e.rel.rel; return html`<span class="g-edge-label" style="left:${x}px;top:${y}px" title=${e.rel.on}>${REL_GLYPH[rel] || rel}</span>`; })}
        ${g.nodes.map((p) => html`
          <button class="g-node t-peach ${p.center ? 'is-focus' : ''}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px" @click=${() => this._open(`view.${p.view}`)}>
            <span class="g-ic">${icon('view', 14)}</span><span class="g-txt"><span class="g-t">${p.view}</span><span class="g-s">${p.rel ? `in ${titleOf(IX.node.get(`explore.${p.rel.explore}`)) || p.rel.explore}` : 'This view'}</span></span>
          </button>`)}`;
      diagram = html`<div class="card is-flush">${this._graphShell(`rel:${viewName}`, g, inner, nothing, byId.get(viewName))}</div>${g.more ? html`<p class="muted small">${g.more} more related views are listed below.</p>` : nothing}`;
    }
    return html`
      ${diagram}
      ${rels.length ? html`
        <section class="card is-flush"><div class="card-h pad"><h2>Joined in explores</h2><span class="muted small">Read each row as: this table relates to the other table</span></div>
          <table class="tbl is-fixed">
            <colgroup><col style="width:26%"><col style="width:14%"><col style="width:20%"><col></colgroup>
            <thead><tr><th>Other table</th><th>Relationship</th><th>Explore</th><th>Join condition</th></tr></thead>
            <tbody>${rels.map((r) => html`
              <tr>
                <td>${this._nodeLink(`view.${r.other}`)}</td>
                <td>${REL_TEXT[r.rel] || r.rel}</td>
                <td>${this._nodeLink(`explore.${r.explore}`, { icon: false })}</td>
                <td class="mono small cell-d">${r.on}</td>
              </tr>`)}</tbody>
          </table>
        </section>` : nothing}
      ${fks.length ? html`<section class="card"><div class="card-h"><h2>Keys tested in dbt</h2></div>${this._fkList(fks)}</section>` : nothing}`;
  }

  /* ---------------- field (metric) page */

  _renderField(rawId) {
    const id = IX.groupOf.get(rawId) || rawId;
    const f = IX.field.get(id);
    if (!f) return this._empty('This field is not in the catalog.');
    const view = IX.node.get(`view.${f.v}`);
    const phys = physicalNodeOfView(f.v);
    const liveDash = [...(this._usage.fieldDash.get(f.id) || new Set())].map((d) => this._usage.dashFields.get(d)).filter(Boolean);
    const uses = this._usage.fields.get(f.id) || 0;
    const usedBy = (IX.usedBy.get(f.id) || []).map((x) => IX.field.get(x)).filter(Boolean);
    const sibling = (IX.fieldsByView.get(f.v) || []).filter((x) => x.id !== f.id && x.k === f.k && !x.hid && (f.g ? x.g === f.g : true)).slice(0, 8);
    const tree = this._derive(f.id, 0, new Set());
    const stt = this._treeStats(tree);
    const rules = this._rulesFor('field', f.id);
    const showPeople = (META.usage || {}).show_people && this._usage.state === 'ok';
    return html`
      ${this._crumbs([[SECTION_LABEL.metrics, () => this._go('metrics')], ...(IX.domain.get(f.dom) ? [[IX.domain.get(f.dom).label, () => this._go('domain', f.dom), f.dom]] : []), [f.v, () => this._open(`view.${f.v}`)], [fieldTitle(f), null]])}
      ${this._hero({
        badge: this._kindBadge(f.k, f.k), title: fieldTitle(f), path: f.id, desc: f.d,
        chips: html`${this._domChip(f.dom)}<span class="chip">Type: ${f.ty}</span>${f.fmt ? html`<span class="chip">Format: ${f.fmt}</span>` : nothing}${f.g ? html`<span class="chip">Group: ${f.g}</span>` : nothing}${f.hid ? html`<span class="chip">Hidden in Looker</span>` : nothing}${(f.gl || []).map((t) => html`<button class="chip is-link t-know" @click=${() => this._go('term', t)}>${icon('book', 11)} ${t}</button>`)}`,
        facts: [
          { v: uses ? fmtCompact(uses) : '', l: 'Uses in queries', s: 'All time' },
          { v: f.dash.length + liveDash.length, l: 'Dashboards' },
          { v: f.ex.length, l: 'Explores' },
          { v: stt.fields, l: 'Fields it builds on' },
          { v: stt.tables, l: 'Warehouse tables', s: phys ? phys.name : '' },
        ],
      })}
      <div class="bento is-flow">
        <section class="card c12">
          <div class="card-h"><h2>Definition</h2><span class="mono small muted">${view ? view.path : ''}</span></div>
          ${f.sql ? this._sqlBlock(f.sql, f.v) : html`<p class="body">${f.ty === 'count' ? 'Counts rows in the table (one per primary key).' : 'No SQL: Looker uses the default for this type.'}</p>`}
          ${f.flt ? html`<div class="flt"><span class="muted small">Only counts rows where</span>${f.flt.map(([k, v]) => html`<span class="chip"><span class="mono">${k}</span> is ${v}</span>`)}</div>` : nothing}
          ${f.grp ? html`<p class="small muted">A date group with timeframes: ${(f.tf || []).join(', ')}.</p>` : nothing}
        </section>
        <section class="card c6">
          <div class="card-h"><h2>Where it is used</h2></div>
          ${f.ex.length ? html`<div class="side-h">Explores</div><div class="chips">${f.ex.map((x) => this._nodeLink(`explore.${x}`, { icon: false }))}</div>` : nothing}
          ${f.dash.length ? html`<div class="side-h">Dashboards in the repo</div><div class="col-links">${f.dash.map((d) => this._nodeLink(d))}</div>` : nothing}
          ${liveDash.length ? html`<div class="side-h">Dashboards in Looker, last ${USAGE_DAYS} days</div><div class="col-links">${liveDash.slice(0, 6).map((d) => html`<button class="lnk" @click=${() => this._go('udd', d.id)}>${this._kindBadge('udd', 'dashboard', true)}<span>${d.title}</span></button>`)}</div>` : nothing}
          ${!f.ex.length && !f.dash.length && !liveDash.length ? this._empty('Not used in any explore or dashboard.') : nothing}
        </section>
        ${usedBy.length || sibling.length ? html`<section class="card c6"><div class="card-h"><h2>Related ${f.k === 'measure' ? 'metrics' : 'fields'}</h2></div>
          ${usedBy.length ? html`<div class="side-h">Built on this one</div><div class="col-links">${usedBy.slice(0, 6).map((x) => this._fieldLink(x.id))}</div>` : nothing}
          ${sibling.length ? html`<div class="side-h">In the same group</div><div class="col-links">${sibling.map((x) => this._fieldLink(x.id))}</div>` : nothing}
        </section>` : nothing}
        <section class="card c12">
          <div class="card-h"><h2>How it is calculated</h2><span class="muted small">From this ${f.k === 'measure' ? 'metric' : 'field'} down to the warehouse tables and their sources</span></div>
          <ul class="tree">${this._treeNode(tree, true)}</ul>
        </section>
        ${rules.length ? html`<div class="c6">${this._rulesTile(rules)}</div>` : nothing}
        ${showPeople ? this._metricUsers(f) : nothing}

      </div>`;
  }

  _dashUsers(id) {
    const dash = String(id);
    return html`<section class="card is-flush">
        <div class="card-h pad"><h2>Top users</h2><span class="muted small">Last ${USAGE_DAYS} days</span></div>
        <app-grid id="da-grid-dashboard-top-users" height="260px" bare looker-model="system__activity" explore="history"
          .columnDefs=${[{ field: 'user.name', headerName: 'Person', flex: 2, minWidth: 140 }, { field: 'history.dashboard_run_count', headerName: 'Times opened', type: 'rightAligned', flex: 1, minWidth: 110 }, { field: 'history.query_run_count', headerName: 'Queries', type: 'rightAligned', flex: 1, minWidth: 90 }]}
          .query=${{ fields: ['user.name', 'history.dashboard_run_count', 'history.query_run_count'], sorts: ['history.dashboard_run_count desc'], limit: '10' }}
          .filters=${this.getEffectiveFilters({ 'history.created_date': `${USAGE_DAYS} days`, 'dashboard.id': dash, 'user.name': '-NULL' })}>
        </app-grid>
      </section>`;
  }

  _metricUsers(f) {
    const like = `%.${f.n}%`;
    const views = f.ex.length ? { 'query.view': f.ex.join(',') } : {};
    return html`<section class="card c6 is-flush">
          <div class="card-h pad"><h2>Top users</h2><span class="muted small">Queries that used this field, last ${USAGE_DAYS} days</span></div>
          <app-grid id="da-grid-metric-top-users" height="280px" bare looker-model="system__activity" explore="history"
            .columnDefs=${[{ field: 'user.name', headerName: 'Person', flex: 2, minWidth: 140 }, { field: 'history.query_run_count', headerName: 'Queries', type: 'rightAligned', flex: 1, minWidth: 90 }]}
            .query=${{ fields: ['user.name', 'history.query_run_count'], sorts: ['history.query_run_count desc'], limit: '10' }}
            .filters=${this.getEffectiveFilters({ 'query.model': this._model(), 'history.created_date': `${USAGE_DAYS} days`, 'query.formatted_fields': like, ...views, 'user.name': '-NULL' })}>
          </app-grid>
        </section>`;
  }

  _derive(fid, depth, seen) {
    const f = IX.field.get(fid);
    if (!f) return { type: 'missing', id: fid, children: [] };
    if (seen.has(fid) || depth > 7) return { type: 'field', f, children: [], cut: true };
    const s = new Set(seen); s.add(fid);
    const children = f.refs.map((r) => this._derive(r, depth + 1, s));
    if (f.cols.length) {
      const phys = physicalNodeOfView(f.v);
      f.cols.forEach((c) => {
        const meta = phys ? phys.cols.find((x) => x.n.toLowerCase() === c) : null;
        const tests = phys ? phys.tests.filter((t) => (t.c || '').toLowerCase() === c) : [];
        children.push({ type: 'column', col: c, view: f.v, phys, meta, tests });
      });
    }
    return { type: 'field', f, children };
  }

  _treeStats(tree) {
    const fields = new Set(); const cols = new Set(); const tables = new Set();
    const walk = (t, root) => {
      if (t.type === 'field' && !root) fields.add(t.f.id);
      if (t.type === 'column') { cols.add(`${t.view}.${t.col}`); if (t.phys) tables.add(t.phys.id); }
      (t.children || []).forEach((c) => walk(c, false));
    };
    walk(tree, true);
    return { fields: fields.size, columns: cols.size, tables: tables.size };
  }

  _treeNode(t, root = false) {
    if (t.type === 'missing') return html`<li><div class="tn is-missing">${icon('warn', 13)}<span class="mono">${t.id}</span><span class="muted small">is referenced but not defined</span></div></li>`;
    if (t.type === 'column') {
      const key = `col:${t.view}.${t.col}`;
      const open = this.treeOpen.has(key);
      const chain = t.phys ? upstreamChain(t.phys.id, 8) : [];
      const sources = chain.map((c) => IX.node.get(c.id)).filter((x) => x && (x.k === 'source' || x.k === 'seed'));
      return html`<li>
        <div class="tn is-col">
          <span class="tn-ic">${icon('table', 13)}</span>
          <span class="tn-main">
            <span class="tn-t"><span class="mono">${t.phys ? t.phys.alias || t.phys.name : t.view}.<b>${t.col}</b></span>${t.meta && t.meta.ty ? html`<span class="chip is-tiny">${t.meta.ty}</span>` : nothing}${t.tests.map((x) => html`<span class="chip is-tiny">${x.t}</span>`)}</span>
            <span class="tn-d">${t.meta && t.meta.d ? t.meta.d : html`<span class="muted">Column in ${t.phys ? html`${this._nodeLink(t.phys.id, { icon: false })}` : 'a table not built by dbt'}${t.meta && t.meta.d ? '' : ', no description'}</span>`}</span>
          </span>
          ${t.phys ? html`<button class="tn-tog" @click=${() => { const s = new Set(this.treeOpen); if (open) s.delete(key); else s.add(key); this.treeOpen = s; }}>${open ? 'Hide upstream' : `Show ${chain.length} upstream`}</button>` : nothing}
        </div>
        ${t.phys && open ? html`<ul><li><div class="tn is-chain">
          <div class="chain">
            ${this._nodeLink(t.phys.id)}
            ${chain.slice(0, 14).map((c) => html`<span class="chain-sep">${icon('back', 12)}</span>${this._nodeLink(c.id)}`)}
            ${chain.length > 14 ? html`<span class="muted small">and ${chain.length - 14} more</span>` : nothing}
          </div>
          ${sources.length ? html`<div class="small muted">Sources: ${[...new Set(sources.map((s) => s.sys || s.name))].join(', ')}</div>` : nothing}
          <button class="lnk-btn" @click=${() => this._go('lineage', t.phys.id)}>See as a diagram ${icon('arrow', 13)}</button>
        </div></li></ul>` : nothing}
      </li>`;
    }
    const f = t.f;
    const kids = t.children || [];
    return html`<li class=${root ? 'is-root' : ''}>
      <div class="tn ${root ? 'is-root' : ''}">
        <span class="tn-ic">${icon(f.k === 'measure' ? 'metric' : 'dimension', 13)}</span>
        <span class="tn-main">
          <span class="tn-t">${root ? html`<b>${fieldTitle(f)}</b>` : html`<button class="lnk" @click=${() => this._go('field', f.id)}>${fieldTitle(f)}</button>`}<span class="mono small muted">${f.id}</span><span class="chip is-tiny">${f.ty}</span>${t.cut ? html`<span class="muted small">(shown above)</span>` : nothing}</span>
          ${!root && f.sql ? html`<span class="tn-sql mono">${f.sql.length > 160 ? `${f.sql.slice(0, 160)}…` : f.sql}</span>` : nothing}
        </span>
      </div>
      ${kids.length ? html`<ul>${kids.map((k) => this._treeNode(k))}</ul>` : nothing}
    </li>`;
  }
}

/* ------------------------------------------------------------------ styles */

const STYLES = html`<style>
ra-data-catalog {
  --c-primary: #4F60FF; --c-primary-soft: #E0E0FF; --c-primary-ink: #2F3997;
  --c-ink: #181B25; --c-muted: #474B58; --c-subtle: #6B6F7C; --c-border: #E3E4EA; --c-border-strong: #CDD0DA;
  --c-canvas: #F7F7FA; --c-card: #FFFFFF; --c-hover: #F1F2F6; --c-code: #F7F7FA;
  --c-sky: #E4F4FC; --c-sky-ink: #0B5470; --c-stg: #EEF0FF; --c-stg-ink: #3A45B8; --c-int: #E3E5FF; --c-int-ink: #2F3AA8; --c-wh: #D9DCFF; --c-wh-ink: #262F8C;
  --c-peach: #FFE6D9; --c-peach-ink: #86350E; --c-lemon: #FFF2C7; --c-lemon-ink: #634A00; --c-metric: #FFE4EB; --c-metric-ink: #8C1D3B;
  --c-dash: #E0F5E6; --c-dash-ink: #1B5E2F; --c-know: #EEE6FF; --c-know-ink: #4E2A9E;
  --c-mint: #E0F5E6; --c-mint-ink: #1B5E2F; --c-violet: #EEE6FF; --c-violet-ink: #4E2A9E; --c-indigo: #D9DCFF; --c-indigo-ink: #262F8C;
  --c-good: #2E9D50; --c-good-ink: #1D6B36; --c-warn: #E0A100; --c-warn-ink: #7A4D00; --c-poor: #D9473A; --c-poor-ink: #9B2C1F;
  --c-sand: #F2EEE6; --c-sand-ink: #5C4B2E; --c-grey: #EEEFF3; --c-grey-ink: #3E4250;
  --c-warn: #B4541A; --c-edge: #C3C7D6;
  --f-display: 'Beatrice';
  --f-head: 'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --f-body: 'Beatrice', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --fs-12: 12px; --fs-13: 13px; --fs-14: 14px; --fs-16: 16px; --fs-20: 20px; --fs-24: 24px; --fs-32: 32px; --fs-40: 40px;
  --sp-4: 4px; --sp-8: 8px; --sp-12: 12px; --sp-16: 16px; --sp-24: 24px; --sp-32: 32px; --sp-48: 48px;
  --f-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --app-primary: var(--c-primary);
  display: block; color: var(--c-ink); background: var(--c-canvas); container-type: inline-size;
}
.dc-root { display: grid; grid-template-columns: 236px minmax(0, 1fr); min-height: 100vh; background: var(--c-canvas); font-family: var(--f-body); font-size: var(--fs-14); line-height: 1.5; color: var(--c-ink); -webkit-font-smoothing: antialiased; }
.dc-root * { box-sizing: border-box; }
:where(.dc-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
.dc-root h1, .dc-root h2, .dc-root h3 { margin: 0; font-family: var(--f-head); font-weight: 500; letter-spacing: -.005em; }
.dc-root b, .dc-root strong { font-family: var(--f-head); font-weight: 600; }
.dc-root p { margin: 0; }
.mono { font-family: var(--f-mono); font-size: .92em; }
.muted { color: var(--c-muted); }
.small { font-size: var(--fs-13); }
.ic { flex: none; display: block; }

/* sidebar */
.dc-side { position: sticky; top: 0; align-self: start; height: 100vh; display: flex; flex-direction: column; background: var(--c-card); border-right: 1px solid var(--c-border); padding: 20px 14px 16px; overflow-y: auto; }
.dc-brand { display: flex; flex-direction: column; gap: 8px; padding: 2px 10px 18px; cursor: pointer; }
.dc-logo-svg { display: block; width: 116px; }
.dc-logo-svg svg { display: block; width: 100%; height: auto; }
.dc-product { font-family: var(--f-head); font-size: var(--fs-16); color: var(--c-muted); letter-spacing: .01em; }
.dc-nav { display: flex; flex-direction: column; gap: 1px; }
.dc-nav-group { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-12); letter-spacing: .08em; text-transform: uppercase; color: var(--c-subtle); padding: var(--sp-16) var(--sp-12) var(--sp-4); }
.dc-nav-item { display: flex; align-items: center; gap: 12px; height: 36px; padding: 0 var(--sp-12); border-radius: 8px; color: var(--c-muted); font-family: var(--f-head); font-weight: 500; font-size: var(--fs-14); }
.dc-nav-item:hover { background: var(--c-hover); color: var(--c-ink); }
.dc-nav-item.is-active { background: var(--c-primary-soft); color: var(--c-primary-ink); }
.dc-nav-item.is-active .ic { color: var(--c-primary); }
.dc-side-foot { margin-top: auto; padding: 18px 10px 0; font-size: var(--fs-12); color: var(--c-subtle); display: grid; gap: 4px; }
.dc-side-foot .mono { font-size: var(--fs-12); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* top bar */
.dc-body { min-width: 0; display: flex; flex-direction: column; }
.dc-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 12px; padding: 12px 32px; background: color-mix(in srgb, var(--c-canvas) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--c-border); }
.dc-back { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-muted); }
.dc-back:hover { color: var(--c-ink); border-color: var(--c-border-strong); }
.dc-back-sp { width: 34px; }
.dc-top-search { position: relative; flex: 1; max-width: 680px; min-height: 38px; }
.sbox { position: relative; display: flex; align-items: center; gap: 12px; height: 38px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-subtle); }
.sbox:focus-within { border-color: var(--c-primary); box-shadow: 0 0 0 3px var(--c-primary-soft); }
.sbox input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: var(--fs-14); color: var(--c-ink); }
.sbox input::-webkit-search-cancel-button { display: none; }
.sbox.is-hero { margin-top: 22px; height: 54px; max-width: 720px; padding: 0 16px; border-radius: 14px; box-shadow: 0 10px 30px -22px rgba(24, 27, 37, .4); }
.sbox.is-hero input { font-size: var(--fs-16); }
.sbox.is-hero .dc-sug { top: 58px; }
kbd { font-family: var(--f-mono); font-size: var(--fs-12); color: var(--c-subtle); border: 1px solid var(--c-border); border-bottom-width: 2px; border-radius: 5px; padding: 0 6px; background: var(--c-card); }
.dc-top-meta { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.dc-src { font-size: var(--fs-12); color: var(--c-subtle); white-space: nowrap; }
.dc-side-foot .dc-src { font-size: var(--fs-12); white-space: normal; }
.dc-pill { font-size: var(--fs-12); color: var(--c-muted); border: 1px solid var(--c-border); border-radius: 999px; padding: 4px 10px; background: var(--c-card); white-space: nowrap; }
.dc-pill.is-ok::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--c-primary); margin-right: 7px; vertical-align: 1px; }
.dc-sug { position: absolute; left: -1px; right: -1px; top: 42px; background: var(--c-card); border: 1px solid var(--c-border); border-radius: 10px; box-shadow: 0 18px 40px -18px rgba(24, 27, 37, .35); padding: 6px; z-index: 40; }
.dc-sug.is-inline { top: 40px; }
.dc-sug-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 10px; border-radius: 7px; color: var(--c-ink); }
.dc-sug-row:hover, .dc-sug-row.is-on { background: var(--c-hover); }
.dc-sug-t { font-size: var(--fs-14); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.dc-sug-s { font-size: var(--fs-12); color: var(--c-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.dc-sug-all { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px 6px; margin-top: 4px; border-top: 1px solid var(--c-border); color: var(--c-primary); font-size: var(--fs-13); }

.dc-main { padding: var(--sp-24) var(--sp-32) var(--sp-48); max-width: 1320px; width: 100%; display: flex; flex-direction: column; gap: var(--sp-24); }
.dc-foot { margin-top: 12px; font-size: var(--fs-12); color: var(--c-subtle); }
.dc-loading { grid-column: 1 / -1; display: grid; place-items: center; align-content: center; gap: 12px; min-height: 60vh; color: var(--c-muted); }
.dc-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--c-primary-soft); border-top-color: var(--c-primary); animation: dcspin .8s linear infinite; }
@keyframes dcspin { to { transform: rotate(360deg); } }
.dc-err-title { color: var(--c-ink); font-size: var(--fs-16); }

/* type */
.eyebrow { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-12); letter-spacing: .1em; text-transform: uppercase; color: var(--c-primary); margin-bottom: var(--sp-8); }
.ph { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.ph h1, .ah h1 { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-32); line-height: 1.15; letter-spacing: -.01em; }
.ah h1.is-mono { font-family: var(--f-mono); font-weight: 400; font-size: var(--fs-24); letter-spacing: -.01em; word-break: break-word; }
.ph-desc { margin-top: var(--sp-8); color: var(--c-muted); font-size: var(--fs-16); max-width: 76ch; }
.ph-r { display: flex; gap: 8px; }
h2 { font-size: var(--fs-16); color: var(--c-ink); font-weight: 600; }

/* cards */
.card { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: var(--sp-16) var(--sp-24); min-width: 0; }
.card.is-flush { padding: 0; overflow: hidden; }
.card-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: var(--sp-12); min-height: 24px; }
.card-h.pad { padding: var(--sp-16) var(--sp-24) var(--sp-4); }
.card-h h2 { font-size: var(--fs-16); font-weight: 600; }
.lnk-btn { display: inline-flex; align-items: center; gap: 8px; color: var(--c-primary); font-size: var(--fs-13); white-space: nowrap; }
.lnk-btn:hover { color: var(--c-primary-ink); }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr)); gap: 16px; }
.used { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.grid-2-1 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 16px; }
.grid-1-2 { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 2.2fr); gap: 16px; }
.empty { padding: 28px 20px; text-align: center; color: var(--c-muted); font-size: var(--fs-14); }
.skel { height: 120px; border-radius: 10px; background: linear-gradient(90deg, var(--c-hover), var(--c-canvas), var(--c-hover)); background-size: 200% 100%; animation: dcsk 1.2s infinite linear; }
@keyframes dcsk { to { background-position: -200% 0; } }

/* chips and badges */
.chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-12); line-height: 1; padding: 5px 9px; border-radius: 999px; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-muted); white-space: nowrap; }
.chip.is-link { cursor: pointer; color: var(--c-ink); }
.chip.is-link:hover { border-color: var(--c-primary); color: var(--c-primary-ink); }
.chip.is-tag { color: var(--c-subtle); }
.chip.is-tiny { font-size: var(--fs-12); padding: 3px 6px; margin-left: 6px; }
.kb { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 6px; font-size: var(--fs-12); white-space: nowrap; flex: none; }
.kb.is-compact { width: 22px; padding: 0; justify-content: center; }
.t-sky { background: var(--c-sky); color: var(--c-sky-ink); }
.t-stg { background: var(--c-stg); color: var(--c-stg-ink); }
.t-int { background: var(--c-int); color: var(--c-int-ink); }
.t-wh { background: var(--c-wh); color: var(--c-wh-ink); }
.t-metric { background: var(--c-metric); color: var(--c-metric-ink); }
.t-dash { background: var(--c-dash); color: var(--c-dash-ink); }
.t-know { background: var(--c-know); color: var(--c-know-ink); }
.chip.t-know, .chip.t-metric, .chip.t-dash { border-color: transparent; }
.s-good { --st: var(--c-good); --st-ink: var(--c-good-ink); --st-soft: #E3F5E8; }
.s-warn { --st: var(--c-warn); --st-ink: var(--c-warn-ink); --st-soft: #FFF1D6; }
.s-poor { --st: var(--c-poor); --st-ink: var(--c-poor-ink); --st-soft: #FDE5E3; }
.bar-track.s-good, .bar-track.s-warn, .bar-track.s-poor, .s-good .bar-track, .s-warn .bar-track, .s-poor .bar-track { background: var(--st-soft); }
.bar-track.s-good .bar-fill, .bar-track.s-warn .bar-fill, .bar-track.s-poor .bar-fill, .s-good .bar-fill, .s-warn .bar-fill, .s-poor .bar-fill { background: var(--st); }
b.s-good, b.s-warn, b.s-poor, .pct.s-good, .pct.s-warn, .pct.s-poor, .s-good > b, .s-warn > b, .s-poor > b, .hb-item .hb-v { color: var(--st-ink); }
.ring-fg.s-good, .ring-fg.s-warn, .ring-fg.s-poor { stroke: var(--st); }
.hb-item.s-good .hb-bar, .hb-item.s-warn .hb-bar, .hb-item.s-poor .hb-bar { background: var(--st-soft); }
.hb-item.s-good .hb-bar i, .hb-item.s-warn .hb-bar i, .hb-item.s-poor .hb-bar i { background: var(--st); }
.pct { font-family: var(--f-head); font-weight: 600; }
.acc-0 { --acc: var(--c-wh-ink); --acc-soft: var(--c-wh); } .acc-1 { --acc: var(--c-dash-ink); --acc-soft: var(--c-dash); } .acc-2 { --acc: var(--c-sky-ink); --acc-soft: var(--c-sky); }
.acc-3 { --acc: var(--c-peach-ink); --acc-soft: var(--c-peach); } .acc-4 { --acc: var(--c-know-ink); --acc-soft: var(--c-know); } .acc-5 { --acc: var(--c-metric-ink); --acc-soft: var(--c-metric); } .acc-6 { --acc: var(--c-lemon-ink); --acc-soft: var(--c-lemon); }
.acc-tile { width: 24px; height: 24px; border-radius: 6px; display: inline-grid; place-items: center; background: var(--acc-soft); color: var(--acc); flex: none; vertical-align: middle; margin-right: var(--sp-8); }
.prod-card[class*="acc-"], .dom-card[class*="acc-"] { border-top: 3px solid var(--acc); }
.t-mint { background: var(--c-mint); color: var(--c-mint-ink); }
.t-violet { background: var(--c-violet); color: var(--c-violet-ink); }
.t-indigo { background: var(--c-indigo); color: var(--c-indigo-ink); }
.t-peach { background: var(--c-peach); color: var(--c-peach-ink); }
.t-lemon { background: var(--c-lemon); color: var(--c-lemon-ink); }
.t-sand { background: var(--c-sand); color: var(--c-sand-ink); }
.t-grey { background: var(--c-grey); color: var(--c-grey-ink); }
.chip.t-mint, .chip.t-peach { border-color: transparent; }
.lnk { display: inline-flex; align-items: center; gap: 8px; color: var(--c-ink); max-width: 100%; }
.lnk > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lnk:hover > span:last-child { color: var(--c-primary); text-decoration: underline; text-underline-offset: 3px; }
.chips .lnk { border: 1px solid var(--c-border); border-radius: 999px; padding: 3px 10px 3px 3px; background: var(--c-card); font-size: var(--fs-13); }
.chips .lnk .kb.is-compact { width: 20px; height: 20px; border-radius: 999px; }
.chips .lnk:hover { border-color: var(--c-primary); }
.btn { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); font-size: var(--fs-13); color: var(--c-ink); }
.btn:hover { border-color: var(--c-border-strong); background: var(--c-hover); }
.btn.is-primary { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
.btn.is-primary:hover { background: var(--c-primary-ink); }
.btn.is-block { width: 100%; justify-content: center; }

/* hero */
.hero { padding: 26px 4px 6px; }
.hero-t { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-40); line-height: 1.1; letter-spacing: -.015em; }
.hero-d { margin-top: var(--sp-8); font-size: var(--fs-16); color: var(--c-muted); max-width: 72ch; }
.hero-search { margin-top: 22px; display: flex; align-items: center; gap: 12px; height: 52px; max-width: 640px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-subtle); cursor: text; font-size: var(--fs-16); box-shadow: 0 10px 30px -22px rgba(24, 27, 37, .4); }
.hero-search:hover { border-color: var(--c-primary); }
.hero-search kbd { margin-left: auto; }
.hero-try { margin-top: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: var(--fs-13); color: var(--c-muted); }

/* flow */
.flow-row { display: flex; align-items: stretch; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.flow-step { flex: 1 1 0; min-width: 116px; border-radius: 10px; padding: 14px 14px 12px; transition: transform .12s, box-shadow .12s; }
.flow-step:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -14px rgba(24, 27, 37, .45); }
.flow-n { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-24); line-height: 1.1; }
.flow-l { font-size: var(--fs-13); margin-top: 4px; }
.flow-s { font-size: var(--fs-12); opacity: .75; }
.flow-arrow { display: grid; place-items: center; color: var(--c-subtle); flex: none; }

/* domains */
.dom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 12px; }
.dom-grid.is-wide { grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 16px; }
.dom-card { display: flex; flex-direction: column; gap: 8px; padding: var(--sp-16); border-radius: 10px; background: var(--c-card); border: 1px solid var(--c-border); color: var(--c-ink) !important; transition: transform .12s, box-shadow .12s; }
.dom-card:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -14px rgba(24, 27, 37, .45); }
.dom-t { font-family: var(--f-head); font-size: var(--fs-16); }
.dom-d { font-size: var(--fs-13); color: var(--c-muted); flex: 1; }
.dom-n { display: flex; gap: 12px; font-size: var(--fs-12); color: var(--c-muted); flex-wrap: wrap; }
.dom-n b { color: var(--c-ink); font-weight: 600; }

/* ring */
.ring { position: relative; width: 112px; height: 112px; margin: 2px auto 14px; }
.ring-bg { fill: none; stroke: var(--c-primary-soft); stroke-width: 9; }
.ring-fg { fill: none; stroke: var(--c-primary); stroke-width: 9; stroke-linecap: round; }
.ring-v { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.ring-v b { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-32); line-height: 1; }
.ring-v span { font-size: var(--fs-12); color: var(--c-muted); }
.mini-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: var(--fs-13); }
.mini-list li { display: flex; justify-content: space-between; gap: 12px; color: var(--c-muted); }
.mini-list b { color: var(--c-ink); font-weight: 600; }
.score-card { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.score-card .ring { width: 150px; height: 150px; }
.score-card .ring svg { width: 150px; height: 150px; }
.score-t { font-family: var(--f-head); font-size: var(--fs-20); }

/* terms */
.term-list { display: grid; }
.term-row { display: grid; grid-template-columns: 170px 1fr; gap: 16px; padding: 10px 0; border-top: 1px solid var(--c-border); align-items: baseline; }
.term-row:first-child { border-top: 0; padding-top: 0; }
.term-t { font-size: var(--fs-14); color: var(--c-ink); }
.term-row:hover .term-t { color: var(--c-primary); }
.term-d { font-size: var(--fs-13); color: var(--c-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* stats */
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 12px; }
.stat { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: var(--sp-12) var(--sp-16); cursor: default; min-width: 0; }
.stat.is-link { cursor: pointer; }
.stat.is-link:hover { border-color: var(--c-primary); }
.stat-v { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-24); line-height: 1.1; }
.stat-l { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-13); color: var(--c-ink); margin-top: var(--sp-4); }
.stat-s { font-size: var(--fs-12); color: var(--c-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* toolbars */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.toolbar-r { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 10px; background: var(--c-card); border: 1px solid var(--c-border); }
.seg button { padding: 6px 11px; border-radius: 7px; font-size: var(--fs-13); color: var(--c-muted); display: inline-flex; align-items: center; gap: 8px; }
.seg button:hover { color: var(--c-ink); }
.seg button.is-on { background: var(--c-primary-soft); color: var(--c-primary-ink); }
.seg-n { font-size: var(--fs-12); color: var(--c-subtle); }
.seg button.is-on .seg-n { color: var(--c-primary-ink); opacity: .8; }
.sel { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-13); color: var(--c-muted); }
.sel select { font: inherit; font-size: var(--fs-13); color: var(--c-ink); height: 34px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); padding: 0 28px 0 10px; }
.fi { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); color: var(--c-subtle); min-width: 220px; }
.fi:focus-within { border-color: var(--c-primary); }
.fi input { border: 0; outline: 0; background: transparent; font: inherit; font-size: var(--fs-13); color: var(--c-ink); flex: 1; min-width: 0; }
.tog { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-13); color: var(--c-muted); cursor: pointer; }
.tog input { accent-color: var(--c-primary); }
.layer-note { font-size: var(--fs-13); color: var(--c-muted); margin-top: -6px; }
.more { align-self: center; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-card); font-size: var(--fs-13); color: var(--c-primary); }

/* tables */
.tbl { width: 100%; border-collapse: collapse; font-size: var(--fs-13); }
.tbl th { text-align: left; font-family: var(--f-head); font-weight: 500; font-size: var(--fs-12); color: var(--c-muted); padding: var(--sp-8) var(--sp-16); border-bottom: 1px solid var(--c-border); background: var(--c-canvas); white-space: nowrap; position: sticky; top: 0; }
.tbl td { padding: var(--sp-12) var(--sp-16); border-bottom: 1px solid var(--c-border); vertical-align: top; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl tr.is-link { cursor: pointer; }
.tbl tr.is-link:hover td { background: var(--c-hover); }
.tbl .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cell-t { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cell-t > span:not(.kb):not(.chip) { overflow: hidden; text-overflow: ellipsis; }
.cell-s { font-size: var(--fs-12); color: var(--c-subtle); margin-top: 2px; padding-left: 30px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
.cell-d { color: var(--c-muted); max-width: 460px; }
.cell-d.mono { word-break: break-word; }

/* results */
.results { display: grid; gap: 8px; }
.res { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: var(--sp-12) var(--sp-16); border-radius: 12px; background: var(--c-card); border: 1px solid var(--c-border); }
.res:hover { border-color: var(--c-primary); }
.res-t { font-size: var(--fs-14); display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.res-s { font-size: var(--fs-12); color: var(--c-subtle); }
.res-d { font-size: var(--fs-13); color: var(--c-muted); margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.res-d.is-empty { color: var(--c-subtle); }
.res-r { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; max-width: 280px; }

/* explore cards */
.ex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 12px; }
.ex-card { display: flex; flex-direction: column; gap: 8px; padding: var(--sp-16); border-radius: 12px; background: var(--c-card); border: 1px solid var(--c-border); }
.ex-card:hover { border-color: var(--c-primary); box-shadow: 0 8px 22px -18px rgba(24, 27, 37, .5); }
.ex-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ex-t { font-size: var(--fs-16); }
.ex-n { font-size: var(--fs-12); color: var(--c-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-d { font-size: var(--fs-13); color: var(--c-muted); flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ex-f { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--fs-12); color: var(--c-muted); padding-top: 8px; border-top: 1px solid var(--c-border); }
.ex-f b { color: var(--c-ink); font-weight: 600; }

/* asset page */
.crumbs { display: flex; align-items: center; gap: 8px; font-size: var(--fs-13); color: var(--c-muted); margin-bottom: -8px; flex-wrap: wrap; }
.crumbs .lnk { color: var(--c-muted); }
.crumb-cur { color: var(--c-ink); max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crumbs .sep { color: var(--c-border-strong); }
.ah { display: flex; justify-content: space-between; gap: 16px; }
.ah-main { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; min-width: 0; }
.ah-sub { font-size: var(--fs-13); color: var(--c-subtle); margin-top: -4px; word-break: break-all; }
.desc { font-size: var(--fs-16); color: var(--c-ink); max-width: 80ch; }
.desc.is-empty { color: var(--c-subtle); font-size: var(--fs-14); }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--c-border); overflow-x: auto; }
.tabs button { padding: 10px 12px; font-size: var(--fs-14); color: var(--c-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
.tabs button:hover { color: var(--c-ink); }
.tabs button.is-on { color: var(--c-primary-ink); border-bottom-color: var(--c-primary); }
.asset { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.asset-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.asset-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 76px; }
.side-card { padding: 16px; }
.side-h { font-size: var(--fs-12); letter-spacing: .06em; text-transform: uppercase; color: var(--c-subtle); margin: 14px 0 6px; }
.side-h:first-of-type { margin-top: 0; }
.col-links { display: grid; gap: 8px; min-width: 0; }
.col-links > * { min-width: 0; }
.lnk { min-width: 0; }
.big-n { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-24); }
.kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 14px; margin: 0; font-size: var(--fs-13); }
.kv dt { color: var(--c-muted); }
.kv dd { margin: 0; overflow-wrap: break-word; }
.kv-group { margin-bottom: 12px; }
.kv-h { margin-bottom: 6px; }
.alist { list-style: none; margin: 0; padding: 0; display: grid; }
.arow { display: grid; grid-template-columns: 22px minmax(0, 220px) minmax(0, 1fr); gap: 12px; align-items: center; width: 100%; padding: 8px 4px; border-top: 1px solid var(--c-border); }
.alist li:first-child .arow { border-top: 0; }
.arow:hover .arow-t { color: var(--c-primary); }
.arow-t { font-size: var(--fs-13); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--f-mono); font-size: var(--fs-13); }
.arow-d { font-size: var(--fs-13); color: var(--c-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fk, .brk { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: var(--fs-13); flex-wrap: wrap; color: var(--c-muted); }
.joins { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 8px 18px; font-size: var(--fs-13); }
.joins li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--c-border); }
.rel { font-family: var(--f-mono); font-size: var(--fs-12); color: var(--c-primary-ink); background: var(--c-primary-soft); border-radius: 5px; padding: 1px 6px; margin-left: auto; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 12px; }
.tile .chips { margin-top: 10px; }
.flt { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }

/* code */
.code { margin: 0; font-family: var(--f-mono); font-size: var(--fs-13); line-height: 1.6; white-space: pre-wrap; word-break: break-word; background: var(--c-code); border: 1px solid var(--c-border); border-radius: 10px; padding: 14px 16px; color: var(--c-ink); max-height: 520px; overflow: auto; }
.c-kw { color: var(--c-primary-ink); }
.c-str { color: var(--c-mint-ink); }
.c-com { color: var(--c-subtle); font-style: italic; }
.c-tbl { color: var(--c-peach-ink); }
.c-ref { font: inherit; color: var(--c-primary); background: var(--c-primary-soft); border-radius: 4px; padding: 0 3px; cursor: pointer; }
.c-ref:hover { text-decoration: underline; }

/* derivation tree */
.tree, .tree ul { list-style: none; margin: 0; padding: 0; }
.tree ul { padding-left: 26px; position: relative; }
.tree ul::before { content: ''; position: absolute; left: 11px; top: 0; bottom: 14px; border-left: 1px solid var(--c-border-strong); }
.tree ul > li { position: relative; }
.tree ul > li::before { content: ''; position: absolute; left: -15px; top: 19px; width: 13px; border-top: 1px solid var(--c-border-strong); }
.tn { display: flex; align-items: flex-start; gap: 12px; padding: 8px 10px; margin: 4px 0; border-radius: 9px; border: 1px solid var(--c-border); background: var(--c-card); }
.tn.is-root { background: var(--c-primary-soft); border-color: transparent; }
.tn.is-col { background: var(--c-canvas); }
.tn.is-chain { flex-direction: column; gap: 8px; background: var(--c-card); border-style: dashed; }
.tn.is-missing { color: var(--c-warn); }
.tn-ic { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; background: var(--c-card); border: 1px solid var(--c-border); color: var(--c-muted); flex: none; }
.tn.is-root .tn-ic { color: var(--c-primary); border-color: transparent; }
.tn-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.tn-t { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-14); }
.tn-d { font-size: var(--fs-13); color: var(--c-muted); }
.tn-sql { font-size: var(--fs-12); color: var(--c-subtle); white-space: pre-wrap; word-break: break-word; }
.tn-tog { margin-left: auto; font-size: var(--fs-12); color: var(--c-primary); white-space: nowrap; align-self: center; }
.chain { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-13); }
.chain .lnk { font-family: var(--f-mono); font-size: var(--fs-12); }
.chain-sep { color: var(--c-subtle); }

/* bars */
.bars { display: grid; gap: 4px; }
.bar-row { display: grid; grid-template-columns: minmax(240px, 1.5fr) minmax(120px, 2fr) 100px; gap: 16px; align-items: center; padding: 9px 8px; border-radius: 8px; cursor: default; }
.bar-row.is-link { cursor: pointer; }
.bar-row.is-link:hover { background: var(--c-hover); }
.bar-l { font-size: var(--fs-14); }
.bar-track { display: block; height: 8px; border-radius: 99px; background: var(--c-primary-soft); overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 99px; background: var(--c-primary); }
.bar-v { display: flex; flex-direction: column; align-items: flex-end; font-size: var(--fs-14); }

/* glossary */
.az { display: flex; gap: 12px; flex-wrap: wrap; font-family: var(--f-head); color: var(--c-subtle); font-size: var(--fs-16); }
.gl-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: 12px; }
.gl-card { display: flex; flex-direction: column; gap: 8px; }
.gl-h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gl-t { font-family: var(--f-head); font-size: var(--fs-20); margin-right: auto; }
.gl-t:hover { color: var(--c-primary); }
.gl-aka { font-size: var(--fs-13); color: var(--c-subtle); }
.gl-d { font-size: var(--fs-14); color: var(--c-muted); }

/* graphs */
.dc-graph { position: relative; height: 560px; overflow: hidden; background-color: var(--c-card); background-image: radial-gradient(var(--c-border) 1px, transparent 1px); background-size: 18px 18px; cursor: grab; touch-action: none; user-select: none; border-radius: 12px; }
.dc-graph.is-dragging { cursor: grabbing; }
.g-canvas { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.g-edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.g-edge { fill: none; stroke: var(--c-edge); stroke-width: 1.5; transition: opacity .12s, stroke .12s; }
.g-edge.is-hot { stroke: var(--c-primary); stroke-width: 2.2; }
.g-edge.is-dim { opacity: .15; }
.g-node { position: absolute; display: flex; align-items: center; gap: 9px; padding: 0 10px; border-radius: 10px; border: 1px solid rgba(24, 27, 37, .08); box-shadow: 0 1px 2px rgba(24, 27, 37, .06); transition: opacity .12s, box-shadow .12s; overflow: hidden; }
.g-node:hover { box-shadow: 0 8px 20px -12px rgba(24, 27, 37, .5); }
.g-node.is-dim { opacity: .25; }
.g-node.is-focus { outline: 2px solid var(--c-primary); outline-offset: 2px; }
.g-node.is-sel { box-shadow: 0 0 0 3px var(--c-primary-soft), 0 8px 20px -12px rgba(24, 27, 37, .5); }
.g-ic { width: 26px; height: 26px; border-radius: 7px; background: rgba(255, 255, 255, .7); display: grid; place-items: center; flex: none; }
.g-txt { display: flex; flex-direction: column; min-width: 0; }
.g-t { font-family: var(--f-mono); font-size: var(--fs-12); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-s { font-size: var(--fs-12); opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-node.is-card { flex-direction: column; align-items: stretch; gap: 0; padding: 0; background: var(--c-card); color: var(--c-ink); }
.g-node.is-card.is-focus { outline-offset: 2px; }
.erd-h { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; background: var(--c-peach); color: var(--c-peach-ink); font-size: var(--fs-13); flex: none; }
.erd-h .mono { color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.erd-h:hover .mono { text-decoration: underline; }
.erd-as { font-size: var(--fs-12); color: var(--c-subtle); padding: 4px 12px 0; }
.erd-f { list-style: none; margin: 0; padding: 6px 12px; display: grid; gap: 4px; font-size: var(--fs-12); }
.erd-f li { display: flex; align-items: center; gap: 8px; color: var(--c-muted); height: 18px; overflow: hidden; white-space: nowrap; }
.g-edge-label { position: absolute; transform: translate(-50%, -50%); font-family: var(--f-mono); font-size: var(--fs-12); padding: 2px 7px; border-radius: 999px; background: var(--c-card); border: 1px solid var(--c-border-strong); color: var(--c-muted); white-space: nowrap; }
button.g-edge-label:hover, .g-edge-label.is-on { border-color: var(--c-primary); color: var(--c-primary-ink); background: var(--c-primary-soft); }
.g-ctrl { position: absolute; right: 12px; top: 12px; display: flex; align-items: center; gap: 4px; padding: 3px; background: var(--c-card); border: 1px solid var(--c-border); border-radius: 9px; box-shadow: 0 6px 16px -12px rgba(24, 27, 37, .4); cursor: default; }
.g-ctrl button { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: var(--c-muted); }
.g-ctrl button:hover { background: var(--c-hover); color: var(--c-ink); }
.g-zoom-val { font-size: var(--fs-12); color: var(--c-muted); min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; }
.g-hint { position: absolute; left: 14px; bottom: 10px; font-size: var(--fs-12); color: var(--c-subtle); pointer-events: none; }
.g-note { position: absolute; left: 14px; top: 12px; font-size: var(--fs-12); color: var(--c-warn); background: var(--c-card); border: 1px solid var(--c-border); border-radius: 8px; padding: 4px 10px; }
.lg-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; }
.lg-wrap .dc-graph { border: 1px solid var(--c-border); height: 620px; }
.lg-panel { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; align-self: start; align-items: flex-start; }
.lg-panel h3 { font-family: var(--f-mono); font-size: var(--fs-16); word-break: break-all; }
.lg-panel .kv { width: 100%; }
.lg-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.lg-pick { position: relative; min-width: min(420px, 100%); }
.lg-pick .fi { width: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: var(--fs-12); color: var(--c-muted); }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.sw { width: 12px; height: 12px; border-radius: 4px; display: inline-block; border: 1px solid rgba(24, 27, 37, .08); }

/* live widgets inside cards */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr)); gap: 12px; }
.kpis app-kpi { --app-card-bg: var(--c-card); }
.card app-chart, .card app-grid { display: block; }
.card.is-flush app-grid { min-height: 420px; }


.tbl.is-fixed { table-layout: fixed; min-width: 760px; }
.tbl.is-fixed td { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tbl.is-fixed td.cell-d { white-space: normal; overflow-wrap: anywhere; }
.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tbl.is-fixed td .chips { white-space: normal; }
.tbl.is-fixed .cell-t > span:not(.kb):not(.chip) { white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.tbl.is-fixed .cell-s { max-width: none; }
.card.is-flush { overflow-x: auto; }
.joins li { min-width: 0; }
.joins li > .mono { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.joins li > .muted { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.rel { white-space: nowrap; flex: none; }
.lg-panel .mono { word-break: break-all; }

.toolbar-l { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.notice { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: var(--c-peach); color: var(--c-peach-ink); font-size: var(--fs-13); }
.notice b { font-weight: 600; }
.doc-cell { padding-right: 0 !important; }
.doc-dot { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--c-border-strong); margin-top: 1px; }
.doc-dot.is-on { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
.mono.is-nest { padding-left: 14px; position: relative; }
.mono.is-nest::before { content: ''; position: absolute; left: 3px; top: 0; height: 60%; width: 7px; border-left: 1px solid var(--c-border-strong); border-bottom: 1px solid var(--c-border-strong); }
.cell-s.is-nest-path { padding-left: 14px; }
tr.is-gone td { background: color-mix(in srgb, var(--c-peach) 35%, transparent); }
.cell-sub { font-size: var(--fs-12); color: var(--c-subtle); }

.alist.cols-2 { grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); column-gap: 24px; }


/* v2: search */
.sug-h { font-size: var(--fs-12); letter-spacing: .08em; text-transform: uppercase; color: var(--c-subtle); padding: 8px 10px 4px; }
.sug-note { font-size: var(--fs-13); color: var(--c-muted); padding: 6px 10px; }
.dc-sug-row.is-answer { background: var(--c-primary-soft); margin-bottom: 4px; }
.dc-sug-row.is-answer .dc-sug-t { max-width: none; flex: 1; color: var(--c-primary-ink); }
.dc-sug-row .ic { color: var(--c-subtle); }
mark { background: color-mix(in srgb, var(--c-primary) 18%, transparent); color: inherit; border-radius: 2px; padding: 0; margin: 0; }
.s-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
.f-toggle { display: none; }
.f-body { display: flex; flex-direction: column; gap: 16px; }
.facets { position: sticky; top: 76px; display: flex; flex-direction: column; gap: 16px; max-height: calc(100vh - 100px); overflow-y: auto; padding-right: 4px; }
.fg-top { display: flex; justify-content: space-between; align-items: center; font-size: var(--fs-12); letter-spacing: .08em; text-transform: uppercase; color: var(--c-subtle); }
.fg { display: flex; flex-direction: column; gap: 1px; }
.fg-h { font-size: var(--fs-13); color: var(--c-ink); margin-bottom: 4px; }
.fv { display: flex; justify-content: space-between; gap: 8px; padding: 4px 8px; border-radius: 6px; font-size: var(--fs-13); color: var(--c-muted); }
.fv:hover { background: var(--c-hover); color: var(--c-ink); }
.fv.is-on { background: var(--c-primary-soft); color: var(--c-primary-ink); }
.fv-l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-n { font-size: var(--fs-12); color: var(--c-subtle); font-variant-numeric: tabular-nums; }
.fg-tog { margin-top: 4px; font-size: var(--fs-13); }
.s-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.s-head { display: flex; flex-direction: column; gap: 8px; }
.s-title { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-24); }
.s-chips { gap: 8px; }
.chip.is-filter { background: var(--c-primary-soft); border-color: transparent; color: var(--c-primary-ink); }
.dym, .syn { font-size: var(--fs-14); color: var(--c-muted); }
.dym b { color: var(--c-ink); font-weight: 600; }
.r-group { display: flex; flex-direction: column; gap: 8px; }
.r-group-h { display: flex; align-items: baseline; gap: 12px; }
.r-group-h h2 { font-size: var(--fs-14); }
.r-group-h .lnk-btn { margin-left: auto; }
.res.is-kb { border-color: var(--c-primary); box-shadow: 0 0 0 3px var(--c-primary-soft); }
.res-d.mono { font-size: var(--fs-12); }
.s-help { margin-top: 4px; }
.tips { margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: var(--fs-14); color: var(--c-muted); }
.tips b { color: var(--c-ink); font-weight: 500; }
.answer { background: var(--c-card); border: 1px solid var(--c-border); border-left: 4px solid var(--c-primary); border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
.answer-h { display: flex; align-items: center; gap: 12px; }
.answer-h .eyebrow { margin: 0; }
.answer-t { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-20); }
.answer-d { font-size: var(--fs-14); color: var(--c-ink); max-width: 80ch; }
.answer-links { display: flex; flex-wrap: wrap; gap: 8px; }
.answer-path { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-13); color: var(--c-subtle); }
.ap-step { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 999px; background: var(--c-canvas); border: 1px solid var(--c-border); color: var(--c-ink); }
.empty { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.empty-ic { color: var(--c-subtle); display: inline-flex; }
.empty.is-big { flex-direction: column; padding: 36px 20px; background: var(--c-card); border: 1px dashed var(--c-border-strong); border-radius: 12px; }
.empty.is-big p { margin: 0; }

.answer-rules { display: grid; gap: 8px; }
.answer-rule { display: flex; gap: 8px; align-items: flex-start; font-size: var(--fs-13); color: var(--c-muted); padding: 8px 10px; border-radius: 8px; background: var(--c-canvas); }
.answer-rule b { color: var(--c-ink); font-weight: 500; }
.answer-rule .ic { margin-top: 2px; color: var(--c-primary); }

/* v2: home */
.sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.sec-h h2 { font-size: var(--fs-16); }
.tasks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 12px; }
.task { position: relative; display: flex; flex-direction: column; gap: 4px; padding: var(--sp-16); border-radius: 12px; background: var(--c-card); border: 1px solid var(--c-border); transition: border-color .12s, box-shadow .12s, transform .12s; }
.task:hover { border-color: var(--c-primary); box-shadow: 0 10px 24px -18px rgba(24, 27, 37, .5); transform: translateY(-1px); }
.task-ic { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: var(--c-primary-soft); color: var(--c-primary); margin-bottom: var(--sp-8); }
.task-t { font-family: var(--f-head); font-size: var(--fs-16); font-weight: 600; }
.task-d { font-size: var(--fs-13); color: var(--c-muted); padding-right: 20px; }
.task-go { position: absolute; right: 16px; bottom: 16px; color: var(--c-primary); }
.grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 16px; }
.rank { list-style: none; margin: 0; padding: 0; counter-reset: r; display: grid; grid-template-columns: minmax(0, 1fr); }
.rank li { min-width: 0; }
.rank li { counter-increment: r; border-top: 1px solid var(--c-border); }
.rank li:first-child { border-top: 0; }
.rank-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: var(--sp-8) 0; min-height: 36px; font-size: var(--fs-14); }
.rank-row::before { content: counter(r); width: 18px; color: var(--c-subtle); font-size: var(--fs-12); flex: none; }
.rank-t { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; overflow: hidden; }
.rank-tx { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rank-row:hover .rank-t { color: var(--c-primary); }
.rank-s { font-size: var(--fs-12); color: var(--c-subtle); white-space: nowrap; max-width: 42%; overflow: hidden; text-overflow: ellipsis; flex: none; }
.rank-row { overflow: hidden; }
.skel.is-short { height: 160px; }
.chip.is-lg { font-size: var(--fs-13); padding: 7px 12px; }
.health-sum { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; }
.hs-ring .ring { margin: 0 auto; }
.hs-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 12px; }
.hs-v { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-24); }
.hs-l { font-size: var(--fs-13); color: var(--c-muted); }

/* v2: knowledge */
.prod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 12px; }
.prod-grid.is-wide { grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr)); gap: 16px; }
.prod-card { display: flex; flex-direction: column; gap: 8px; padding: var(--sp-16); border-radius: 12px; background: var(--c-card); border: 1px solid var(--c-border); }
.prod-card:hover { border-color: var(--c-primary); box-shadow: 0 10px 24px -18px rgba(24, 27, 37, .5); }
.prod-top { display: flex; align-items: center; gap: 8px; }
.prod-t { font-family: var(--f-head); font-size: var(--fs-16); font-weight: 600; }
.prod-d { font-size: var(--fs-13); color: var(--c-muted); flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.prod-f { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--fs-12); color: var(--c-muted); }
.prod-f b { color: var(--c-ink); font-weight: 600; }
.prod-b { display: flex; align-items: center; justify-content: space-between; gap: 4px 8px; flex-wrap: wrap; font-size: var(--fs-12); padding-top: 8px; border-top: 1px solid var(--c-border); }
.chip.is-draft { background: #FFF1D6; color: var(--c-warn-ink); border-color: transparent; }
.kn-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(460px, 100%), 1fr)); gap: 12px; }
.kn-card { display: flex; flex-direction: column; gap: 12px; }
.kn-card.is-sel { border-color: var(--c-primary); box-shadow: 0 0 0 3px var(--c-primary-soft); }
.kn-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.kn-h h2 { font-family: var(--f-head); font-size: var(--fs-20); }
.kn-d { font-size: var(--fs-14); color: var(--c-ink); }
.gl-f { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; }
.plain { margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: var(--fs-14); }
.arow.is-4 { grid-template-columns: 22px minmax(0, 210px) minmax(0, 1fr) auto; }
.arow-n { font-size: var(--fs-12); color: var(--c-muted); white-space: nowrap; }
.t-warn { color: var(--c-warn); }
.kv.is-wide { grid-template-columns: 150px minmax(0, 1fr); gap: 12px 16px; font-size: var(--fs-13); }
.kv.is-wide dd { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
h3.is-plain { font-family: var(--f-head); font-size: var(--fs-20); word-break: normal; }
.kg-edge { stroke: var(--c-edge); stroke-width: 1.4; transition: opacity .12s; }
.kg-edge.is-hot { stroke: var(--c-primary); stroke-width: 2; }
.kg-edge.is-dim { opacity: .12; }
.kg-node { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 6px; padding: 0; background: none; border: 0; cursor: grab; touch-action: none; will-change: transform; white-space: nowrap; transition: opacity .12s; }
.kg-node:active { cursor: grabbing; }
.kg-dot { flex: none; width: calc(var(--r) * 2); height: calc(var(--r) * 2); border-radius: 50%; display: grid; place-items: center; background: currentColor; border: 2px solid var(--c-card); box-shadow: 0 1px 3px rgba(24, 27, 37, .25); }
.kg-dot .ic { color: var(--c-card); }
.kg-node.t-know, .kg-node.t-metric, .kg-node.t-dash, .kg-node.t-lemon, .kg-node.t-wh { background: none; }
.kg-node.t-know .kg-dot { background: var(--c-know-ink); }
.kg-node.t-metric .kg-dot { background: #D9547A; }
.kg-node.t-dash .kg-dot { background: #3E9A5C; }
.kg-node.t-lemon .kg-dot { background: #C99700; }
.kg-node.t-wh .kg-dot { background: var(--c-primary); }
.kg-node.k-rule .kg-dot { background: #8C6BD6; }
.kg-node.k-product .kg-dot { background: var(--c-primary-ink); border-radius: 30%; }
.kg-label { display: none; font-family: var(--f-head); font-weight: 500; font-size: var(--fs-12); color: var(--c-ink); background: color-mix(in srgb, var(--c-card) 88%, transparent); padding: 1px 6px; border-radius: 4px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.kg-label { pointer-events: none; }
.kg-node.k-term .kg-label, .kg-node.k-product .kg-label { display: inline-block; font-size: var(--fs-13); font-weight: 600; }
.kg-zoom .kg-label, .kg-node:hover .kg-label, .kg-node.is-nb .kg-label, .kg-node.is-sel .kg-label, .kg-node.is-center .kg-label { display: inline-block; }
.kg-node:hover, .kg-node.is-nb { z-index: 4; }
.kg-node.is-sel { z-index: 5; }
.kg-node.is-sel .kg-dot { box-shadow: 0 0 0 3px var(--c-primary), 0 2px 6px rgba(24, 27, 37, .3); }
.kg-node.is-center .kg-dot { box-shadow: 0 0 0 3px var(--c-primary-soft), 0 0 0 5px var(--c-primary); }
.kg-node.is-dim { opacity: .18; }
.kg-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-12); }
.kg-kinds { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.kg-kind { opacity: .5; }
.kg-kind.is-on { opacity: 1; }
.kg-kind .sw { margin-right: 2px; }
.kg-card .dc-graph { height: 640px; }
.kg-panel { max-height: 640px; overflow-y: auto; }
.g-note.is-info { color: var(--c-muted); }

/* v2: open in Looker */
.lk { display: flex; flex-direction: column; gap: 8px; }
.lk-h { display: flex; align-items: center; gap: 8px; font-size: var(--fs-14); }
.lk-row { display: flex; gap: 8px; }
.lk-url { flex: 1; min-width: 0; height: 34px; border: 1px solid var(--c-border); border-radius: 8px; padding: 0 8px; font-size: var(--fs-12); color: var(--c-muted); background: var(--c-canvas); }
.toast { position: absolute; right: 32px; top: 58px; background: var(--c-ink); color: #fff; font-size: var(--fs-13); padding: 8px 12px; border-radius: 8px; box-shadow: 0 10px 24px -12px rgba(24, 27, 37, .6); }


/* v3: search panel */
.sbox.is-hero { height: 60px; max-width: 760px; border-width: 1.5px; }
.sbox.is-hero input { font-size: var(--fs-16); }
.sbox.is-open { border-color: var(--c-primary); box-shadow: 0 0 0 4px var(--c-primary-soft); }
.dc-sug.is-panel { padding: 0; max-height: min(560px, 70vh); display: flex; flex-direction: column; overflow: hidden; }
.sbox.is-hero .dc-sug { top: 66px; }
.sug-scopes { display: flex; gap: var(--sp-4); padding: var(--sp-8) var(--sp-8) 0; border-bottom: 1px solid var(--c-border); }
.sug-scopes button { padding: var(--sp-8) var(--sp-12); font-family: var(--f-head); font-weight: 500; font-size: var(--fs-13); color: var(--c-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.sug-scopes button.is-on { color: var(--c-primary-ink); border-bottom-color: var(--c-primary); }
.sug-body { overflow-y: auto; padding: var(--sp-4) var(--sp-8) var(--sp-8); }
.sug-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-16); padding: var(--sp-8); }
.sug-group + .sug-group { border-top: 1px solid var(--c-border); margin-top: var(--sp-4); padding-top: var(--sp-4); }
.sug-h { display: flex; align-items: center; gap: var(--sp-8); font-family: var(--f-head); font-weight: 600; }
.sug-n { font-weight: 500; color: var(--c-subtle); letter-spacing: 0; }
.dc-sug-row { min-height: 40px; }
.sug-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.sug-main .dc-sug-t { max-width: none; font-size: var(--fs-14); }
.sug-main .dc-sug-s { font-size: var(--fs-12); }
.dc-sug-all { padding: var(--sp-12) var(--sp-16); margin: 0; border-top: 1px solid var(--c-border); background: var(--c-canvas); font-family: var(--f-head); font-weight: 500; }
.sug-keys { margin-left: auto; font-family: var(--f-body); font-weight: 400; font-size: var(--fs-12); color: var(--c-subtle); }

/* v4: product flow summary */
.pflow { display: flex; align-items: stretch; gap: var(--sp-8); padding: var(--sp-8) var(--sp-24) var(--sp-8); overflow-x: auto; }
.pflow-col { flex: 1 1 0; min-width: 150px; display: flex; flex-direction: column; gap: var(--sp-8); }
.pflow-h { display: flex; flex-direction: column; gap: 2px; padding: var(--sp-8) var(--sp-12); border-radius: 8px; }
.pflow-n { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-20); line-height: 1.1; }
.pflow-t { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-13); }
.pflow-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
.pflow-list li { min-width: 0; }
.pflow-item { display: flex; flex-direction: column; width: 100%; padding: 4px 8px; border-radius: 6px; font-size: var(--fs-13); color: var(--c-ink); }
.pflow-item:hover { background: var(--c-hover); color: var(--c-primary-ink); }
.pflow-item.is-star .pflow-l { font-family: var(--f-head); font-weight: 600; }
.pflow-l { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pflow-s { font-size: var(--fs-12); color: var(--c-muted); }
.pflow-more { font-size: var(--fs-12); color: var(--c-muted); padding: 4px 8px; }
.pflow-arrow { display: flex; align-items: flex-start; padding-top: 18px; color: var(--c-subtle); flex: none; }

/* v3: home health band */
.health-band { display: flex; align-items: center; gap: var(--sp-16); padding: var(--sp-12) var(--sp-24); border-radius: 12px; background: var(--c-card); border: 1px solid var(--c-border); flex-wrap: wrap; }
.health-band:hover { border-color: var(--c-primary); }
.hb-score { display: flex; align-items: baseline; gap: var(--sp-4); }
.hb-score b { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-24); color: var(--c-primary-ink); }
.hb-score span { font-size: var(--fs-12); color: var(--c-subtle); }
.hb-title { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-14); }
.hb-item { display: grid; grid-template-columns: 56px auto; grid-template-rows: auto auto; column-gap: var(--sp-8); align-items: center; min-width: 120px; }
.hb-bar { height: 6px; border-radius: 99px; background: var(--c-primary-soft); overflow: hidden; }
.hb-bar i { display: block; height: 100%; background: var(--c-primary); border-radius: 99px; }
.hb-v { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-14); }
.hb-l { grid-column: 1 / -1; font-size: var(--fs-12); color: var(--c-muted); }
.hb-go { margin-left: auto; display: inline-flex; align-items: center; gap: var(--sp-4); color: var(--c-primary); font-family: var(--f-head); font-weight: 500; font-size: var(--fs-13); }

/* v3: health groupings */
.hg { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--sp-16); align-items: start; }
.hg-tbl td { vertical-align: middle; }
.hg-tbl tr.is-sel td { background: var(--c-primary-soft); }
.hg-name { font-family: var(--f-head); font-weight: 500; }
.hg-score { display: flex; align-items: center; gap: var(--sp-8); }
.hg-score .bar-track { flex: 1; min-width: 40px; }
.hg-score b { font-family: var(--f-head); font-weight: 600; min-width: 24px; text-align: right; }
.hg-score.is-big b { font-size: var(--fs-24); }
.hg-gaps { position: sticky; top: 76px; max-height: calc(100vh - 100px); overflow-y: auto; }
.gap-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); }
.gap-list li { min-width: 0; }
.gap-list .lnk { font-size: var(--fs-13); }
.pad-x { padding: var(--sp-12) var(--sp-24) var(--sp-16); }


/* layout safety: long names wrap or ellipsize, flex rows can shrink and wrap */
.dc-root .mono, .res-s, .tn-t .mono, .ah-sub, .cell-d, .kv dd { overflow-wrap: anywhere; }
.res-t, .tn-t, .cell-t, .ex-top, .prod-top, .gl-h, .kn-h, .answer-h, .card-h, .ph, .ah, .crumbs, .toolbar, .toolbar-l, .toolbar-r { min-width: 0; }
.res-t > *, .res-m, .tn-main, .tn-t > *, .card-h > *, .kn-h > *, .gl-h > *, .answer-h > *, .prod-top > *, .ex-top > *, .rank-t, .lg-panel > * { min-width: 0; max-width: 100%; }
.prod-f, .ex-f, .dom-n, .gl-f, .hs-items, .answer-links, .lg-actions, .chips, .prod-b, .card-h { flex-wrap: wrap; }
.card-h > h2 { overflow-wrap: anywhere; }
.chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.cell-sub { white-space: normal; overflow-wrap: anywhere; }
.plain { grid-template-columns: minmax(0, 1fr); }
.plain li { min-width: 0; }
.plain .lnk, .col-links .lnk { max-width: 100%; }
.plain .lnk > span:last-child { white-space: normal; overflow-wrap: anywhere; }
.col-links { grid-template-columns: minmax(0, 1fr); }
.stat-v { overflow-wrap: anywhere; }
.res-tt { overflow-wrap: anywhere; min-width: 0; }
.alist { grid-template-columns: minmax(0, 1fr); }
.alist > li { min-width: 0; }
.alist.cols-2 { grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); }
.stat > * { max-width: 100%; }
.brk > *, .fk > * { min-width: 0; max-width: 100%; }
.tbl.is-fixed { min-width: 640px; }
.tbl.is-fixed th { white-space: normal; }
.card:has(> .tbl), .card:has(> table) { overflow-x: auto; }


/* ============ v4: bento design tokens ============ */
ra-data-catalog {
  --tile-r: 20px; --tile-p: 24px; --tile-p-lg: 32px; --gap: 24px; --rhythm: 48px;
  --shadow: 0 1px 2px rgba(24, 27, 37, .04), 0 8px 28px -12px rgba(24, 27, 37, .12);
  --shadow-hover: 0 2px 4px rgba(24, 27, 37, .05), 0 14px 36px -14px rgba(24, 27, 37, .2);
  --fs-body: 15px; --measure: 70ch;
}
.dc-root { font-size: var(--fs-body); }
.dc-main { gap: var(--rhythm); padding-top: var(--sp-32); }
.dc-main > * + .card, .dc-main > .bento, .dc-main > .facts { margin-top: 0; }
/* one surface style for every tile: soft shadow, no border */
.card, .stat, .task, .prod-card, .ex-card, .dom-card, .dom-tile, .res, .kn-card, .gl-card, .lg-panel, .answer, .health-band, .hg-gaps, .hero-tile, .fact, .q-card, .rule-card {
  border: 0; border-radius: var(--tile-r); box-shadow: var(--shadow); background: var(--c-card);
}
.card { padding: var(--tile-p); }
.card.is-flush { padding: 0; }
.card-h.pad { padding: var(--tile-p) var(--tile-p) var(--sp-8); }
.card-h { margin-bottom: var(--sp-16); }
.card-h h2, .sec-h h2 { font-size: var(--fs-16); font-weight: 600; display: flex; align-items: center; gap: var(--sp-8); }
.task:hover, .prod-card:hover, .ex-card:hover, .dom-tile:hover, .res:hover, .q-card:hover, .rule-card:hover, .fact.is-link:hover { box-shadow: var(--shadow-hover); transform: translateY(-1px); }
.prod-card[class*="acc-"], .dom-card[class*="acc-"] { border-top: 0; box-shadow: inset 0 3px 0 var(--acc), var(--shadow); }
.grid-2, .grid-3, .grid-2-1, .grid-1-2, .stat-row, .tasks, .prod-grid, .ex-grid, .gl-list, .kn-list, .dom-grid, .results { gap: var(--gap); }
.results { gap: var(--sp-12); }
.stat, .task, .prod-card, .ex-card { padding: var(--tile-p); }
/* 12-column bento grid */
.bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--gap); align-items: stretch; }
.bento > * { grid-column: span 12; min-width: 0; }
.bento > .c3 { grid-column: span 3; } .bento > .c4 { grid-column: span 4; } .bento > .c5 { grid-column: span 5; }
.bento > .c6 { grid-column: span 6; } .bento > .c7 { grid-column: span 7; } .bento > .c8 { grid-column: span 8; } .bento > .c12 { grid-column: span 12; }
/* type */
.ph h1 { font-size: var(--fs-32); font-weight: 600; letter-spacing: -.015em; }
.ph-desc, .hero-d, .desc, .hero-desc, .kn-d, .gl-d, .prod-d, .answer-d, .body, .dom-text { font-size: var(--fs-body); line-height: 1.55; max-width: var(--measure); }
.body { margin: 0; color: var(--c-ink); }
.eyebrow { margin-bottom: var(--sp-8); }
/* page hero tile for assets */
.hero-tile { display: flex; gap: var(--gap); padding: var(--tile-p-lg); }
.hero-main { display: flex; flex-direction: column; gap: var(--sp-12); align-items: flex-start; min-width: 0; flex: 1; }
.hero-tile h1 { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-32); line-height: 1.15; letter-spacing: -.015em; max-width: 100%; overflow-wrap: anywhere; }
.hero-tile h1.is-id { font-family: var(--f-mono); font-weight: 500; font-size: var(--fs-24); letter-spacing: -.01em; }
.hero-path { font-size: var(--fs-13); color: var(--c-subtle); max-width: 100%; overflow-wrap: anywhere; margin-top: calc(-1 * var(--sp-8)); }
.hero-desc { margin: 0; color: var(--c-ink); }
.hero-desc.is-empty { color: var(--c-subtle); }
/* key facts: big number, small label */
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: var(--gap); margin-top: calc(var(--gap) - var(--rhythm)); }
.facts.is-4 { grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); margin-top: 0; }
.fact { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--sp-16) var(--tile-p); min-width: 0; text-align: left; cursor: default; }
.fact.is-link { cursor: pointer; }
.fact-v { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-32); line-height: 1.1; color: var(--c-ink); max-width: 100%; overflow-wrap: anywhere; }
.fact.s-good .fact-v, .fact.s-warn .fact-v, .fact.s-poor .fact-v { color: var(--st-ink); }
.fact-v.is-sm { font-size: var(--fs-24); line-height: 1.33; }
.fact-l { font-family: var(--f-head); font-weight: 500; font-size: var(--fs-13); color: var(--c-muted); }
.fact-s { font-size: var(--fs-12); color: var(--c-subtle); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-v { font-size: var(--fs-32); font-weight: 600; }
/* domain chips and tiles */
.chip.is-dom, .fv-dom { display: inline-flex; align-items: center; gap: 4px; }
.chip.is-dom .ic { color: var(--c-muted); }
.dom-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-8); padding: var(--tile-p); text-align: left; min-height: 220px; transition: box-shadow .15s, transform .15s; }
.dom-ic { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--acc-soft); color: var(--acc); margin-bottom: var(--sp-8); }
.dom-name { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-20); }
.dom-text { color: var(--c-muted); font-size: var(--fs-14); flex: 1; }
.dom-nums { display: flex; gap: var(--sp-16); flex-wrap: wrap; font-size: var(--fs-13); color: var(--c-muted); }
.dom-nums b { font-family: var(--f-head); font-weight: 600; color: var(--c-ink); }
.dom-health { display: grid; grid-template-columns: minmax(60px, 140px) auto auto; align-items: center; gap: var(--sp-8); font-size: var(--fs-12); }
.dom-hv { font-family: var(--f-head); font-weight: 600; color: var(--st-ink); }
.dom-hl { color: var(--c-subtle); }
.dom-top { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-13); color: var(--c-muted); padding-top: var(--sp-8); border-top: 1px solid var(--c-border); width: 100%; }
.dom-top span { display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* search start */
.q-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--sp-12); }
.q-card { display: flex; align-items: flex-start; gap: var(--sp-12); padding: var(--sp-16); font-family: var(--f-head); font-weight: 500; font-size: var(--fs-14); text-align: left; background: var(--c-canvas); box-shadow: none; border-radius: 14px; transition: box-shadow .15s, transform .15s, background .15s; }
.q-card:hover { background: var(--c-card); }
.q-ic { width: 28px; height: 28px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--c-know); color: var(--c-know-ink); }
.type-list { display: grid; gap: var(--sp-4); }
.type-row { display: flex; align-items: center; gap: var(--sp-12); padding: var(--sp-8); border-radius: 10px; }
.type-row:hover { background: var(--c-hover); }
.type-l { flex: 1; font-family: var(--f-head); font-weight: 500; }
.type-n { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-20); }
/* rules */
.rule-group { display: flex; flex-direction: column; gap: var(--sp-16); }
.rule-card { display: flex; flex-direction: column; gap: var(--sp-12); text-align: left; transition: box-shadow .15s, transform .15s; }
.rule-card h3 { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-16); }
.rule-meta { display: flex; gap: var(--sp-8); flex-wrap: wrap; margin-top: auto; }
.cat-calculation { --acc: var(--c-wh-ink); --acc-soft: var(--c-wh); } .cat-inclusion { --acc: var(--c-dash-ink); --acc-soft: var(--c-dash); }
.cat-threshold { --acc: var(--c-peach-ink); --acc-soft: var(--c-peach); } .cat-data_entry { --acc: var(--c-sky-ink); --acc-soft: var(--c-sky); } .cat-ownership { --acc: var(--c-know-ink); --acc-soft: var(--c-know); }
.kb[class*="cat-"] { background: var(--acc-soft); color: var(--acc); }
.rule-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-8); }
.rule-row { display: flex; align-items: flex-start; gap: var(--sp-12); width: 100%; padding: var(--sp-8); border-radius: 12px; text-align: left; }
.rule-row:hover { background: var(--c-hover); }
.rule-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.rule-t { font-family: var(--f-head); font-weight: 600; font-size: var(--fs-14); }
.rule-d { font-size: var(--fs-13); color: var(--c-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.s-good-chip { background: #E3F5E8; color: var(--c-good-ink); border-color: transparent; }
.s-warn-chip { background: #FFF1D6; color: var(--c-warn-ink); border-color: transparent; }
.test-row { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; font-size: var(--fs-13); }
.test-row .ic { color: var(--c-good); }
.test-row.is-missing .ic { color: var(--c-warn); }
.impl { display: flex; flex-direction: column; gap: var(--sp-8); padding: var(--sp-12) 0; border-top: 1px solid var(--c-border); }
.impl:first-of-type { border-top: 0; padding-top: 0; }
.impl-h { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; }
.conflict { display: flex; flex-direction: column; gap: var(--sp-8); padding: var(--sp-12) 0; border-top: 1px solid var(--c-border); }
.conflict:first-child { border-top: 0; }
/* usage */
.empty-tile { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-12); padding: var(--sp-48) var(--tile-p); }
.empty-big { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; background: var(--c-canvas); color: var(--c-muted); }
.kpis app-kpi { border-radius: var(--tile-r); }
/* graph */
.kg-bar { display: flex; flex-direction: column; gap: var(--sp-12); padding: var(--sp-16) var(--tile-p); background: var(--c-card); border-radius: var(--tile-r); box-shadow: var(--shadow); }
.kg-row { display: flex; align-items: center; gap: var(--sp-12); flex-wrap: wrap; }
.kg-find { min-width: 240px; }
.kg-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--gap); align-items: start; }
.kg-side { display: flex; flex-direction: column; gap: var(--gap); }
.kg-path-in { display: flex; flex-direction: column; gap: var(--sp-8); }
.kg-path-in .fi { min-width: 0; }
.kg-steps { margin: var(--sp-12) 0 0; padding-left: 20px; display: grid; gap: var(--sp-4); font-size: var(--fs-13); }
.kg-hull { fill: var(--acc-soft); fill-opacity: .35; stroke: var(--acc); stroke-opacity: .2; stroke-width: 1; stroke-linejoin: round; }
.kg-hull-label { position: absolute; left: 0; top: 0; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; background: var(--c-card); color: var(--acc); font-family: var(--f-head); font-weight: 600; font-size: var(--fs-12); box-shadow: 0 1px 3px rgba(24, 27, 37, .12); pointer-events: none; white-space: nowrap; }
.kg-edge.is-path { stroke: var(--c-primary); stroke-width: 3; opacity: 1; }
.kg-node.is-path .kg-dot { box-shadow: 0 0 0 3px var(--c-primary); }
.kg-node.is-path .kg-label { display: inline-block; }
.kg-node.is-recent .kg-dot { outline: 2px dashed var(--c-warn); outline-offset: 3px; }
.kg-node.ov-good .kg-dot { background: var(--c-good) !important; }
.kg-node.ov-poor .kg-dot { background: var(--c-poor) !important; }
.kg-mini { position: absolute; right: 12px; bottom: 12px; padding: 6px; background: var(--c-card); border-radius: 10px; box-shadow: var(--shadow); cursor: pointer; }
.kg-mini svg { display: block; }
.kg-mini circle { fill: var(--c-subtle); }
.kg-mini circle.m-term, .kg-mini circle.m-product { fill: var(--c-know-ink); }
.kg-mini .kg-mini-view { fill: var(--c-primary); fill-opacity: .08; stroke: var(--c-primary); stroke-width: 1; }
.kg-card .dc-graph { height: 680px; border-radius: var(--tile-r); }
.kg-panel { max-height: none; }
/* tables list: let narrow cells wrap */
.tbl.is-fixed td { white-space: normal; }
.tbl.is-fixed td .cell-t > span:not(.kb):not(.chip) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }


/* v4 polish */
.ph h1, .hero-tile h1, .hero-t, .s-title, .answer-t { letter-spacing: -.01em; }
.hero-tile h1.is-id { letter-spacing: 0; }
.ph .ph-desc, .ph-main > .ph-desc { margin-top: var(--sp-12); }
.hero-t + .hero-d { margin-top: var(--sp-12); }
.col-links.is-wrap .lnk { align-items: flex-start; }
.col-links.is-wrap .lnk > span:last-child { white-space: normal; overflow: visible; text-overflow: clip; }
.col-links.is-wrap .lnk .ic { margin-top: 3px; }
.kg-node { overflow: visible; }
.kg-label { position: absolute; left: calc(var(--r) * 2 + 6px); top: 50%; transform: none; margin-top: -9px; }
.kg-label.is-hidden { visibility: hidden; }
.kg-node:hover .kg-label.is-hidden, .kg-node.is-sel .kg-label.is-hidden { visibility: visible; }
.dom-foot { display: flex; flex-direction: column; gap: var(--sp-8); width: 100%; margin-top: auto; }
.dom-top { min-height: 44px; }
.dom-text { flex: 0 1 auto; }
.bento.is-flow { align-items: start; }

/* narrow tiles */
@container (max-width: 1100px) {
  .bento > .c3, .bento > .c4 { grid-column: span 6; }
  .bento > .c5, .bento > .c7 { grid-column: span 12; }
  .kg-layout { grid-template-columns: minmax(0, 1fr); }
  .hg { grid-template-columns: minmax(0, 1fr); }
  .hg-gaps { position: static; max-height: none; }
  .sug-cols { grid-template-columns: 1fr; }
  .s-layout { grid-template-columns: minmax(0, 1fr); }
  .facets { position: static; max-height: none; }
  .f-toggle { display: inline-flex; align-self: flex-start; }
  .facets:not(.is-open) .f-body { display: none; }
  .facets.is-open .f-body { flex-direction: row; flex-wrap: wrap; gap: 16px; margin-top: 10px; }
  .asset, .lg-wrap { grid-template-columns: minmax(0, 1fr); }
  .asset-side { position: static; }
  .grid-2-1, .grid-1-2 { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 860px) {
  .dc-root { grid-template-columns: minmax(0, 1fr); }
  .dc-side { position: static; height: auto; flex-direction: row; align-items: center; gap: 12px; padding: 10px 14px; border-right: 0; border-bottom: 1px solid var(--c-border); overflow-x: auto; }
  .dc-brand { padding: 0 8px 0 0; flex-direction: row; align-items: center; }
  .dc-logo-svg { width: 86px; }
  .dc-product, .dc-side-foot, .dc-nav-group { display: none; }
  .dc-nav { flex-direction: row; }
  .dc-nav-item span { white-space: nowrap; }
  .dc-top { padding: 10px 16px; }
  .dc-main { padding: 20px 16px 40px; }
  .res { grid-template-columns: minmax(0, 1fr); }
  .res-r { justify-content: flex-start; }
  .hero-t { font-size: var(--fs-32); }
  .term-row { grid-template-columns: 1fr; gap: 4px; }
  .bar-row { grid-template-columns: 1fr; gap: 8px; }
  .bar-v { align-items: flex-start; }
  .dc-top-meta { display: none; }
  .bento > * { grid-column: span 12 !important; }
  .hero-tile { padding: var(--tile-p); }
  .health-sum { grid-template-columns: 1fr; }
}
</style>`;

if (!customElements.get(elementName)) {
  customElements.define(elementName, RaDataCatalog);
}

export default RaDataCatalog;
