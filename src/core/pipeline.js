/**
 * 聚合流水线（可断点续跑的状态机）。
 *
 * 阶段：fetch → speed → live → rank → done
 *
 * 为什么要分段：免费版 Worker 单次只有 50 个子请求 / 10ms CPU，
 * 一次调用跑不完整个整理流程。因此每个阶段都按「预算」切成多个 tick，
 * 进度写在单个 pipeline key 上（写频率节流 ≥1.5 秒，避免撞 KV「单 key 1 写/秒」）。
 */
import { classifySite } from './classify.js';
import { KEY, TMP } from './keys.js';
import { dedupeLives, isValidLiveText, isTestableLive, liveId, sortLivesBySpeed, stripLive, toOutputLive } from './lives.js';
import { dedupeById, mergeUserState, prepareManual, sortBySpeed, toOutputSite } from './merge.js';
import { buildEnvelope, buildSite, parseConfig, siteId } from './normalize.js';
import { getEnabledSources, loadConfig } from './sources.js';
import { fetchLimited, fetchText, isTestable, mapLimit, probe } from './speedtest.js';
import { del, deletePrefix, getJSON, getManyJSON, listKeys, putJSON } from './store.js';
import { isPlainObject, nowIso, randomHex } from './util.js';

const MAX_ERRORS = 200;
const CHECKPOINT_INTERVAL_MS = 1500;
const LIVE_MAX_BYTES = 65536;

export async function startRun(env, reason = 'manual') {
  const sources = await getEnabledSources(env);
  if (!sources.length) {
    return { error: '没有启用的源地址，无法开始整理。请先在后台「源地址清单」中添加或启用。' };
  }
  const runId = `${Date.now().toString(36)}-${randomHex(3)}`;
  const queue = sources.map((s) => ({
    url: s.url,
    name: String(s.name || ''),
    depth: 0,
    category: s.category === 'av' || s.category === 'tv' ? s.category : 'auto',
  }));
  await putJSON(env, TMP.queue(runId), queue);
  const stamp = nowIso();
  const state = {
    runId,
    phase: 'fetch',
    reason,
    sourceCursor: 0,
    chunkCursor: 0,
    chunkCount: 0,
    liveCursor: 0,
    baseCaptured: false,
    counts: { sources: 0, sites: 0, tested: 0, alive: 0, dead: 0, av: 0, tv: 0, live: 0 },
    errors: [],
    startedAt: stamp,
    updatedAt: stamp,
    finishedAt: null,
  };
  await putJSON(env, KEY.PIPELINE, state);
  return state;
}

async function tickFetch(env, state, ctx) {
  const cfg = ctx.cfg;
  let queue = await getJSON(env, TMP.queue(state.runId), null);
  if (!Array.isArray(queue)) queue = [];
  let chunkIndex = state.chunkCount || 0;
  let queueChanged = false;

  while (state.sourceCursor < queue.length && ctx.budgetLeft > 0 && Date.now() < ctx.deadline) {
    const item = queue[state.sourceCursor];
    ctx.budgetLeft -= 1;
    try {
      const text = await fetchText(item.url, cfg.fetchTimeoutMs);
      const parsed = parseConfig(text, item.url);
      if (parsed.kind === 'config') {
        const prepared = [];
        for (const raw of parsed.sites) {
          if (!isPlainObject(raw)) continue;
          const site = buildSite(raw, item.url);
          // 记住来源的分类标注，供测速阶段决定 _cat
          site._srcCat = item.category === 'av' || item.category === 'tv' ? item.category : 'auto';
          prepared.push(site);
          if (prepared.length >= cfg.maxSites) break;
        }
        for (let i = 0; i < prepared.length; i += cfg.chunkSize) {
          await putJSON(env, TMP.raw(state.runId, chunkIndex), prepared.slice(i, i + cfg.chunkSize));
          chunkIndex += 1;
        }
        state.counts.sites += prepared.length;
        if (!state.baseCaptured && parsed.envelope) {
          await putJSON(env, TMP.base(state.runId), {
            sourceUrl: item.url,
            envelope: buildEnvelope(parsed.envelope, item.url),
          });
          state.baseCaptured = true;
        }
      } else if (parsed.kind === 'repo') {
        for (const repo of parsed.repos) {
          if (queue.length >= cfg.maxRepos) break;
          if (queue.some((x) => x.url === repo.url)) continue;
          queue.push({
            url: repo.url,
            name: repo.name,
            depth: (item.depth || 0) + 1,
            category: item.category || 'auto',
          });
          queueChanged = true;
        }
      } else {
        state.errors.push({ url: item.url, message: parsed.reason || '无法识别' });
      }
      state.counts.sources += 1;
    } catch (e) {
      state.errors.push({ url: item.url, message: (e && e.message) || String(e) });
    }
    state.sourceCursor += 1;
    if (state.errors.length > MAX_ERRORS) state.errors = state.errors.slice(-MAX_ERRORS);
  }

  state.chunkCount = chunkIndex;
  if (queueChanged) await putJSON(env, TMP.queue(state.runId), queue);
  return state.sourceCursor >= queue.length;
}

