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

/** 像一个 TVBox 站点：带非空的 api 字符串 */
function looksLikeSite(x) {
  return isPlainObject(x) && typeof x.api === 'string' && x.api.trim() !== '';
}

/** 像一个订阅链接：带非空的 url 字符串 */
function looksLikeRepo(x, onlyJson) {
  if (!isPlainObject(x) || typeof x.url !== 'string' || !x.url.trim()) return false;
  if (looksLikeSite(x)) return false;
  if (!onlyJson) return true;
  return /\.(json|txt)$/i.test(x.url.trim());
}

/**
 * 把「接口清单」条目补成 TVBox 可用的站点。
 * 这类文件（如 CMS 资源站清单）只有 name + api，没有 type，
 * 补 type 后 TVBox 才能正确识别；apiType 为 xml 时按 0（xml）处理，其余按 1（json）。
 */
function toSite(raw) {
  const site = {};
  for (const k of Object.keys(raw)) {
    if (UNSAFE.has(k)) continue;
    site[k] = raw[k];
  }
  if (site.type === undefined) {
    site.type = typeof raw.apiType === 'string' && /xml/i.test(raw.apiType) ? 0 : 1;
  }
  if (site.key === undefined && typeof raw.name === 'string' && raw.name) site.key = raw.name;
  return site;
}

function toRepos(list, baseUrl) {
  return list.map((r) => ({ name: String(r.name || ''), url: absolutizeOne(r.url, baseUrl) }));
}

/** 可能包住站点/链接列表的常见容器字段 */
const LIST_KEYS = ['data', 'list', 'items', 'result', 'results', 'rows', 'content', 'sites', 'urls'];

/**
 * 解析一份源文件内容。
 *
 * 不挑格式：标准 TVBox 单配置（sites）、多仓（urls）、
 * 以及各种「接口清单」JSON（顶层数组或 { data/list/items } 里装着 { name, api }）
 * 都会尽量把内容读出来。
 *
 * @returns {{kind:'config', sites:any[], envelope:object|null}|{kind:'repo', repos:any[]}|{kind:'invalid', reason:string}}
 */
export function parseConfig(text, baseUrl) {
  let obj;
  try {
    // 先尝试直接解析；失败则剥离 // 行注释后再试（TVBox 配置里常见）
    try {
      obj = JSON.parse(text);
    } catch {
      const stripped = text.replace(/^[ \t]*\/\/.*$/gm, '');
      obj = JSON.parse(stripped);
    }
  } catch {
    return { kind: 'invalid', reason: 'JSON 解析失败' };
  }

  if (Array.isArray(obj)) {
    const sites = obj.filter(looksLikeSite);
    if (sites.length) return { kind: 'config', sites: sites.map(toSite), envelope: null };
    const repos = obj.filter((x) => looksLikeRepo(x, false));
    if (repos.length) return { kind: 'repo', repos: toRepos(repos, baseUrl) };
    return { kind: 'invalid', reason: '数组里既没有 api 接口，也没有 url 订阅链接' };
  }

  if (!isPlainObject(obj)) return { kind: 'invalid', reason: '顶层不是对象或数组' };

  // ① 标准 TVBox 单配置
  if (Array.isArray(obj.sites)) return { kind: 'config', sites: obj.sites, envelope: obj };

  // ② 标准多仓
  const repoList = asArray(obj.urls).filter(isPlainObject).filter((x) => typeof x.url === 'string' && x.url);
  if (repoList.length) return { kind: 'repo', repos: toRepos(repoList, baseUrl) };

  // ③ 这份文件自己就是一条接口
  if (looksLikeSite(obj)) return { kind: 'config', sites: [toSite(obj)], envelope: null };

  // ④ 兜底：常见的容器字段里再找一层
  for (const k of LIST_KEYS) {
    const list = obj[k];
    if (!Array.isArray(list) || !list.length) continue;
    const sites = list.filter(looksLikeSite);
    if (sites.length) return { kind: 'config', sites: sites.map(toSite), envelope: null };
    const repos = list.filter((x) => looksLikeRepo(x, false));
    if (repos.length) return { kind: 'repo', repos: toRepos(repos, baseUrl) };
  }

  return { kind: 'invalid', reason: '没有找到任何可用的接口或订阅链接' };
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

const ENVELOPE_KEYS = [];

/**
 * 按 TVBox 订阅源的标准排版序列化配置：
 *  - 顶层键顺序：spider → sites → lives → 其余 → _meta（最后）
 *  - 站点字段顺序：key/name/type/api/searchable/quickSearch/filterable/ext/jar…，内部字段（_latency/_id）放最后
 *  - 直播源字段顺序：name/type/url/epg/playerType…，内部字段放最后
 *  - 2 空格缩进的美化输出（与常见 TVBox 订阅文件一致）
 */
const CONFIG_KEY_ORDER = ['wallpaper', 'sites', 'lives', 'parses', 'flags', 'ijk', 'doh', 'rules', 'ads'];
const SITE_KEY_ORDER = ['key', 'name', 'type', 'api', 'searchable', 'quickSearch', 'filterable', 'ext', 'jar', 'playerType', 'ua', 'header', 'timeout'];
const LIVE_KEY_ORDER = ['name', 'type', 'url', 'epg', 'playerType', 'ua', 'header', 'logo'];

function orderFields(obj, order, tailKeys) {
  const out = {};
  for (const k of order) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (!(k in out) && !tailKeys.includes(k)) out[k] = obj[k];
  }
  for (const k of tailKeys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export function serializeConfig(data) {
  const out = {};
  for (const k of CONFIG_KEY_ORDER) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  for (const k of Object.keys(data)) {
    if (!(k in out) && k !== '_meta') out[k] = data[k];
  }
  if (data._meta !== undefined) out._meta = data._meta;
  if (Array.isArray(out.sites)) {
    out.sites = out.sites.map((s) => (isPlainObject(s) ? orderFields(s, SITE_KEY_ORDER, ['_latency', '_id']) : s));
  }
  if (Array.isArray(out.lives)) {
    out.lives = out.lives.map((l) => (isPlainObject(l) ? orderFields(l, LIVE_KEY_ORDER, ['_latency', '_id']) : l));
  }
  return JSON.stringify(out, null, 2);
}

/** 提取 TVBox 信封（仅保留非 spider/lives 等可透传字段；不含 sites）
 * 注：从 v2 起，数据源只读取 sites 数组，spider / lives 等均不再提取。
 * 系统生成的 lives 由 pipeline 在输出阶段写入，不依赖信封。
 */
export function buildEnvelope(envelope, baseUrl) {
  return {};
}
