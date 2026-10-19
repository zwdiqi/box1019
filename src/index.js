/**
 * Worker 入口。
 *
 * fetch     —— 所有 HTTP 请求（静态资源 / 订阅文件 / 公开接口 / 后台接口）
 * scheduled —— 定时任务：周一 03:00 UTC 启动周更整理；每 15 分钟心跳负责分段续跑
 */
import { continueRun, getPipelineState, startRun } from './core/pipeline.js';
import { loadConfig } from './core/sources.js';
import { fail } from './core/util.js';
import { route } from './router.js';

const WEEKLY_CRON = '0 3 * * 1';

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

      if (event.cron === WEEKLY_CRON) {
        const current = await getPipelineState(env);
        const idle = !current || !current.phase || current.phase === 'done';
        if (idle) {
          const started = await startRun(env, 'weekly');
          if (started && started.error) {
            console.error('weekly run skipped:', started.error);
            return;
          }
        }
        ctx.waitUntil(
          continueRun(env, { budget: cfg.tickSubrequestBudget, deadlineMs: cfg.tickTimeBudgetMs }),
        );
        return;
      }

      // 心跳：只在有未完成的整理任务时续跑，避免空转
      if (cfg.heartbeatEnabled === false) return;
      const state = await getPipelineState(env);
      if (!state || !state.phase || state.phase === 'done') return;
      const budget = Math.min(cfg.tickSubrequestBudget, cfg.heartbeatSubrequestBudget);
      ctx.waitUntil(
        continueRun(env, { budget, deadlineMs: Math.min(cfg.tickTimeBudgetMs, 60000) }),
      );
    } catch (e) {
      console.error('scheduled error', e && e.stack ? e.stack : e);
    }
  },
};