async function tickSpeed(env, state, ctx) {
  const cfg = ctx.cfg;
  let processed = 0;

  while (state.chunkCursor < state.chunkCount && Date.now() < ctx.deadline) {
    // 剩余预算不够跑完一个分片时就停下，避免超发外部请求（免费版单次上限 50）
    if (processed > 0 && ctx.budgetLeft < cfg.chunkSize) break;
    const key = TMP.raw(state.runId, state.chunkCursor);
    const chunk = await getJSON(env, key, null);
    if (!Array.isArray(chunk)) {
      state.chunkCursor += 1;
      processed += 1;
      continue;
    }

    const flags = chunk.map(isTestable);
    for (const site of chunk) {
      const forced = site._srcCat;
      site._cat = forced === 'av' || forced === 'tv' ? forced : classifySite(site, cfg.adultKeywords);
    }

    const testables = chunk.filter((_, i) => flags[i]);
    const results = testables.length
      ? await mapLimit(testables, cfg.probeConcurrency, (s) => probe(s.api, cfg.probeTimeoutMs))
      : [];
    ctx.budgetLeft -= testables.length;
    state.counts.tested += testables.length;

    let idx = 0;
    for (let i = 0; i < chunk.length; i += 1) {
      const site = chunk[i];
      if (!flags[i]) {
        site._ok = null;
        site._ms = null;
        continue;
      }
      const r = results[idx];
      idx += 1;
      if (r && r.ok) {
        site._ok = true;
        site._ms = r.ms;
        state.counts.alive += 1;
      } else {
        site._ok = false;
        site._ms = null;
        site._err = (r && r.error) || 'unreachable';
        state.counts.dead += 1;
      }
    }

    await putJSON(env, TMP.done(state.runId, state.chunkCursor), chunk);
    await del(env, key);
    state.chunkCursor += 1;
    processed += 1;
  }
  return state.chunkCursor >= state.chunkCount;
}

/**
 * 直播源阶段：读取后台配置的直播源清单，逐个探测有效性并记录 TTFB（毫秒）。
 * 结果写入单个 tmp key，rank 阶段再把「有效」的按速度并入 tv.json 的 lives。
 */
