/**
 * 连通性与响应速度探测。
 *
 * Worker 里无法做 TCP / 爬虫类探测，只能对 http(s) 形式的接口地址发请求测 TTFB。
 * 判定标准：只要拿到响应头就算「连通」（403/404 也算通），请求异常/超时才判为失效。
 */

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
  return res.text();
}

export async function probe(url, timeoutMs = 8000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'okhttp/4.9.0', Accept: '*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - t0;
    if (res.body) {
      try {
        await res.body.cancel();
      } catch {
        /* 忽略取消流的异常 */
      }
    }
    return { ok: true, ms, status: res.status };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, status: 0, error: (e && e.message) || String(e) };
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
