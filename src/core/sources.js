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
  // 一次 tick 允许消耗的「外部请求」子请求数。
  // Cloudflare：免费版每次调用仅 50 个外部子请求，付费版默认 10000。
  // 这里按免费版预置，保证一键部署即可正常跑完；付费版可在后台调高到 9000+ 一次跑完。
  // 注意：KV 读写走的是另一套额度（免费版 1000/次），不占用这里的预算。
  tickSubrequestBudget: 45,
  // 心跳 cron（每 15 分钟）的单次预算，同样按免费版上限预置
  heartbeatSubrequestBudget: 40,
  // 一次 tick 的墙钟时间预算（毫秒）。大预算 cron 的墙钟上限为 15 分钟
  tickTimeBudgetMs: 780000,
  heartbeatEnabled: true,
  customFilesEnabled: true,
  // 直播源自动更新：检测有效后按测速结果并入 tv.json 的 lives 数组
  liveEnabled: true,
  liveTimeoutMs: 12000,
  // 正文长度下限（字节）：过短视为无效（多为错误页或空列表）
  liveMinBytes: 200,
  // 自动更新时间。默认「间隔模式」每周执行一次（168 小时）。
  // 也可改为「指定时间模式」在某年某月某日某时某分执行。
  // intervalHours：间隔小时数（如 12=12小时, 24=1天, 168=1周, 360=半个月, 720=1个月）
  autoUpdate: { enabled: true, mode: 'interval', intervalHours: 168, month: 1, day: 1, hour: 11, minute: 0 },
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
    [KEY.LIVES, []],
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
