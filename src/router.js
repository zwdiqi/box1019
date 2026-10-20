/**
 * 路由分发。
 *
 * 依赖 Workers Static Assets 的默认语义：命中 public/ 里的静态文件就直接返回，
 * 未命中才落到 Worker。因此 /api/*、/tv.json、/av.json、/admin 都会进到这里。
 */
import { adminPage, loginPage } from './admin-ui.js';
import { handleAdminApi } from './api/admin.js';
import { publicStatus, serveCustom, serveSubscription } from './api/public.js';
import { verifySession } from './core/auth.js';
import { KEY } from './core/keys.js';
import { ensureBootstrap, loadConfig } from './core/sources.js';
import { CORS_HEADERS, fail } from './core/util.js';

const CUSTOM_RE = /^\/([A-Za-z0-9_-]{1,32})\.json$/;
const RESERVED_BASE = new Set(['index', 'admin', 'api', 'assets', 'favicon', 'robots']);
const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

export async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (path === '/api/public/status') return publicStatus(env);

  if (path.startsWith('/api/admin/')) {
    // 后台接口要在读配置前先完成引导种子，否则首次请求可能读到空清单
    await ensureBootstrap(env);
    const segments = path.slice('/api/admin/'.length).split('/').filter(Boolean);
    const isAuthed = await verifySession(env, request);
    return handleAdminApi(request, env, segments, isAuthed);
  }
  if (path.startsWith('/api/')) return fail('接口不存在', 404);

  // 订阅路由、自定义订阅、/admin 都需要动态配置（tvFilename / avFilename）
  // 只对这些路径执行 ensureBootstrap + loadConfig，避免静态资源请求（/style.css 等）多一次 KV 读
  const needCfg =
    path === '/admin' || path === '/admin/' || path === '/admin.html' ||
    path.endsWith('.json');
  if (needCfg) {
    await ensureBootstrap(env);
    const cfg = await loadConfig(env);
    const tvFilename = cfg.tvFilename || 'tv';
    const avFilename = cfg.avFilename || 'av';
    RESERVED_BASE.add(tvFilename);
    RESERVED_BASE.add(avFilename);

    if (path === `/${tvFilename}.json`) return serveSubscription(env, KEY.TV, 'tv');
    if (path === `/${avFilename}.json`) return serveSubscription(env, KEY.AV, 'av');
  }

  if (path === '/admin' || path === '/admin/') {
    // 后台界面本体不进静态资源目录：未登录只下发登录页，登录后才下发完整管理界面
    const isAuthed = await verifySession(env, request);
    return new Response(isAuthed ? adminPage() : loginPage(), { headers: HTML_HEADERS });
  }
  if (path === '/admin.html') {
    return new Response(null, { status: 302, headers: { Location: '/admin', 'Cache-Control': 'no-store' } });
  }

  const custom = CUSTOM_RE.exec(path);
  if (custom && !RESERVED.has(custom[1].toLowerCase())) {
    const res = await serveCustom(env, custom[1]);
    if (res) return res;
    return fail('自定义订阅不存在', 404);
  }

  return env.ASSETS.fetch(request);
}
