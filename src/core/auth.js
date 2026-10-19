/**
 * 鉴权：密码哈希（PBKDF2-SHA256）+ 会话签名（HMAC-SHA256）。
 *
 * 迭代次数刻意取 10000：免费版 Worker 单次请求只有 10ms CPU，
 * 迭代过高会导致登录直接超限失败。
 */
import { KEY } from './keys.js';
import { getJSON, putJSON, rawGet, rawPut } from './store.js';
import { bytesToHex, hexToBytes, nowIso, randomHex, timingSafeEqual } from './util.js';

const PBKDF2_ITERATIONS = 10000;
const SESSION_COOKIE = 'tvbox_session';
const SESSION_TTL_SEC = 7 * 24 * 3600;
const DEFAULT_PASSWORD = 'admin123';
const enc = new TextEncoder();

let cachedSecret = null;

async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(data)));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * 密码记录持久化：以 KV 中的哈希为准，环境变量仅作初始化或覆盖默认密码用。
 *
 * 策略：
 *   1. KV 已有哈希 → 直接用（跨部署持久化，环境变量丢失不影响登录）
 *   2. KV 是默认密码且环境变量 ADMIN_PASSWORD 有值 → 用环境变量更新 KV（允许通过环境变量重置默认密码）
 *   3. KV 为空 → 用环境变量或默认 admin123 初始化
 *
 * 这样即使部署时 ADMIN_PASSWORD 密钥被删除，只要 KV 没被清空，密码就保持不变，无需重新配置。
 */
export async function ensureAuth(env) {
  const existing = await getJSON(env, KEY.AUTH, null);
  const fromEnv = env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).trim();

  // KV 已有哈希记录
  if (existing && existing.salt && existing.hash) {
    // 当前是默认密码，且环境变量指定了新密码 → 更新（便于通过环境变量重置默认密码）
    if (existing.usingDefault && fromEnv) {
      const salt = randomHex(16);
      const hash = await derive(fromEnv, salt, PBKDF2_ITERATIONS);
      const rec = { salt, hash, iterations: PBKDF2_ITERATIONS, usingDefault: false, updatedAt: nowIso() };
      await putJSON(env, KEY.AUTH, rec);
      return rec;
    }
    return existing;
  }

  // KV 为空：用环境变量或默认密码初始化
  const usingDefault = !fromEnv;
  const password = fromEnv || DEFAULT_PASSWORD;
  const salt = randomHex(16);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  const rec = { salt, hash, iterations: PBKDF2_ITERATIONS, usingDefault, updatedAt: nowIso() };
  await putJSON(env, KEY.AUTH, rec);
  return rec;
}

export async function verifyPassword(env, password) {
  const rec = await ensureAuth(env);
  const hash = await derive(password, rec.salt, rec.iterations || PBKDF2_ITERATIONS);
  return timingSafeEqual(hash, rec.hash);
}

export async function setPassword(env, password) {
  const salt = randomHex(16);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  const rec = { salt, hash, iterations: PBKDF2_ITERATIONS, usingDefault: false, updatedAt: nowIso() };
  await putJSON(env, KEY.AUTH, rec);
  return rec;
}

export async function isUsingDefaultPassword(env) {
  const rec = await getJSON(env, KEY.AUTH, null);
  return !rec || rec.usingDefault === true;
}

/**
 * 会话签名密钥：以 KV 持久化为准，环境变量仅作首次初始化用。
 * 这样即使部署时环境变量/密钥丢失，已生成的密钥仍保留在 KV 中，
 * 不会导致所有用户会话失效、也无需重新配置。
 */
export async function sessionSecret(env) {
  if (cachedSecret) return cachedSecret;
  // KV 已有值 → 直接用（跨部署持久化，环境变量丢失不影响）
  const stored = await rawGet(env, KEY.SESSION_SECRET);
  if (stored) {
    cachedSecret = stored;
    return stored;
  }
  // KV 为空：优先用环境变量，否则随机生成，然后写入 KV 持久化
  const fromEnv = env.SESSION_SECRET && String(env.SESSION_SECRET).trim();
  const secret = fromEnv || randomHex(32);
  await rawPut(env, KEY.SESSION_SECRET, secret);
  cachedSecret = secret;
  return secret;
}

export async function createSessionToken(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = String(exp);
  const secret = await sessionSecret(env);
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const secret = await sessionSecret(env);
  const expect = await hmacHex(secret, payload);
  return timingSafeEqual(sig, expect);
}

export function sessionCookie(token, { secure = true, maxAge = SESSION_TTL_SEC } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (secure) parts.push('Secure');
  if (maxAge > 0) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function clearSessionCookie({ secure = true } = {}) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
