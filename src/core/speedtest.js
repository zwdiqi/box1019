/**
 * 连通性与响应速度探测。
 *
 * Worker 里无法做 TCP / 爬虫类探测，只能对 http(s) 形式的接口地址发请求测 TTFB。
 * 判定标准：只要拿到响应头就算「连通」（403/404 也算通），请求异常/超时才判为失效。
 * 直播源（m3u/txt 列表）另需读取正文判定有效性，因此额外提供限长读取的探测函数。
 */
import { decryptContent } from './decrypt.js';

export function isTestable(site) {
  const api = typeof site.api === 'string' ? site.api : '';
  if (!/^https?:\/\//i.test(api)) return false;
  // type 3 是爬虫源（api 通常为 csp_xxx 或 js 文件），无法通过 HTTP 反映真实可用性
  if (Number(site.type) === 3) return false;
  return true;
}

export async function fetchText(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'okhttp/4.9.0', Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8').decode(bytes);
  // 尝试解密（base64 / 图片伪装等），解密失败则用原始文本
  const decrypted = decryptContent(text, bytes);
  return decrypted || text;
}

/** 探测正文读取上限（字节）：用于测速同时抓取内容做成人/普通分类 */
export const PROBE_BODY_MAX_BYTES = 32 * 1024;

export async function probe(url, timeoutMs = 8000, maxBytes = PROBE_BODY_MAX_BYTES) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'okhttp/4.9.0', Accept: '*/*' },
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
 * @returns {Promise<{ok:boolean, ms:number, status:number, text:string, error?:string}>}
 */
export async function fetchLimited(url, timeoutMs = 10000, maxBytes = 65536) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'okhttp/4.9.0', Accept: '*/*' },
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
