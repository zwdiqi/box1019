/**
 * 通用工具：响应构造、编码、哈希、校验。
 */
const enc = new TextEncoder();

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

export function json(data, init = {}) {
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (init.headers) {
    for (const [k, v] of new Headers(init.headers)) headers.set(k, v);
  }
  return new Response(JSON.stringify(data, null, 2), { status: init.status || 200, headers });
}

/** 原样返回一段 JSON 文本（用于订阅文件，保持字节与 KV 中一致） */
export function rawJson(text, init = {}) {
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (init.headers) {
    for (const [k, v] of new Headers(init.headers)) headers.set(k, v);
  }
  return new Response(text, { status: init.status || 200, headers });
}

export function ok(data = null, init = {}) {
  return json({ ok: true, data }, init);
}

export function fail(message, status = 400) {
  return json({ ok: false, error: String(message || 'unknown error') }, { status });
}

export function bytesToHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return bytesToHex(a);
}

/** 同步的稳定短哈希（FNV-1a），用于生成站点 id，避免依赖异步 SHA-1 */
export function stableHash(input) {
  let h = 2166136261 >>> 0;
  const s = String(input);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

export async function sha1Hex(input) {
  const buf = await crypto.subtle.digest('SHA-1', enc.encode(String(input)));
  return bytesToHex(new Uint8Array(buf));
}

export function nowIso() {
  return new Date().toISOString();
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 判断一个值是否是安全的、可安全合并进对象的键 */
export function isUnsafeKey(k) {
  return k === '__proto__' || k === 'constructor' || k === 'prototype';
}

/** 浅拷贝并过滤原型污染键 */
export function safeShallowCopy(obj) {
  if (!isPlainObject(obj)) return {};
  const out = {};
  for (const k of Object.keys(obj)) {
    if (isUnsafeKey(k)) continue;
    out[k] = obj[k];
  }
  return out;
}

export function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function clampString(v, max = 2000) {
  const s = typeof v === 'string' ? v : '';
  return s.length > max ? s.slice(0, max) : s;
}

/** 读取 JSON 请求体，限制大小（默认 8MB，足够导入源文件） */
export async function readJsonBody(request, maxBytes = 8 * 1024 * 1024) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len && len > maxBytes) throw new Error('请求体过大');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('请求体过大');
  if (!text) return {};
  return JSON.parse(text);
}
