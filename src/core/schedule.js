/**
 * 「自动更新时间」的计算。
 *
 * Cloudflare 的 Cron Triggers 写在 wrangler.jsonc 里，部署后无法在运行时修改，
 * 所以后台配置的更新时间不能直接改 cron，而是由每 15 分钟的心跳 cron
 * 比对「现在是否到了设定的时间」来决定要不要启动新一轮整理。
 *
 * 配置里存的是「北京时间」原值（用户看到什么就存什么），比较时再换算成 UTC。
 */

/** 心跳 cron 每 15 分钟一次，所以分钟只能落在 0/15/30/45 */
const MINUTE_STEP = 15;

/** cron 事件可能被延迟几分钟，30 分钟内都算「到点」 */
export const SCHEDULE_WINDOW_MS = 30 * 60 * 1000;

/**
 * 归一化后台传入的 autoUpdate 配置。
 * weekday：1=周一 … 7=周日；hour：0-23；minute：0/15/30/45（北京时间）
 */
export function normalizeSchedule(value) {
  const src = value && typeof value === 'object' ? value : {};
  const num = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  const minute = num(src.minute, 0, 0, 59);
  return {
    enabled: src.enabled !== false,
    weekday: num(src.weekday, 1, 1, 7),
    hour: num(src.hour, 0, 0, 23),
    minute: Math.round(minute / MINUTE_STEP) * MINUTE_STEP,
  };
}

/** 北京时间（周几 1-7、时、分）→ UTC 的周几/时/分 */
export function beijingToUtc(weekday, hour, minute) {
  let h = hour - 8;
  let w = weekday;
  if (h < 0) {
    h += 24;
    w -= 1;
    if (w < 1) w += 7;
  }
  return { weekday: w, hour: h, minute };
}

/**
 * 最近一次「应触发的时刻」的 UTC 毫秒时间戳，结果一定 <= nowMs。
 * 传进来的 schedule 必须是北京时间口径。
 */
export function lastOccurrenceMs(schedule, nowMs) {
  const utc = beijingToUtc(schedule.weekday, schedule.hour, schedule.minute);
  const now = new Date(nowMs);
  const targetDay = utc.weekday % 7; // JS 的 getUTCDay：0=周日 … 6=周六
  const backDays = (now.getUTCDay() - targetDay + 7) % 7;
  const midnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let at = midnightUtc - backDays * 86400000 + utc.hour * 3600000 + utc.minute * 60000;
  if (at > nowMs) at -= 7 * 86400000; // 本周还没到，取上一次（上周）
  return at;
}

/** 配置的时间点是否正处于触发窗口内 */
export function isDue(schedule, nowMs) {
  if (!schedule || schedule.enabled === false) return false;
  const occurrence = lastOccurrenceMs(schedule, nowMs);
  return nowMs - occurrence <= SCHEDULE_WINDOW_MS;
}

/** 触发窗口对应的唯一标识，用于防止同一时刻重复触发 */
export function occurrenceKey(nowMs, schedule) {
  return new Date(lastOccurrenceMs(schedule, nowMs)).toISOString();
}
