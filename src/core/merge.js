/**
 * 合并与排序：用户状态套用、去重、按速度排序、输出裁剪。
 */
import { isPlainObject } from './util.js';

const INTERNAL_FIELDS = ['_id', '_cat', '_ms', '_ok', '_err', '_edited', '_manual', '_latency'];
const EXTRA_STRIP = ['category', 'hidden', 'group'];

/** 套用用户对自动源的修改与删除（写入 overrides / blocklist） */
export function mergeUserState(sites, overrides, blocklist) {
  const blocked = new Set(Array.isArray(blocklist) ? blocklist.map(String) : []);
  const ov = isPlainObject(overrides) ? overrides : {};
  const out = [];
  for (const site of sites) {
    const id = site._id;
    if (blocked.has(id)) continue;
    const patch = isPlainObject(ov[id]) ? ov[id] : null;
    if (!patch) {
      out.push(site);
      continue;
    }
    if (patch.hidden) continue;
    const merged = { ...site };
    for (const k of Object.keys(patch)) {
      if (k === '_id' || k === 'hidden') continue;
      if (k === 'category') {
        if (patch.category === 'av' || patch.category === 'tv') merged._cat = patch.category;
        continue;
      }
      merged[k] = patch[k];
    }
    merged._edited = true;
    out.push(merged);
  }
  return out;
}

const msOf = (site) => (Number.isFinite(site._ms) ? site._ms : Infinity);

/** 去重：手动源优先于自动源；同为自动源时保留速度更快的那个 */
export function dedupeById(sites) {
  const map = new Map();
  for (const site of sites) {
    const prev = map.get(site._id);
    if (!prev) {
      map.set(site._id, site);
      continue;
    }
    const prevManual = prev._manual === true;
    const nextManual = site._manual === true;
    if (nextManual && !prevManual) {
      map.set(site._id, site);
      continue;
    }
    if (prevManual && !nextManual) continue;
    if (msOf(site) < msOf(prev)) map.set(site._id, { ...prev, ...site });
  }
  return [...map.values()];
}

/** 按 TTFB 升序；无法测速的排在最后，其次按名称排序 */
export function sortBySpeed(sites) {
  return [...sites].sort((a, b) => {
    const am = msOf(a);
    const bm = msOf(b);
    if (am !== bm) return am - bm;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
  });
}

/**
 * 裁剪成 TVBox 可用的站点对象：去掉内部字段，但保留 _latency 与 _id。
 * 保留 _id 是为了让前端能引用「自动源」的稳定标识来写 overrides / blocklist。
 * 下划线开头的额外字段 TVBox 会忽略，不影响订阅可用性。
 */
export function toOutputSite(site) {
  const out = {};
  for (const k of Object.keys(site)) {
    if (INTERNAL_FIELDS.includes(k) || EXTRA_STRIP.includes(k)) continue;
    out[k] = site[k];
  }
  out._latency = Number.isFinite(site._ms) ? site._ms : null;
  out._id = site._id;
  return out;
}

/** 把 manual 里的原始站点对象转成内部站点 */
export function prepareManual(list, keywords, classifyFn, idFn) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!isPlainObject(raw)) continue;
    const site = {};
    for (const k of Object.keys(raw)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      site[k] = raw[k];
    }
    site._id = idFn(site);
    site._cat = raw.category === 'av' || raw.category === 'tv' ? raw.category : classifyFn(site, keywords);
    site._ms = Number.isFinite(raw._latency) ? raw._latency : null;
    site._ok = null;
    site._manual = true;
    out.push(site);
  }
  return out;
}
