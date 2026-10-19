/**
 * 「自动更新时间」的计算。
 *
 * Cloudflare 的 Cron Triggers 写在 wrangler.jsonc 里，部署后无法在运行时修改，
 * 所以后台配置的更新时间不能直接改 cron，而是由每 15 分钟的心跳 cron
 * 比对「现在是否到了设定的时间」来决定要不要启动新一轮整理。
 *
 * 支持两种模式：
 *   - interval：每隔 N 小时执行一次（如 12 小时、1 天、1 周、半个月）
 *   - datetime：在指定的「月-日-时-分」执行（每年一次）
 *
 * 配置里存的是「北京时间」原值（用户看到什么就存什么），比较时再换算成 UTC。
 */

/** 心跳 cron 每 15 分钟一次，所以分钟只能落在 0/15/30/45 */
const MINUTE_STEP = 15;

/** cron 事件可能被延迟几分钟，30 分钟内都算「到点」 */
export const SCHEDULE_WINDOW_MS = 30 * 60 * 1000;

/** 北京时区偏移（毫秒） */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

/** 间隔模式的上下限（小时）：最小 1 小时，最大 1 年 */
const INTERVAL_MIN_HOURS = 1;
const INTERVAL_MAX_HOURS = 24 * 366;

/**
 * 归一化后台传入的 autoUpdate 配置。
 * mode: 'interval'（每隔 N 小时）或 'datetime'（指定月-日-时-分）
 */
export function normalizeSchedule(value) {
  const src = value && typeof value === 'object' ? value : {};
  const num = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  const minute = num(src.minute, 0, 0, 59);
  const mode = src.mode === 'datetime' ? 'datetime' : 'interval';
  return {
    enabled: src.enabled !== false,
    mode,
    // interval 模式：每隔多少小时
    intervalHours: num(src.intervalHours, 168, INTERVAL_MIN_HOURS, INTERVAL_MAX_HOURS),
    // datetime 模式：指定月-日-时-分（北京时间）
    month: num(src.month, 1, 1, 12),
    day: num(src.day, 1, 1, 31),
    hour: num(src.hour, 0, 0, 23),
    minute: Math.round(minute / MINUTE_STEP) * MINUTE_STEP,
  };
}

/**
 * datetime 模式：最近一次「应触发的时刻」的 UTC 毫秒时间戳，结果一定 <= nowMs。
 * 传进来的 schedule 必须是北京时间口径。
 *
 * 按指定的「月-日-时-分」触发（每年一次）。
 * 若设定的「几号」超过当月天数（如 31 号但 2 月只有 28 天），自动取当月最后一天。
 * 若今年的目标时刻尚未到达，则回退到去年同月。
 */
export function lastOccurrenceMs(schedule, nowMs) {
  // 把 now 换到北京时间口径下取年月日
  const beijingNow = new Date(nowMs + BEIJING_OFFSET_MS);
  const bjYear = beijingNow.getUTCFullYear();
  const targetMonth = schedule.month - 1; // 1-12 -> 0-11

  // 当年目标日期（不超过当月天数）
  const daysInMonth = new Date(bjYear, targetMonth + 1, 0).getUTCDate();
  const targetDay = Math.min(schedule.day, daysInMonth);

  // 北京时间当年目标时刻 → 转 UTC（减 8 小时）
  let at = Date.UTC(bjYear, targetMonth, targetDay, schedule.hour, schedule.minute) - BEIJING_OFFSET_MS;

  // 今年还没到点，退到去年同月
  if (at > nowMs) {
    const prevYear = bjYear - 1;
    const daysInPrev = new Date(prevYear, targetMonth + 1, 0).getUTCDate();
    const prevTargetDay = Math.min(schedule.day, daysInPrev);
    at = Date.UTC(prevYear, targetMonth, prevTargetDay, schedule.hour, schedule.minute) - BEIJING_OFFSET_MS;
  }
  return at;
}

/**
 * 配置的时间点是否正处于触发窗口内。
 *
 * @param schedule 归一化后的调度配置
 * @param nowMs    当前 UTC 毫秒
 * @param lastRunMs 上次执行的 UTC 毫秒（0 表示从未执行）；interval 模式需要此值
 */
export function isDue(schedule, nowMs, lastRunMs = 0) {
  if (!schedule || schedule.enabled === false) return false;

  if (schedule.mode === 'interval') {
    const intervalMs = schedule.intervalHours * 3600 * 1000;
    // 从未执行过，或距上次执行已超过间隔
    if (!lastRunMs) return true;
    return nowMs - lastRunMs >= intervalMs;
  }

  // datetime 模式
  const occurrence = lastOccurrenceMs(schedule, nowMs);
  return nowMs - occurrence <= SCHEDULE_WINDOW_MS;
}

/** 触发标识，用于防止同一时刻重复触发 */
export function occurrenceKey(nowMs, schedule) {
  if (schedule.mode === 'interval') {
    // 每次执行的时刻不同，用当前时间即可防止重复
    return new Date(nowMs).toISOString();
  }
  return new Date(lastOccurrenceMs(schedule, nowMs)).toISOString();
}
