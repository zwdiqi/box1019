/**
 * 连通性与响应速度探测。
 *
 * Worker 里无法做 TCP / 爬虫类探测，只能对 http(s) 形式的接口地址发请求测 TTFB。
 * 判定标准：只要拿到响应头就算「连通」（403/404 也算通），请求异常/超时才判为失效。
 * 直播源（m3u/txt 列表）另需读取正文判定有效性，因此额外提供限长读取的探测函数。
 *
 * 新特性：
 *  - 支持 URL 内 `user:pass@host` 形式的加密连接（自动转为 Authorization: Basic header）
 *  - 支持自定义 User-Agent（每个请求都可覆盖全局 UA）
 */
import { decryptContent } from './decrypt.js';

const DEFAULT_UA = 'okhttp/4.9.0';

/**
 * 从 URL 中提取 `user:pass@` 形式的 Basic Auth 凭据。
 * 返回 { cleanUrl, userinfo } 或 null（无凭据）。
 * Cloudflare fetch 会忽略 URL 中的 userinfo，必须手动拆出并加 Authorization header。
 */
export function extractBasicAuth(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/^([a-z]+:\/\/)([^/@]+)@(.+)$/i);
  if (!m) return null;
  return { cleanUrl: m[1] + m[3], userinfo: m[2] };
}

/** 构建 fetch 的 headers：处理 Basic Auth + UA + Accept */
function buildHeaders(url, ua) {
  const headers = { Accept: '*/*' };
  if (ua) headers['User-Agent'] = ua;
  const auth = extractBasicAuth(url);
  if (auth) {
    headers['Authorization'] = 'Basic ' + btoa(decodeURIComponent(auth.userinfo));
    // URL 里去掉 userinfo，返回 cleanUrl
    return { headers, cleanUrl: auth.cleanUrl };
  }
  return { headers, cleanUrl: url };
}

export function isTestable(site) {
  const api = typeof site.api === 'string' ? site.api : '';
  if (!/^https?:\/\//i.test(api)) return false;
  // type 3 是爬虫源（api 通常为 csp_xxx 或 js 文件），无法通过 HTTP 反映真实可用性
  if (Number(site.type) === 3) return false;
  return true;
}

/** 源文件下载上限（字节）：防止异常大的文件撑爆 Worker 内存 */
const SOURCE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * 下载源配置文件，自动处理 URL 中的 Basic Auth 和自定义 UA。
 * @param {string} url
 * @param {number} timeoutMs
 * @param {string} [ua] User-Agent，默认 okhttp/4.9.0
 */
export async function fetchText(url, timeoutMs = 8000, ua = DEFAULT_UA) {
  const { headers, cleanUrl } = buildHeaders(url, ua);
  const res = await fetch(cleanUrl, {
    method: 'GET',
    redirect: 'follow',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // 限长读取：TVBox 配置都在几百 KB 以内，2MB 足够；超出部分截断不影响解析
  const { text, bytes } = await readLimited(res, SOURCE_MAX_BYTES);
  // 尝试解密（base64 / 图片伪装等），解密失败则用原始文本
  const decrypted = decryptContent(text, bytes);
  return decrypted || text;
}

/** 探测正文读取上限（字节）：用于测速同时抓取内容做成人/普通分类 */
export const PROBE_BODY_MAX_BYTES = 32 * 1024;

/**
 * 探测接口地址的连通性与速度，自动处理 URL Basic Auth 和自定义 UA。
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} [maxBytes]
 * @param {string} [ua] User-Agent，默认 okhttp/4.9.0
 */
export async function probe(url, timeoutMs = 8000, maxBytes = PROBE_BODY_MAX_BYTES, ua = DEFAULT_UA) {
  const t0 = Date.now();
  try {
    const { headers, cleanUrl } = buildHeaders(url, ua);
    const res = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - t0;
    // 读取有限正文：既测 TTFB，又拿到内容用于成人源识别
    // 无论 HTTP 状态码如何（403/404 也算连通），都尝试读取正文以做分类
    const { text, bytes } = await readLimited(res, maxBytes);
    const decrypted = decryptContent(text, bytes);
    return { ok: true, ms, status: res.status, text: decrypted || text };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, status: 0, text: '', error: (e && e.message) || String(e) };
  }
}

/** 读取响应正文，最多 maxBytes 字节（避免大文件把一次调用撑爆） */
async function readLimited(res, maxBytes) {
  if (!res.body) return { text: '', bytes: new Uint8Array() };
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (received >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* 忽略取消流的异常 */
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  const text = new TextDecoder('utf-8').decode(bytes);
  return { text, bytes };
}

/**
 * 探测直播源地址：下载正文（限长）并返回 TTFB。
 * 自动处理 URL 中的 Basic Auth（user:pass@host）和自定义 UA。
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} maxBytes
 * @param {string} [ua] User-Agent，缺省时不设置 UA（由 Worker 默认决定）
 */
export async function fetchLimited(url, timeoutMs = 10000, maxBytes = 65536, ua) {
  const t0 = Date.now();
  try {
    const { headers, cleanUrl } = buildHeaders(url, ua);
    const res = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      if (res.body) {
        try {
          await res.body.cancel();
        } catch {
          /* 忽略取消流的异常 */
        }
      }
      return { ok: false, ms, status: res.status, text: '', error: `HTTP ${res.status}` };
    }
    const { text } = await readLimited(res, maxBytes);
    return { ok: true, ms, status: res.status, text };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, status: 0, text: '', error: (e && e.message) || String(e) };
  }
}

/** 并发受限的 map，默认并发不要超过 5（Cloudflare 单请求并发出站连接上限为 6，需留 1 个给 KV） */
export async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  const runners = [];
  const size = Math.max(1, Math.min(limit | 0 || 1, items.length));
  for (let i = 0; i < size; i += 1) {
    runners.push((async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        out[index] = await worker(items[index], index);
      }
    })());
  }
  await Promise.all(runners);
  return out;
}