async function tickLive(env, state, ctx) {
  const cfg = ctx.cfg;
  const list = await getJSON(env, KEY.LIVES, []);
  const enabled = Array.isArray(list) ? list.filter((l) => isPlainObject(l) && l.enabled !== false) : [];
  if (cfg.liveEnabled === false) {
    await putJSON(env, TMP.live(state.runId), []);
    state.liveCursor = enabled.length;
    return true;
  }

  let results = await getJSON(env, TMP.live(state.runId), null);
  if (!Array.isArray(results)) results = [];
  let cursor = state.liveCursor || 0;

  while (cursor < enabled.length && ctx.budgetLeft > 0 && Date.now() < ctx.deadline) {
    const take = Math.min(enabled.length - cursor, Math.max(1, Math.min(ctx.budgetLeft, cfg.probeConcurrency * 2)));
    const batch = enabled.slice(cursor, cursor + take);
    const testables = batch.filter(isTestableLive);
    ctx.budgetLeft -= testables.length;
    const probed = testables.length
      ? await mapLimit(testables, cfg.probeConcurrency, (l) =>
          fetchLimited(l.url, cfg.liveTimeoutMs, LIVE_MAX_BYTES),
        )
      : [];

    let pi = 0;
    for (const live of batch) {
      const out = stripLive(live);
      out._latency = null;
      out._id = liveId(live);
      if (isTestableLive(live)) {
        const r = probed[pi];
        pi += 1;
        if (r && r.ok && isValidLiveText(r.text, cfg.liveMinBytes)) {
          out._ok = true;
          out._latency = r.ms;
        } else {
          out._ok = false;
          out._err = (r && r.error) || '内容无效（过短或非列表）';
        }
      } else {
        // 非 http / type 3 无法直测，保留并标注未测速
        out._ok = null;
      }
      results.push(out);
    }
    cursor += batch.length;
  }

  state.liveCursor = cursor;
  state.counts.live = results.filter((x) => x._ok !== false).length;
  await putJSON(env, TMP.live(state.runId), results);
  return cursor >= enabled.length;
}

async function tickRank(env, state, ctx) {
  const cfg = ctx.cfg;
  const keys = await listKeys(env, TMP.donePrefix(state.runId));
  const map = await getManyJSON(env, keys);
  const collected = [];
  for (const k of keys) {
    const chunk = map.get(k);
    if (Array.isArray(chunk)) {
      for (const site of chunk) collected.push(site);
    }
  }

  const [overrides, blocklist, manual, base, liveRaw] = await Promise.all([
    getJSON(env, KEY.OVERRIDES, {}),
    getJSON(env, KEY.BLOCKLIST, []),
    getJSON(env, KEY.MANUAL, { av: [], tv: [] }),
    getJSON(env, TMP.base(state.runId), null),
    getJSON(env, TMP.live(state.runId), []),
  ]);

  const alive = collected.filter((s) => s._ok !== false);
  const dead = collected.length - alive.length;
  const withUserState = mergeUserState(alive, overrides, blocklist);

  const manualSource = isPlainObject(manual) ? manual : { av: [], tv: [] };
  const manualTv = prepareManual(manualSource.tv, cfg.adultKeywords, classifySite, siteId);
  const manualAv = prepareManual(manualSource.av, cfg.adultKeywords, classifySite, siteId);
  for (const s of manualTv) s._cat = 'tv';
  for (const s of manualAv) s._cat = 'av';

  const autoTv = withUserState.filter((s) => s._cat === 'av' ? false : true);
  const autoAv = withUserState.filter((s) => s._cat === 'av');

  const tvSites = sortBySpeed(dedupeById([...autoTv, ...manualTv])).map(toOutputSite);
  const avSites = sortBySpeed(dedupeById([...autoAv, ...manualAv])).map(toOutputSite);

  const envelope = (base && base.envelope) || {};
  const stamp = nowIso();
  const common = {
    sources: state.counts.sources,
    reached: state.counts.sites,
    alive: state.counts.alive,
    dead,
  };

  // 直播源：只保留检测有效的（未测速的也保留），按测速升序；再与基础配置里的 lives 去重合并
  const testedLives = (Array.isArray(liveRaw) ? liveRaw : []).filter((l) => l && l._ok !== false);
  const envelopeLives = Array.isArray(envelope.lives) ? envelope.lives.filter(isPlainObject) : [];
  const lives = sortLivesBySpeed(dedupeLives([...testedLives, ...envelopeLives])).map(toOutputLive);

  const tvFile = {
    ...envelope,
    sites: tvSites,
    lives,
    _meta: {
      generator: 'tvbox-organizer',
      category: 'tv',
      updated: stamp,
      count: tvSites.length,
      liveCount: lives.length,
      ...common,
    },
  };
  const avFile = {
    ...envelope,
    sites: avSites,
    _meta: { generator: 'tvbox-organizer', category: 'av', updated: stamp, count: avSites.length, ...common },
  };

  await putJSON(env, KEY.TV, tvFile);
  await putJSON(env, KEY.AV, avFile);
  await putJSON(env, KEY.BASE, { sourceUrl: base ? base.sourceUrl : null, envelope, updatedAt: stamp });

  state.counts.tv = tvSites.length;
  state.counts.av = avSites.length;
  state.counts.live = lives.length;

  const startedMs = Date.parse(state.startedAt);
  await putJSON(env, KEY.LAST_RUN, {
    time: stamp,
    reason: state.reason,
    startedAt: state.startedAt,
    durationMs: Number.isFinite(startedMs) ? Date.now() - startedMs : null,
    counts: { ...state.counts, dead },
    errorCount: state.errors.length,
    errors: state.errors.slice(0, 50),
  });

  await deletePrefix(env, TMP.prefix(state.runId));
  state.finishedAt = stamp;
  return true;
}

