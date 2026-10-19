/**
 * 后台接口。除 login 外全部要求有效会话，未授权返回 401。
 *
 * 所有写接口都把写入后的最新值直接放在响应体里返回：Workers KV 是最终一致的，
 * 「写完之后再读」可能读到旧值（edge cache 默认 60 秒）。
 */
import {
  clearSessionCookie,
  createSessionToken,
  isUsingDefaultPassword,
  sessionCookie,
  setPassword,
  verifyPassword,
} from '../core/auth.js';
import { KEY } from '../core/keys.js';
import { isValidLiveText, liveId } from '../core/lives.js';
import { applyManualOrder } from '../core/merge.js';
import { continueRun, getPipelineState, pipelineProgress, startRun } from '../core/pipeline.js';
import { parseConfig, siteId } from '../core/normalize.js';
import { normalizeSchedule } from '../core/schedule.js';
import { DEFAULT_CONFIG, loadConfig } from '../core/sources.js';
import { fetchLimited, fetchText, mapLimit, probe } from '../core/speedtest.js';
import { getJSON, putConfig, putJSON } from '../core/store.js';
import { asArray, clampString, fail, isPlainObject, nowIso, ok, readJsonBody, safeShallowCopy } from '../core/util.js';

const SUB_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const SUB_RESERVED = new Set(['tv', 'av', 'index', 'admin', 'api', 'assets', 'favicon', 'robots']);
const MAX_SOURCES = 500;
const MAX_MANUAL = 1000;
const MAX_SUBS = 50;
const MAX_OVERRIDES = 5000;
const MAX_LIVES = 500;

// —— 输入清洗 ——

function sanitizeSources(value) {
  const out = [];
  for (const item of asArray(value).slice(0, MAX_SOURCES)) {
    if (!isPlainObject(item)) continue;
    const url = clampString(item.url, 1000).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      url,
      name: clampString(item.name, 100).trim(),
      enabled: item.enabled !== false,
      // auto=按关键字自动判断；av/tv=整个源强制归入对应分类
      category: item.category === 'av' || item.category === 'tv' ? item.category : 'auto',
    });
  }
  return out;
}

function sanitizeSiteList(value, limit) {
  const out = [];
  for (const item of asArray(value).slice(0, limit)) {
    if (!isPlainObject(item)) continue;
    const site = safeShallowCopy(item);
    if (typeof site.api !== 'string' || !site.api.trim()) continue;
    out.push(site);
  }
  return out;
}

function sanitizeManual(value) {
  const src = isPlainObject(value) ? value : {};
  return {
    av: sanitizeSiteList(src.av, MAX_MANUAL),
    tv: sanitizeSiteList(src.tv, MAX_MANUAL),
  };
}

function sanitizeOverrides(value) {
  if (!isPlainObject(value)) return {};
  const out = {};
  let count = 0;
  for (const id of Object.keys(value)) {
    if (count >= MAX_OVERRIDES) break;
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    const patch = value[id];
    if (!isPlainObject(patch)) continue;
    out[clampString(id, 200)] = safeShallowCopy(patch);
    count += 1;
  }
  return out;
}

function sanitizeBlocklist(value) {
  return asArray(value)
    .slice(0, MAX_OVERRIDES)
    .map((v) => clampString(v, 200))
    .filter(Boolean);
}

function sanitizeLives(value) {
  const out = [];
  for (const item of asArray(value).slice(0, MAX_LIVES)) {
    if (!isPlainObject(item)) continue;
    const url = clampString(item.url, 1000).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const entry = {
      name: clampString(item.name, 100).trim(),
      url,
      type: Number.isFinite(Number(item.type)) ? Number(item.type) : 0,
      enabled: item.enabled !== false,
    };
    const epg = clampString(item.epg, 1000).trim();
    const logo = clampString(item.logo, 1000).trim();
    if (epg) entry.epg = epg;
    if (logo) entry.logo = logo;
    out.push(entry);
  }
  return out;
}

function sanitizeSubs(value) {
  const out = [];
  const seen = new Set();
  for (const item of asArray(value).slice(0, MAX_SUBS)) {
    if (!isPlainObject(item)) continue;
    const name = clampString(item.name, 32).trim();
    if (!SUB_NAME_RE.test(name)) continue;
    if (SUB_RESERVED.has(name.toLowerCase())) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      title: clampString(item.title, 100).trim() || name,
      includeTv: item.includeTv !== false,
      includeAv: item.includeAv === true,
      keywords: clampString(item.keywords, 300).trim(),
    });
  }
  return out;
}

