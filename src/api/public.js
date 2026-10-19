/**
 * 公开只读接口：订阅文件、自定义订阅、站点状态。
 * 全部无需登录，供 TVBox 与公开页使用。
 */
import { KEY } from '../core/keys.js';
import { ensureBootstrap, loadConfig } from '../core/sources.js';
import { getJSON, rawGet } from '../core/store.js';
import { asArray, nowIso, ok, rawJson } from '../core/util.js';

const FILE_CACHE = 'public, max-age=600';
const NO_CACHE = 'no-store';

function emptyFile(category) {
  return {
    sites: [],
    _meta: {
      generator: 'tvbox-organizer',
      category,
      note: '尚未生成。请进入 /admin 登录后点击「立即执行整理」。',
    },
  };
}

/** 直接返回 KV 中已生成的订阅文件内容 */
export async function serveSubscription(env, key, category) {
  const text = await rawGet(env, key);
  if (!text) {
    return rawJson(JSON.stringify(emptyFile(category), null, 2), { headers: { 'Cache-Control': NO_CACHE } });
  }
  return rawJson(text, { headers: { 'Cache-Control': FILE_CACHE } });
}

function splitKeywords(keywords) {
  return String(keywords || '')
    .split(/[,，、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 按自定义订阅定义拼装一个订阅文件 */
export async function buildCustomFile(env, def) {
  const [tvFile, avFile, base] = await Promise.all([
    def.includeTv === false ? null : getJSON(env, KEY.TV, null),
    def.includeAv === true ? getJSON(env, KEY.AV, null) : null,
    getJSON(env, KEY.BASE, null),
  ]);

  const envelope = base && base.envelope ? base.envelope : {};
  const words = splitKeywords(def.keywords);
  const seen = new Set();
  const sites = [];

  for (const file of [tvFile, avFile]) {
    if (!file || !Array.isArray(file.sites)) continue;
    for (const site of file.sites) {
      const id = site.key || `${site.name || ''}|${site.api || ''}`;
      if (seen.has(id)) continue;
      if (words.length) {
        const name = String(site.name || '').toLowerCase();
        if (!words.some((w) => name.includes(w))) continue;
      }
      seen.add(id);
      sites.push(site);
    }
  }

  sites.sort((a, b) => {
    const am = Number.isFinite(a._latency) ? a._latency : Infinity;
    const bm = Number.isFinite(b._latency) ? b._latency : Infinity;
    if (am !== bm) return am - bm;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
  });

  return {
    ...envelope,
    sites,
    _meta: {
      generator: 'tvbox-organizer',
      name: def.name,
      title: def.title || def.name,
      updated: nowIso(),
      count: sites.length,
    },
  };
}

/** 自定义命名订阅：/xxx.json；不存在返回 null 由上层给 404 */
export async function serveCustom(env, name) {
  const subs = await getJSON(env, KEY.SUBS, []);
  const def = asArray(subs).find((s) => s && s.name === name);
  if (!def) return null;
  const file = await buildCustomFile(env, def);
  return rawJson(JSON.stringify(file, null, 2), { headers: { 'Cache-Control': FILE_CACHE } });
}

/** 公开页用的轻量状态：只读 meta:lastRun 与 subs，避免拉取大文件 */
export async function publicStatus(env) {
  await ensureBootstrap(env);
  const cfg = await loadConfig(env);
  const [lastRun, subs] = await Promise.all([
    getJSON(env, KEY.LAST_RUN, null),
    getJSON(env, KEY.SUBS, []),
  ]);

  return ok({
    updatedAt: lastRun ? lastRun.time : null,
    counts: lastRun && lastRun.counts ? lastRun.counts : { sources: 0, sites: 0, alive: 0, dead: 0, tv: 0, av: 0 },
    errorCount: lastRun ? lastRun.errorCount || 0 : 0,
    durationMs: lastRun ? lastRun.durationMs ?? null : null,
    customFilesEnabled: cfg.customFilesEnabled !== false,
    subs: asArray(subs).map((s) => ({ name: s.name, title: s.title || s.name })),
  });
}