/**
 * 推进流水线。
 * @param {object} env
 * @param {{budget?: number, deadlineMs?: number}} options
 */
export async function continueRun(env, { budget = 9000, deadlineMs = 780000 } = {}) {
  const cfg = await loadConfig(env);
  const state = await getJSON(env, KEY.PIPELINE, null);
  if (!state || state.phase === 'done') return { finished: true, state };
  if (!Array.isArray(state.errors)) state.errors = [];

  const ctx = { cfg, budgetLeft: Math.max(1, budget | 0), deadline: Date.now() + deadlineMs };
  let lastCheckpoint = 0;
  let steps = 0;

  while (state.phase !== 'done' && Date.now() < ctx.deadline && (steps === 0 || ctx.budgetLeft > 0)) {
    if (state.phase === 'fetch') {
      const done = await tickFetch(env, state, ctx);
      if (done) {
        state.phase = 'speed';
        state.chunkCursor = 0;
      }
    } else if (state.phase === 'speed') {
      const done = await tickSpeed(env, state, ctx);
      if (done) {
        state.phase = 'live';
        state.liveCursor = 0;
      }
    } else if (state.phase === 'live') {
      const done = await tickLive(env, state, ctx);
      if (done) state.phase = 'rank';
    } else if (state.phase === 'rank') {
      await tickRank(env, state, ctx);
      state.phase = 'done';
    } else {
      break;
    }
    steps += 1;
    const t = Date.now();
    if (t - lastCheckpoint >= CHECKPOINT_INTERVAL_MS) {
      state.updatedAt = nowIso();
      await putJSON(env, KEY.PIPELINE, state);
      lastCheckpoint = t;
    }
  }

  state.updatedAt = nowIso();
  await putJSON(env, KEY.PIPELINE, state);
  return { finished: state.phase === 'done', state };
}

export async function getPipelineState(env) {
  return getJSON(env, KEY.PIPELINE, null);
}

export function pipelineProgress(state) {
  if (!state) return null;
  const phase = state.phase || 'idle';
  let percent = 0;
  if (phase === 'done') percent = 100;
  else if (phase === 'fetch') percent = state.chunkCount ? 5 : 2;
  else if (phase === 'speed') {
    const total = Math.max(1, state.chunkCount || 1);
    percent = 5 + Math.round(((state.chunkCursor || 0) / total) * 80);
  } else if (phase === 'live') percent = 88;
  else if (phase === 'rank') percent = 95;
  return {
    runId: state.runId || null,
    phase,
    percent: Math.max(0, Math.min(100, percent)),
    sourceCursor: state.sourceCursor || 0,
    chunkCursor: state.chunkCursor || 0,
    chunkCount: state.chunkCount || 0,
    liveCursor: state.liveCursor || 0,
    counts: state.counts || {},
    errors: (state.errors || []).slice(0, 20),
    errorCount: (state.errors || []).length,
    startedAt: state.startedAt || null,
    updatedAt: state.updatedAt || null,
    finishedAt: state.finishedAt || null,
    running: phase !== 'done',
  };
}
