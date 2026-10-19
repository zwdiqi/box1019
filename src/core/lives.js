/**
 * 直播源（TVBox 配置里的 lives 数组）的校验、测速与输出。
 *
 * 直播源通常是一个 m3u / txt 播放列表地址（type 0/1）。Worker 里只能发 HTTP 请求，
 * 因此判定「正常有效」的标准是：请求成功、正文长度达到下限、且不像 HTML 错误页。
 * 测速记录的是 TTFB（毫秒），用于按速度排序。
 */
import { isPlainObject, stableHash } from './util.js';

const HTML_RE = /^\s*(<!doctype|<html|<\?xml|<head|<body)/i;

/** 直播源唯一标识：以 url 哈希为准，同名不同地址也能区分 */
export function liveId(live) {
  if (isPlainObject(live) && typeof live._id === 'string' && live._id) return live._id;
  const url = isPlainObject(live) && typeof live.url === 'string' ? live.url : '';
  return `lv_${stableHash(url)}`;
}

/** 可直测的直播源：http(s) 地址，且不是 type 3（爬虫类） */
export function isTestableLive(live) {
  if (!isPlainObject(live)) return false;
  const url = typeof live.url === 'string' ? live.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) return false;
  return Number(live.type) !== 3;
}

/** 去掉内部字段（_ok/_err 与仅用于后台的 enabled），保留 _latency / _id 供前端引用 */
export function stripLive(live) {
  const out = {};
  for (const k of Object.keys(live)) {
    if (k === '_ok' || k === '_err' || k === 'enabled') continue;
    out[k] = live[k];
  }
  return out;
}

/**
 * 判定一份直播列表正文是否有效。
 * @param {string} text
 * @param {number} minBytes 正文长度下限
 */
export function isValidLiveText(text, minBytes) {
  const body = typeof text === 'string' ? text : '';
  if (body.trim().length < Math.max(1, minBytes | 0)) return false;
  if (HTML_RE.test(body)) return false;
  return true;
}

const msOf = (live) => (Number.isFinite(live._latency) ? live._latency : Infinity);

/** 按测速结果升序；未测速的排最后 */
export function sortLivesBySpeed(lives) {
  return [...lives].sort((a, b) => {
    const am = msOf(a);
    const bm = msOf(b);
    if (am !== bm) return am - bm;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
  });
}

/** 按 id 去重；重复时优先保留已测速的那条 */
export function dedupeLives(lives) {
  const map = new Map();
  for (const live of lives) {
    if (!isPlainObject(live)) continue;
    const key = liveId(live);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, live);
      continue;
    }
    if (prev._latency == null && live._latency != null) map.set(key, live);
  }
  return [...map.values()];
}

/** 输出到 tv.json 的直播源：去掉 _ok/_err，补 _latency / _id */
export function toOutputLive(live) {
  const out = stripLive(live);
  out._latency = Number.isFinite(live._latency) ? live._latency : null;
  out._id = liveId(live);
  return out;
}