function sanitizeConfig(value) {
  const src = isPlainObject(value) ? value : {};
  const num = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  return {
    adultKeywords: asArray(src.adultKeywords)
      .slice(0, 300)
      .map((k) => clampString(k, 60).trim())
      .filter(Boolean),
    fetchTimeoutMs: num(src.fetchTimeoutMs, DEFAULT_CONFIG.fetchTimeoutMs, 1000, 30000),
    probeTimeoutMs: num(src.probeTimeoutMs, DEFAULT_CONFIG.probeTimeoutMs, 1000, 30000),
    probeConcurrency: num(src.probeConcurrency, DEFAULT_CONFIG.probeConcurrency, 1, 5),
    chunkSize: num(src.chunkSize, DEFAULT_CONFIG.chunkSize, 5, 100),
    maxSites: num(src.maxSites, DEFAULT_CONFIG.maxSites, 10, 5000),
    maxRepos: num(src.maxRepos, DEFAULT_CONFIG.maxRepos, 1, 500),
    tickSubrequestBudget: num(src.tickSubrequestBudget, DEFAULT_CONFIG.tickSubrequestBudget, 10, 10000),
    heartbeatSubrequestBudget: num(src.heartbeatSubrequestBudget, DEFAULT_CONFIG.heartbeatSubrequestBudget, 10, 1000),
    tickTimeBudgetMs: num(src.tickTimeBudgetMs, DEFAULT_CONFIG.tickTimeBudgetMs, 5000, 870000),
    liveEnabled: src.liveEnabled !== false,
    liveTimeoutMs: num(src.liveTimeoutMs, DEFAULT_CONFIG.liveTimeoutMs, 1000, 30000),
    liveMinBytes: num(src.liveMinBytes, DEFAULT_CONFIG.liveMinBytes, 1, 100000),
    heartbeatEnabled: src.heartbeatEnabled !== false,
    customFilesEnabled: src.customFilesEnabled !== false,
    autoUpdate: normalizeSchedule(isPlainObject(src.autoUpdate) ? src.autoUpdate : DEFAULT_CONFIG.autoUpdate),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// —— 会话 ——

async function statePayload(env) {
  const [lastRun, config, sources, manual, overrides, blocklist, subs, lives, pipelineState, usingDefault] = await Promise.all([
    getJSON(env, KEY.LAST_RUN, null),
    loadConfig(env),
    getJSON(env, KEY.SOURCES, []),
    getJSON(env, KEY.MANUAL, { av: [], tv: [] }),
    getJSON(env, KEY.OVERRIDES, {}),
    getJSON(env, KEY.BLOCKLIST, []),
    getJSON(env, KEY.SUBS, []),
    getJSON(env, KEY.LIVES, []),
    getPipelineState(env),
    isUsingDefaultPassword(env),
  ]);
  return {
    authed: true,
    usingDefaultPassword: usingDefault,
    lastRun,
    pipeline: pipelineProgress(pipelineState),
    config,
    sources: asArray(sources),
    manual: isPlainObject(manual) ? { av: asArray(manual.av), tv: asArray(manual.tv) } : { av: [], tv: [] },
    overrides: isPlainObject(overrides) ? overrides : {},
    blocklist: asArray(blocklist),
    subs: asArray(subs),
    lives: sanitizeLives(lives),
  };
}

const EXPORTABLE = {
  tv: KEY.TV,
  av: KEY.AV,
  manual: KEY.MANUAL,
  sources: KEY.SOURCES,
  overrides: KEY.OVERRIDES,
  blocklist: KEY.BLOCKLIST,
  config: KEY.CONFIG,
  subs: KEY.SUBS,
  lives: KEY.LIVES,
};

const IMPORTABLE = {
  manual: { key: KEY.MANUAL, clean: sanitizeManual },
  sources: { key: KEY.SOURCES, clean: sanitizeSources },
  overrides: { key: KEY.OVERRIDES, clean: sanitizeOverrides },
  blocklist: { key: KEY.BLOCKLIST, clean: sanitizeBlocklist },
  subs: { key: KEY.SUBS, clean: sanitizeSubs },
  lives: { key: KEY.LIVES, clean: sanitizeLives },
};

/**
 * @param {Request} request
 * @param {object} env
 * @param {string[]} segments /api/admin/ 之后的路径片段
 */
export async function handleAdminApi(request, env, segments, isAuthed) {
  const method = request.method.toUpperCase();
  const path = segments.join('/');

  // —— 无需登录 ——
  if (path === 'login' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 4096);
    } catch {
      return fail('请求体格式不正确');
    }
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) return fail('请输入密码', 400);
    const passed = await verifyPassword(env, password);
    if (!passed) {
      await sleep(400);
      return fail('密码错误', 401);
    }
    const token = await createSessionToken(env);
    const secure = new URL(request.url).protocol === 'https:';
    return ok(
      { authed: true },
      { headers: { 'Set-Cookie': sessionCookie(token, { secure }) } },
    );
  }

  if (!isAuthed) return fail('未授权，请先登录', 401);

  if (path === 'logout' && method === 'POST') {
    const secure = new URL(request.url).protocol === 'https:';
    return ok({ authed: false }, { headers: { 'Set-Cookie': clearSessionCookie({ secure }) } });
  }

  if (path === 'state' && method === 'GET') {
    return ok(await statePayload(env));
  }

  // —— 流水线 ——
  if (path === 'pipeline/start' && method === 'POST') {
    const cfg = await loadConfig(env);
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';
    const current = await getPipelineState(env);
    if (current && current.phase && current.phase !== 'done' && !force) {
      return ok({
        started: false,
        message: '已有一轮整理正在进行中。若要重新开始，请带上 force=1。',
        pipeline: pipelineProgress(current),
      });
    }
    const started = await startRun(env, force ? 'manual-force' : 'manual');
    if (started && started.error) return fail(started.error, 400);
    const result = await continueRun(env, {
      budget: Math.min(cfg.tickSubrequestBudget, 400),
      deadlineMs: 22000,
    });
    return ok({ started: true, finished: result.finished, pipeline: pipelineProgress(result.state) });
  }

  if (path === 'pipeline/step' && method === 'POST') {
    const cfg = await loadConfig(env);
    const current = await getPipelineState(env);
    if (!current) return fail('当前没有进行中的整理任务', 400);
    if (current.phase === 'done') return ok({ finished: true, pipeline: pipelineProgress(current) });
    const result = await continueRun(env, {
      budget: Math.min(cfg.tickSubrequestBudget, 400),
      deadlineMs: 22000,
    });
    return ok({ finished: result.finished, pipeline: pipelineProgress(result.state) });
  }

  // —— 单个 / 批量测速（source=源配置地址 site=站点接口 live=直播源） ——
  // 单次最多 20 个地址、并发 5，控制在免费版 50 子请求限额内
  if (path === 'test' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 256 * 1024);
    } catch {
      return fail('请求体格式不正确');
    }
    const kind = body.kind === 'live' || body.kind === 'source' ? body.kind : 'site';
    const urls = asArray(body.urls)
      .map((u) => clampString(u, 1000).trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 20);
    if (!urls.length) return fail('请提供要测试的地址');
    const cfg = await loadConfig(env);

    if (kind === 'source') {
      // 源配置地址：下载 + 解密 + 解析，报告可提取的站点/仓库数量
      const results = await mapLimit(urls, 5, async (u) => {
        const t0 = Date.now();
        try {
          const text = await fetchText(u, cfg.fetchTimeoutMs);
          const parsed = parseConfig(text, u);
          if (parsed.kind === 'config') return { url: u, ok: true, ms: Date.now() - t0, sites: parsed.sites.length };
          if (parsed.kind === 'repo') return { url: u, ok: true, ms: Date.now() - t0, repos: parsed.repos.length };
          return { url: u, ok: false, ms: Date.now() - t0, error: parsed.reason || '无法识别内容' };
        } catch (e) {
          return { url: u, ok: false, ms: Date.now() - t0, error: (e && e.message) || String(e) };
        }
      });
      return ok({ kind, results });
    }

    if (kind === 'live') {
      // 直播源：下载限长正文，判定有效性（过短 / HTML 错误页视为无效）
      const results = await mapLimit(urls, 5, async (u) => {
        const r = await fetchLimited(u, cfg.liveTimeoutMs, 65536);
        const valid = r.ok && isValidLiveText(r.text, cfg.liveMinBytes);
        return {
          url: u,
          ok: !!r.ok,
          valid,
          ms: r.ms,
          status: r.status,
          error: !r.ok ? (r.error || 'unreachable') : valid ? undefined : '内容无效（过短或非列表）',
        };
      });
      return ok({ kind, results });
    }

    // 站点接口：测 TTFB（拿到响应头即算连通）
    const results = await mapLimit(urls, 5, async (u) => {
      const r = await probe(u, cfg.probeTimeoutMs);
      return { url: u, ok: !!r.ok, ms: r.ms, status: r.status, error: r.ok ? undefined : (r.error || 'unreachable') };
    });
    return ok({ kind, results });
  }

  // —— 手动排序（tv / av 站点、lives 直播源）：保存到 KV 并立即重写当前订阅文件 ——
  if (path === 'order' && method === 'GET') {
    const order = await getJSON(env, KEY.ORDER, {});
    return ok(isPlainObject(order) ? order : {});
  }
  if (path === 'order' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 1024 * 1024);
    } catch {
      return fail('请求体格式不正确');
    }
    const kind = body.kind;
    if (kind !== 'tv' && kind !== 'av' && kind !== 'lives') return fail('不支持的排序类型', 400);
    // ids 为空 = 重置为默认（按测速）排序
    const ids = asArray(body.ids).map((v) => clampString(v, 300)).filter(Boolean);
    if (ids.length > 5000) return fail('排序条目过多');
    const nextMap = {};
    ids.forEach((id, i) => { nextMap[id] = i; });

    const cur = await getJSON(env, KEY.ORDER, {});
    const order = isPlainObject(cur) ? cur : {};

    if (kind === 'lives') {
      order.lives = nextMap;
      await putJSON(env, KEY.ORDER, order);
      const file = await getJSON(env, KEY.TV, null);
      if (isPlainObject(file) && Array.isArray(file.lives)) {
        file.lives = applyManualOrder(file.lives, nextMap, (l) => (l && l._id) || liveId(l));
        if (isPlainObject(file._meta)) file._meta.updated = nowIso();
        await putConfig(env, KEY.TV, file);
      }
      return ok({ order });
    }

    if (!isPlainObject(order.sites)) order.sites = {};
    order.sites[kind] = nextMap;
    await putJSON(env, KEY.ORDER, order);
    const outKey = kind === 'tv' ? KEY.TV : KEY.AV;
    const file = await getJSON(env, outKey, null);
    if (isPlainObject(file) && Array.isArray(file.sites)) {
      file.sites = applyManualOrder(file.sites, nextMap);
      if (isPlainObject(file._meta)) file._meta.updated = nowIso();
      await putConfig(env, outKey, file);
    }
    return ok({ order });
  }

  // —— 源地址清单 ——
  if (path === 'sources') {
    if (method === 'GET') return ok(sanitizeSources(await getJSON(env, KEY.SOURCES, [])));
    if (method === 'POST') {
      let body;
      try {
        body = await readJsonBody(request, 512 * 1024);
      } catch {
        return fail('请求体格式不正确');
      }
      const list = sanitizeSources(isPlainObject(body) && 'sources' in body ? body.sources : body);
      await putJSON(env, KEY.SOURCES, list);
      return ok({ sources: list });
    }
  }

  // —— 手动源（整份读写，流水线永不覆盖） ——
  if (path === 'manual') {
    if (method === 'GET') {
      const manual = await getJSON(env, KEY.MANUAL, { av: [], tv: [] });
      return ok(isPlainObject(manual) ? manual : { av: [], tv: [] });
    }
    if (method === 'POST') {
      let body;
      try {
        body = await readJsonBody(request, 4 * 1024 * 1024);
      } catch {
        return fail('请求体格式不正确或过大');
      }
      const manual = sanitizeManual(body);
      await putJSON(env, KEY.MANUAL, manual);
      return ok({ manual });
    }
  }

  // —— 自动源的编辑与删除 ——
  if (path === 'overrides' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 4 * 1024 * 1024);
    } catch {
      return fail('请求体格式不正确或过大');
    }
    const overrides = sanitizeOverrides(isPlainObject(body) && 'overrides' in body ? body.overrides : body);
    await putJSON(env, KEY.OVERRIDES, overrides);
    return ok({ overrides });
  }

  if (path === 'blocklist' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 1024 * 1024);
    } catch {
      return fail('请求体格式不正确');
    }
    const blocklist = sanitizeBlocklist(isPlainObject(body) && 'blocklist' in body ? body.blocklist : body);
    await putJSON(env, KEY.BLOCKLIST, blocklist);
    return ok({ blocklist });
  }

  // —— 彻底删除：立即从当前 tv.json / av.json 移除该源，同时确保 blocklist 拦截后续整理重新加入 ——
  if (path === 'purge' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 64 * 1024);
    } catch {
      return fail('请求体格式不正确');
    }
    const id = clampString(isPlainObject(body) ? body.id : '', 200).trim();
    if (!id) return fail('缺少源 ID');

    const blocklist = sanitizeBlocklist(await getJSON(env, KEY.BLOCKLIST, []));
    if (!blocklist.includes(id)) blocklist.push(id);
    await putJSON(env, KEY.BLOCKLIST, blocklist);

    const overrides = await getJSON(env, KEY.OVERRIDES, {});
    if (isPlainObject(overrides) && overrides[id]) {
      delete overrides[id];
      await putJSON(env, KEY.OVERRIDES, overrides);
    }

    let removed = 0;
    for (const outKey of [KEY.TV, KEY.AV]) {
      const file = await getJSON(env, outKey, null);
      if (!isPlainObject(file) || !Array.isArray(file.sites)) continue;
      const next = file.sites.filter((s) => {
        const sid = isPlainObject(s) ? String(s._id || siteId(s) || '') : '';
        return sid !== id;
      });
      if (next.length !== file.sites.length) {
        removed += file.sites.length - next.length;
        file.sites = next;
        if (isPlainObject(file._meta)) file._meta.updated = nowIso();
        await putConfig(env, outKey, file);
      }
    }
    return ok({ blocklist, overrides, removed });
  }

  // —— 配置 ——
  if (path === 'config') {
    if (method === 'GET') {
      const cfg = await loadConfig(env);
      return ok({ config: cfg, defaults: DEFAULT_CONFIG });
    }
    if (method === 'POST') {
      let body;
      try {
        body = await readJsonBody(request, 256 * 1024);
      } catch {
        return fail('请求体格式不正确');
      }
      const config = sanitizeConfig(isPlainObject(body) && 'config' in body ? body.config : body);
      await putJSON(env, KEY.CONFIG, config);
      return ok({ config });
    }
  }

  // —— 直播源清单（自动检测有效后按速度并入 tv.json 的 lives） ——
  if (path === 'lives') {
    if (method === 'GET') return ok({ lives: sanitizeLives(await getJSON(env, KEY.LIVES, [])) });
    if (method === 'POST') {
      let body;
      try {
        body = await readJsonBody(request, 2 * 1024 * 1024);
      } catch {
        return fail('请求体格式不正确或过大');
      }
      const lives = sanitizeLives(isPlainObject(body) && 'lives' in body ? body.lives : body);
      await putJSON(env, KEY.LIVES, lives);
      return ok({ lives });
    }
  }

  // —— 自定义命名订阅文件 ——
  if (path === 'subs') {
    if (method === 'GET') return ok({ subs: sanitizeSubs(await getJSON(env, KEY.SUBS, [])) });
    if (method === 'POST') {
      let body;
      try {
        body = await readJsonBody(request, 256 * 1024);
      } catch {
        return fail('请求体格式不正确');
      }
      const subs = sanitizeSubs(isPlainObject(body) && 'subs' in body ? body.subs : body);
      await putJSON(env, KEY.SUBS, subs);
      return ok({ subs });
    }
  }

  // —— 导入导出 ——
  if (path === 'export' && method === 'GET') {
    const type = new URL(request.url).searchParams.get('type') || 'manual';
    const key = EXPORTABLE[type];
    if (!key) return fail(`不支持导出类型：${type}`, 400);
    const data = await getJSON(env, key, null);
    // 写接口总是回传最新值，导出同理，避免 KV 最终一致导致读到旧数据
    return ok({ type, data });
  }

  if (path === 'import' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 4 * 1024 * 1024);
    } catch {
      return fail('请求体格式不正确或过大');
    }
    const type = isPlainObject(body) ? String(body.type || '') : '';
    const target = IMPORTABLE[type];
    if (!target) {
      return fail('仅支持导入 manual / sources / lives / overrides / blocklist / subs', 400);
    }
    const cleaned = target.clean(body.data);
    await putJSON(env, target.key, cleaned);
    return ok({ type, data: cleaned });
  }

  // —— 修改密码 ——
  if (path === 'password' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(request, 4096);
    } catch {
      return fail('请求体格式不正确');
    }
    const current = typeof body.current === 'string' ? body.current : '';
    const next = typeof body.next === 'string' ? body.next : '';
    if (next.length < 6) return fail('新密码至少 6 位', 400);
    if (!(await verifyPassword(env, current))) {
      await sleep(400);
      return fail('当前密码错误', 401);
    }
    await setPassword(env, next);
    const token = await createSessionToken(env);
    const secure = new URL(request.url).protocol === 'https:';
    return ok({ changed: true }, { headers: { 'Set-Cookie': sessionCookie(token, { secure }) } });
  }

  return fail(`接口不存在：/api/admin/${path}`, 404);
}
