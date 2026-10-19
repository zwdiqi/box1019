/**
 * Worker 入口。
 *
 * fetch     —— 所有 HTTP 请求（静态资源 / 订阅文件 / 公开接口 / 后台接口）
 * scheduled —— 定时任务：到后台配置的「自动更新时间」就启动月更整理；
 *              每 15 分钟的心跳负责分段续跑，确保免费版也能跑完一轮
 */
import { KEY } from './core/keys.js';
import { continueRun, getPipelineState, startRun } from './core/pipeline.js';
import { isDue, normalizeSchedule, occurrenceKey } from './core/schedule.js';
import { loadConfig } from './core/sources.js';
import { getJSON, putJSON } from './core/store.js';
import { fail } from './core/util.js';
import { route } from './router.js';

// 每周一 03:00 UTC 的大预算 cron（用于给续跑更多配额，与「自动更新时间」无关）
const BIG_BUDGET_CRON = '0 3 * * 1';

/**
 * 是否到了后台配置的自动更新时间。到点则记下本次触发标识并返回 true，
 * 保证同一时刻只触发一次（心跳 cron 每 15 分钟进入一次，会反复走到这里）。
 */
async function takeScheduleFiring(env, cfg) {
  const schedule = normalizeSchedule(cfg.autoUpdate);
  const now = Date.now();
  const mark = await getJSON(env, KEY.SCHEDULE, null);
  const lastRunMs = mark && mark.at ? new Date(mark.at).getTime() : 0;
  if (!isDue(schedule, now, lastRunMs)) return false;
  const key = occurrenceKey(now, schedule);
  if (mark && mark.key === key) return false;
  await putJSON(env, KEY.SCHEDULE, { key, at: new Date(now).toISOString() });
  return true;
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      console.error('route error', e && e.stack ? e.stack : e);
      return fail(`服务内部错误：${(e && e.message) || String(e)}`, 500);
    }
  },

  async scheduled(event, env, ctx) {
    try {
      const cfg = await loadConfig(env);
      const isBigBudget = event.cron === BIG_BUDGET_CRON;

      // ① 到点就启动新一轮整理（时间来自后台「自动更新时间」）
      if (await takeScheduleFiring(env, cfg)) {
        const current = await getPipelineState(env);
        const idle = !current || !current.phase || current.phase === 'done';
        if (idle) {
          const started = await startRun(env, 'monthly');
          if (started && started.error) console.error('scheduled run skipped:', started.error);
        }
      }

      // ② 续跑未完成的整理任务：大预算 cron 给大预算，心跳给小预算
      if (!isBigBudget && cfg.heartbeatEnabled === false) return;
      const state = await getPipelineState(env);
      if (!state || !state.phase || state.phase === 'done') return;
      ctx.waitUntil(
        continueRun(
          env,
          isBigBudget
            ? { budget: cfg.tickSubrequestBudget, deadlineMs: cfg.tickTimeBudgetMs }
            : {
                budget: Math.min(cfg.tickSubrequestBudget, cfg.heartbeatSubrequestBudget),
                deadlineMs: Math.min(cfg.tickTimeBudgetMs, 60000),
              },
        ),
      );
    } catch (e) {
      console.error('scheduled error', e && e.stack ? e.stack : e);
    }
  },
};
