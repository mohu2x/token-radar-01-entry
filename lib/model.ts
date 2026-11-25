import { farmSteps } from './farm.ts';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The comparable threshold and adjustment parameters shown in the dashboard. */
export interface ModelConstants {
  min_category_comparables: number;
  min_grade_a_comparables: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  chain_weight: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  min_category_comparables: 5,
  min_grade_a_comparables: 8,
  growth_weight: 0.25,
  growth_floor: -30,
  growth_cap: 30,
  maturity_floor: 0.90,
  maturity_range: 0.15,
  maturity_days: 730,
  chain_weight: 0.01,
  chain_cap: 5,
};

export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

interface ComparablePool {
  median: number;
  count: number;
}

interface Comparables {
  global: ComparablePool;
  categories: Map<string, ComparablePool>;
}

interface ValueModel {
  base_multiple: number;
  multiple_source: 'category' | 'global';
  comparable_count: number;
  category_comparable_count: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  age_days: number | null;
  chain_count: number;
  chain_multiplier: number;
}

type Confidence = 'A' | 'B' | 'C';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: ValueModel;
  confidence: Confidence;
  confidence_reason: string;
  rationale: string[];
  farm_steps: string[];
}

/** The dashboard reads the board's model and plan directly. */
export interface RadarRow extends Omit<BoardRow, 'gecko_id' | 'symbol' | 'token_status'> {
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  global_comparables: ComparablePool;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

function comparablePool(ratios: number[]): ComparablePool {
  ratios.sort((a, b) => a - b);
  const count = ratios.length;
  const lower = ratios[Math.floor((count - 1) / 2)]!;
  const upper = ratios[Math.floor(count / 2)]!;
  return { median: (lower + upper) / 2, count };
}

/** All protocols with a reported market cap and positive TVL contribute one ratio. */
function snapshotComparables(protocols: SnapshotProtocol[]): Comparables {
  const all: number[] = [];
  const byCategory = new Map<string, number[]>();
  for (const protocol of protocols) {
    if (protocol.mcap_usd === null || protocol.tvl_usd <= 0) continue;
    const ratio = protocol.mcap_usd / protocol.tvl_usd;
    all.push(ratio);
    if (protocol.category === null) continue;
    const ratios = byCategory.get(protocol.category) ?? [];
    ratios.push(ratio);
    byCategory.set(protocol.category, ratios);
  }
  if (all.length === 0) throw new SnapshotError('snapshot.json has no market-cap/TVL comparables');
  return {
    global: comparablePool(all),
    categories: new Map([...byCategory].map(([category, ratios]) => [category, comparablePool(ratios)])),
  };
}

const MAX_VALUE_USD = 100_000_000_000_000;
const formatMultiple = (value: number): string => `${value.toPrecision(5)}×`;

function confidenceFor(protocol: SnapshotProtocol, value: ValueModel, model: ModelConstants): {
  confidence: Confidence;
  confidence_reason: string;
} {
  const inputs = [
    ['category', protocol.category !== null],
    ['7d TVL change', protocol.change_7d !== null],
    ['listing date', value.age_days !== null],
    ['chains', value.chain_count > 0],
  ] as const;
  const missing = inputs.filter(([, present]) => !present).map(([label]) => label);
  let confidence: Confidence = 'C';
  if (value.multiple_source === 'category' && missing.length <= 1) {
    confidence = missing.length === 0 && value.comparable_count >= model.min_grade_a_comparables ? 'A' : 'B';
  }
  const evidence = value.multiple_source === 'category'
    ? `${value.comparable_count} category comparables`
    : `${value.category_comparable_count} category ${value.category_comparable_count === 1 ? 'comparable' : 'comparables'}, ${value.comparable_count} in the global pool`;
  const completeness = missing.length === 0 ? 'All four inputs reported.' : `Missing ${missing.join(', ')}.`;
  return { confidence, confidence_reason: `${completeness} Uses ${evidence}.` };
}

/** Compute the value and keep the full precision of all applied factors. */
function scoreProtocol(protocol: SnapshotProtocol, asOf: string, comparables: Comparables, model: ModelConstants) {
  const categoryPool = protocol.category === null ? undefined : comparables.categories.get(protocol.category);
  const categoryCount = categoryPool?.count ?? 0;
  const local = categoryPool !== undefined && categoryCount >= model.min_category_comparables;
  const pool = local ? categoryPool : comparables.global;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, protocol.change_7d ?? 0));
  const growthMultiplier = 1 + growthPct / 100 * model.growth_weight;
  const age = ageDays(asOf, protocol.listed_at);
  const ageUsed = age === null ? null : Math.min(age, model.maturity_days);
  const maturityMultiplier = ageUsed === null ? 1 : model.maturity_floor + ageUsed / model.maturity_days * model.maturity_range;
  const chainCount = new Set(protocol.chains).size;
  const extraChains = Math.max(0, Math.min(chainCount, model.chain_cap) - 1);
  const chainMultiplier = 1 + extraChains * model.chain_weight;
  const estimate = protocol.tvl_usd * pool.median * growthMultiplier * maturityMultiplier * chainMultiplier;
  const value: ValueModel = {
    base_multiple: pool.median,
    multiple_source: local ? 'category' : 'global',
    comparable_count: pool.count,
    category_comparable_count: categoryCount,
    growth_pct: growthPct,
    growth_multiplier: growthMultiplier,
    maturity_multiplier: maturityMultiplier,
    age_days: age,
    chain_count: chainCount,
    chain_multiplier: chainMultiplier,
  };
  const multiple = formatMultiple(pool.median);
  const categoryPeers = `${categoryCount} category ${categoryCount === 1 ? 'peer' : 'peers'}`;
  const recordCeiling = model.maturity_floor + model.maturity_range;
  const rationale = [
    local
      ? `Comparable multiple ${multiple} is the median market-cap/TVL ratio of ${pool.count} ${protocol.category} peers.`
      : `Comparable multiple ${multiple} uses the global median of ${pool.count} peers. ${protocol.category ?? 'Unclassified'} has ${categoryPeers}, below the ${model.min_category_comparables}-peer minimum.`,
    protocol.change_7d === null
      ? 'Momentum 1× because seven-day TVL change is missing.'
      : `Momentum ${formatMultiple(growthMultiplier)} applies ${model.growth_weight * 100}% weight to ${growthPct}% seven-day TVL change${growthPct === protocol.change_7d ? '' : `, bounded from ${protocol.change_7d}%`}.`,
    age === null
      ? 'Track record 1× because the snapshot has no usable listing date.'
      : `Track record ${formatMultiple(maturityMultiplier)} uses ${ageUsed} days since listing${age === ageUsed ? '' : `, capped from ${age}`}. The factor rises from ${model.maturity_floor.toFixed(2)}× to ${recordCeiling.toFixed(2)}× over ${model.maturity_days} days.`,
    chainCount === 0
      ? 'Chain breadth 1× because the snapshot lists no chains.'
      : `Chain breadth ${formatMultiple(chainMultiplier)} counts ${chainCount} distinct listed ${chainCount === 1 ? 'chain' : 'chains'}, adding ${model.chain_weight * 100}% per chain after the first up to ${model.chain_cap} chains.`,
  ];
  return {
    age_days: age,
    implied_value_usd: Math.max(1, Math.min(MAX_VALUE_USD, Math.round(estimate))),
    model: value,
    ...confidenceFor(protocol, value, model),
    rationale,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  return rankBoard(snapshot, snapshotComparables(snapshot.protocols), model);
}

