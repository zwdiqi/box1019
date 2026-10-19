/**
 * KV 读写封装。
 *
 * 注意：Workers KV 是最终一致的，写入后立刻 get 不保证读到新值，
 * 因此所有写接口都应把新值直接放在响应体里返回，前端不要「写完再读」。
 */
export function kv(env) {
  return env.TVBOX_KV;
}

export async function rawGet(env, key) {
  return kv(env).get(key, { type: 'text' });
}

export async function rawPut(env, key, text) {
  await kv(env).put(key, text);
}

export async function del(env, key) {
  await kv(env).delete(key);
}

export async function getJSON(env, key, fallback = null) {
  const raw = await rawGet(env, key);
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function putJSON(env, key, value) {
  await kv(env).put(key, JSON.stringify(value));
  return value;
}

/** 批量读取（KV 单次最多 100 个 key） */
export async function getManyJSON(env, keys) {
  const out = new Map();
  if (!keys.length) return out;
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const map = await kv(env).get(batch, { type: 'text' });
    for (const [k, text] of map) {
      try {
        out.set(k, text === null || text === undefined ? null : JSON.parse(text));
      } catch {
        out.set(k, null);
      }
    }
  }
  return out;
}

export async function listKeys(env, prefix) {
  const names = [];
  let cursor;
  do {
    const res = await kv(env).list({ prefix, cursor });
    for (const item of res.keys) names.push(item.name);
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return names;
}

export async function deletePrefix(env, prefix) {
  const names = await listKeys(env, prefix);
  for (let i = 0; i < names.length; i += 100) {
    await Promise.all(names.slice(i, i + 100).map((n) => del(env, n)));
  }
  return names.length;
}
