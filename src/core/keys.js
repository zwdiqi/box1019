/**
 * KV key 常量集中定义，避免各模块拼写漂移。
 */
export const KEY = {
  TV: 'file:tv.json',
  AV: 'file:av.json',
  MANUAL: 'manual',
  OVERRIDES: 'overrides',
  BLOCKLIST: 'blocklist',
  SOURCES: 'sources',
  BASE: 'base',
  CONFIG: 'config',
  AUTH: 'auth',
  LAST_RUN: 'meta:lastRun',
  PIPELINE: 'pipeline',
  SUBS: 'subs',
  SESSION_SECRET: 'secret:session',
};

export const TMP = {
  queue: (runId) => `tmp:${runId}:queue`,
  base: (runId) => `tmp:${runId}:base`,
  raw: (runId, i) => `tmp:${runId}:raw:${i}`,
  done: (runId, i) => `tmp:${runId}:done:${i}`,
  rawPrefix: (runId) => `tmp:${runId}:raw:`,
  donePrefix: (runId) => `tmp:${runId}:done:`,
  prefix: (runId) => `tmp:${runId}:`,
};