function rankBoard(snapshot: Snapshot, comparables: Comparables, model: ModelConstants): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // Watchlist entries take priority over the early-row criteria.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Keep the starter's early universe, selected by TVL before scoring.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((protocol) => ({
    ...protocol,
    ...scoreProtocol(protocol, snapshot.as_of, comparables, model),
    token_status: 'pre-token',
    farm_steps: farmSteps(protocol),
  } as const));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return scored.map((row, i) => ({ rank: i + 1, ...row }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Keep the starter's display fields and carry the board's exact model, rationale and plan. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    model: row.model,
    confidence: row.confidence,
    confidence_reason: row.confidence_reason,
    rationale: row.rationale,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comparables = snapshotComparables(snapshot.protocols);
  const board = rankBoard(snapshot, comparables, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    global_comparables: comparables.global,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4_000) return `the board has ${board.length} rows; expected 100–4,000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a protocol slug';
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranked = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < ranked.length; i++) {
    const row = ranked[i]!;
    if (row.rank !== i + 1) return `rank ${i + 1} is ${row.rank}`;
    if (i > 0 && row.implied_value_usd > ranked[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (ranked[0]!.implied_value_usd === ranked[ranked.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${ranked[0]!.implied_value_usd}`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 5) return `${r.slug} has ${steps.length} farm steps`;
    for (const step of steps) {
      const length = step.trim().length;
      if (length < 20 || length > 600) return `${r.slug} has a farm step of ${length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > MAX_VALUE_USD) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
