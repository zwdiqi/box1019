/**
 * TVBox 配置解析与归一化。
 *
 * 关键点：公开源配置里大量使用相对路径（./lib/drpy2.min.js、./jar/pg.jar 等），
 * 它们相对于「该配置自身的 URL」。多个配置合并成一个订阅后必须先把这些相对路径
 * 解析成绝对 URL，否则合并出来的 type:3 爬虫源会全部失效。
 */
import { asArray, isPlainObject, stableHash } from './util.js';

const RELATIVE_RE = /^\.{1,2}\//;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

/** 把单个路径解析为绝对 URL；非路径（csp_ / js: / py: / 已是绝对）原样返回 */
export function absolutizeOne(value, baseUrl) {
  if (typeof value !== 'string' || !value) return value;
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (value.startsWith('csp_') || value.startsWith('js:') || value.startsWith('py:')) return value;
  if (!RELATIVE_RE.test(value) && !value.startsWith('/')) return value;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

/** ext 可能是 "路径$$$参数1$$$参数2" 形式，只解析第一段 */
export function absolutizeValue(value, baseUrl) {
  if (typeof value !== 'string' || !value) return value;
  const parts = value.split('$$$');
  parts[0] = absolutizeOne(parts[0], baseUrl);
  return parts.join('$$$');
}

/** spider 可能是 "路径;md5;校验值" 形式，只解析路径段 */
export function absolutizeSpider(spider, baseUrl) {
  if (typeof spider !== 'string' || !spider) return spider;
  const [path, ...rest] = spider.split(';');
  return [absolutizeOne(path, baseUrl), ...rest].join(';');
}

/**
 * 解析一份源文件内容。
 * 返回 { kind: 'config', sites, envelope } | { kind: 'repo', repos } | { kind: 'invalid', reason }
 */
export function parseConfig(text, baseUrl) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'JSON 解析失败' };
  }

  if (Array.isArray(obj)) {
    const repos = obj.filter(isPlainObject).filter((x) => typeof x.url === 'string' && x.url);
    if (repos.length) {
      return { kind: 'repo', repos: repos.map((r) => ({ name: String(r.name || ''), url: absolutizeOne(r.url, baseUrl) })) };
    }
    return { kind: 'invalid', reason: '顶层是数组但没有 url 字段（不是多仓格式）' };
  }

  if (!isPlainObject(obj)) return { kind: 'invalid', reason: '顶层不是对象或数组' };

  if (Array.isArray(obj.sites)) return { kind: 'config', sites: obj.sites, envelope: obj };

  const repoList = asArray(obj.urls).filter(isPlainObject).filter((x) => typeof x.url === 'string' && x.url);
  if (repoList.length) {
    return { kind: 'repo', repos: repoList.map((r) => ({ name: String(r.name || ''), url: absolutizeOne(r.url, baseUrl) })) };
  }

  return { kind: 'invalid', reason: '既没有 sites 数组，也不是多仓格式' };
}

/** 站点唯一标识：优先用 key，并混入 api 哈希以区分不同配置里的同名 key */
export function siteId(site) {
  const api = typeof site.api === 'string' ? site.api : '';
  if (site.key) return `${site.key}#${stableHash(api)}`;
  return `h${stableHash(`${site.name || ''}|${api}|${site.type ?? ''}`)}`;
}

/** 把原始 site 对象归一化成内部站点（补 _id，解析相对路径） */
export function buildSite(raw, baseUrl) {
  const site = {};
  for (const k of Object.keys(raw)) {
    if (UNSAFE.has(k)) continue;
    site[k] = raw[k];
  }
  if (site.api !== undefined) site.api = absolutizeValue(site.api, baseUrl);
  if (site.ext !== undefined) site.ext = absolutizeValue(site.ext, baseUrl);
  if (site.jar !== undefined) site.jar = absolutizeValue(site.jar, baseUrl);
  site._id = siteId(site);
  return site;
}

const ENVELOPE_KEYS = ['spider', 'wallpaper', 'logo', 'parses', 'flags', 'ads', 'rules', 'ijk', 'doh'];

/** 提取 TVBox 信封（spider / lives / parses …），并解析其中的相对路径；不含 sites */
export function buildEnvelope(envelope, baseUrl) {
  const out = {};
  for (const k of ENVELOPE_KEYS) {
    if (envelope[k] === undefined) continue;
    out[k] = envelope[k];
  }
  if (typeof out.spider === 'string') out.spider = absolutizeSpider(out.spider, baseUrl);
  if (typeof out.wallpaper === 'string') out.wallpaper = absolutizeValue(out.wallpaper, baseUrl);
  if (Array.isArray(out.lives)) {
    out.lives = out.lives.filter(isPlainObject).map((l) => {
      const next = { ...l };
      if (next.url !== undefined) next.url = absolutizeValue(next.url, baseUrl);
      if (next.logo !== undefined) next.logo = absolutizeValue(next.logo, baseUrl);
      return next;
    });
  }
  if (Array.isArray(out.parses)) {
    out.parses = out.parses.filter(isPlainObject).map((p) => {
      const next = { ...p };
      if (next.url !== undefined) next.url = absolutizeValue(next.url, baseUrl);
      if (next.ext !== undefined) next.ext = absolutizeValue(next.ext, baseUrl);
      return next;
    });
  }
  return out;
}
