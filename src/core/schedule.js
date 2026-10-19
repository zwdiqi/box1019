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

/** 北京时区偏移（毫秒） */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

/**
 * 归一化后台传入的 autoUpdate 配置。
 * day：1-31（每月几号）；hour：0-23；minute：0/15/30/45（北京时间）
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
    day: num(src.day, 1, 1, 31),
    hour: num(src.hour, 0, 0, 23),
    minute: Math.round(minute / MINUTE_STEP) * MINUTE_STEP,
  };
}

/**
 * 最近一次「应触发的时刻」的 UTC 毫秒时间戳，结果一定 <= nowMs。
 * 传进来的 schedule 必须是北京时间口径。
 *
 * 若设定的「几号」超过当月天数（如 31 号但当月只有 30 天），自动取当月最后一天。
 */
export function lastOccurrenceMs(schedule, nowMs) {
  // 把 now 换到北京时间口径下取年月日
  const beijingNow = new Date(nowMs + BEIJING_OFFSET_MS);
  const bjYear = beijingNow.getUTCFullYear();
  const bjMonth = beijingNow.getUTCMonth();

  // 当月目标日期（不超过当月天数）
  const daysInMonth = new Date(bjYear, bjMonth + 1, 0).getUTCDate();
  const targetDay = Math.min(schedule.day, daysInMonth);

  // 北京时间当月目标时刻 → 转 UTC（减 8 小时）
  let at = Date.UTC(bjYear, bjMonth, targetDay, schedule.hour, schedule.minute) - BEIJING_OFFSET_MS;

  // 本月还没到点，退到上个月
  if (at > nowMs) {
    const prevMonth = bjMonth - 1;
    const prevYear = bjYear + (prevMonth < 0 ? -1 : 0);
    const pm = (prevMonth + 12) % 12;
    const daysInPrev = new Date(prevYear, pm + 1, 0).getUTCDate();
    const prevTargetDay = Math.min(schedule.day, daysInPrev);
    at = Date.UTC(prevYear, pm, prevTargetDay, schedule.hour, schedule.minute) - BEIJING_OFFSET_MS;
  }
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
