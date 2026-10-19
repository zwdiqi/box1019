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

/** 首次运行时用 env 里的 ADMIN_PASSWORD 初始化密码记录；缺省则回退到 admin123 并标记告警 */
export async function ensureAuth(env) {
  const existing = await getJSON(env, KEY.AUTH, null);
  if (existing && existing.salt && existing.hash) return existing;

  const fromEnv = env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).trim();
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

export async function sessionSecret(env) {
  if (cachedSecret) return cachedSecret;
  const fromEnv = env.SESSION_SECRET && String(env.SESSION_SECRET).trim();
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const stored = await rawGet(env, KEY.SESSION_SECRET);
  if (stored) {
    cachedSecret = stored;
    return stored;
  }
  const generated = randomHex(32);
  await rawPut(env, KEY.SESSION_SECRET, generated);
  cachedSecret = generated;
  return generated;
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
