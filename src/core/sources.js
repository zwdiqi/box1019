/**
 * 默认源地址清单 + 默认配置 + 首次运行初始化。
 *
 * 默认源清单只是「初始种子」，全部可以在后台增删改。任何地址失效都只会被记进
 * meta:lastRun 的错误列表，不会影响其它源。
 */
import { DEFAULT_ADULT_KEYWORDS } from './classify.js';
import { KEY } from './keys.js';
import { getJSON, putJSON } from './store.js';

export const DEFAULT_SOURCES = [
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/0821.json', name: 'gao-0821', enabled: true },
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/0825.json', name: 'gao-0825', enabled: true },
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/0826.json', name: 'gao-0826', enabled: true },
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/0827.json', name: 'gao-0827', enabled: true },
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/XYQ.json', name: 'gao-XYQ', enabled: true },
  { url: 'https://raw.githubusercontent.com/gaotianliuyun/gao/master/js.json', name: 'gao-js', enabled: true },
];

export const DEFAULT_CONFIG = {
  // 成人源识别关键字（后台可编辑）：中文直接子串匹配，拉丁字母按词边界匹配
  adultKeywords: DEFAULT_ADULT_KEYWORDS,
  fetchTimeoutMs: 8000,
  probeTimeoutMs: 8000,
  // Cloudflare 单次请求并发出站连接上限为 6，留 1 个给 KV
  probeConcurrency: 5,
  chunkSize: 25,
  maxSites: 800,
  maxRepos: 60,
  // 一次 tick 允许消耗的外部子请求数。付费版 10000/次，免费版仅 50/次
  tickSubrequestBudget: 9000,
  // 心跳 cron（每 15 分钟）的单次预算，免费版会被 tickSubrequestBudget 进一步压低
  heartbeatSubrequestBudget: 200,
  // 一次 tick 的墙钟时间预算（毫秒）。周更 cron 的墙钟上限为 15 分钟
  tickTimeBudgetMs: 780000,
  heartbeatEnabled: true,
  customFilesEnabled: true,
};

let bootstrapped = false;

/** 首次运行写入默认数据；用 isolate 级缓存避免每个请求都做 6 次 KV 读 */
export async function ensureBootstrap(env) {
  if (bootstrapped) return;
  const seeds = [
    [KEY.SOURCES, DEFAULT_SOURCES],
    [KEY.CONFIG, DEFAULT_CONFIG],
    [KEY.MANUAL, { av: [], tv: [] }],
    [KEY.OVERRIDES, {}],
    [KEY.BLOCKLIST, []],
    [KEY.SUBS, []],
  ];
  await Promise.all(seeds.map(async ([key, value]) => {
    const current = await getJSON(env, key, null);
    if (current === null) await putJSON(env, key, value);
  }));
  bootstrapped = true;
}

export async function loadConfig(env) {
  await ensureBootstrap(env);
  const stored = await getJSON(env, KEY.CONFIG, null);
  return { ...DEFAULT_CONFIG, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export async function getEnabledSources(env) {
  await ensureBootstrap(env);
  const list = await getJSON(env, KEY.SOURCES, []);
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && typeof s.url === 'string' && s.url.trim() && s.enabled !== false);
}
