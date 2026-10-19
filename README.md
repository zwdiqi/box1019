# TVBox 源自动整理系统

一个可**一键部署到 Cloudflare** 的 TVBox 订阅源自动整理系统：每周自动下载公开源配置 → 合并去重 → **成人/普通分类隔离** → 连通性与速度检测 → 按速度排序 → 生成两份独立订阅文件：

- 普通源 → `/tv.json`
- 成人源 → `/av.json`

前端提供可视化后台，可编辑 / 导入 / 导出源，展示已生成的订阅文件并直接给出 TVBox 可用的订阅链接。所有数据（JSON 文件、配置、密钥）持久化在 Cloudflare KV，后台密码保护。

> 说明：因需要「每周定时任务（Cron Triggers）」，本项目基于 **Cloudflare Workers**（Workers 支持定时任务，Pages 项目不支持）。

---

## 一键部署

1. 在 GitHub 新建一个 **public** 仓库，把本项目全部文件上传上去。
2. 把下面链接里的 `你的用户名/TVBox-Organizer` 换成你的实际仓库地址，然后点击按钮：

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zwdiqi/box1019)

3. 授权 Cloudflare 后，在配置页：
   - 可修改 Worker 名称；
   - **填写 `ADMIN_PASSWORD`**（后台管理密码，务必设置强密码）；
   - **填写 `SESSION_SECRET`**（会话签名密钥，填一串 32 位以上随机字符）。
4. 点击 Deploy。**KV 命名空间无需手动创建**，部署时会根据 `wrangler.jsonc` 中的 binding 自动创建并绑定（需 wrangler ≥ 4.45.0）。

> 若你的部署环境不支持自动供给 KV，兜底方案：在 Cloudflare 控制台手动创建 KV 命名空间，把它的 id 填回 `wrangler.jsonc` 的 `kv_namespaces` 中，再重新部署。

## 部署后必做

1. **绑定自有域名（重要）**：`*.workers.dev` 在国内被 DNS 污染，直接使用会导致 TVBox 订阅链接不可用。前往 Worker → Settings → Domains & Routes 添加 Custom Domain。
2. 打开 `https://你的域名/admin` 用密码登录（若部署时未设 `ADMIN_PASSWORD`，默认密码为 `admin123`，请登录后立即在「密码」页修改）。
3. 在「数据看板」点「立即执行整理」，或在「源地址清单」调整源后等待每周一 03:00（UTC）的自动任务。
4. 订阅地址：`https://你的域名/tv.json`、`https://你的域名/av.json`。

---

## 功能一览

| 模块 | 说明 |
|---|---|
| 自动更新 | 周一 03:00 UTC 触发；每 15 分钟心跳用于分段续跑（免费版分段完成） |
| 分类隔离 | 关键字匹配区分成人/普通源，分别保存到 `av.json` / `tv.json`，完全隔离 |
| 测速排序 | 对 http(s) 接口测 TTFB，按速度升序排序；失效源自动剔除（`csp_`/type3 爬虫源无法直测，保留并标注未测速） |
| 前端编辑 | 源清单增删改、手动源增删改、自动源字段修改（overrides）与删除（blocklist） |
| 导入导出 | 源清单 / 手动源 / overrides / blocklist / 自定义订阅均可导入导出 JSON |
| 手动源保留 | 手动输入/导入的源存于一处，**自动更新时永不覆盖**，并与自动结果一起输出到订阅文件 |
| 自定义订阅 | 在后台创建自定义命名的订阅文件，访问 `/<名称>.json` |
| 权限控制 | 后台所有写接口需登录（HttpOnly + Secure + SameSite=Strict Cookie） |

---

## 目录结构

```
wrangler.jsonc              Worker 配置（assets / kv_namespaces / triggers.crons）
package.json                依赖与脚本（deploy = wrangler deploy）
.dev.vars.example           部署页填写的密钥模板（ADMIN_PASSWORD / SESSION_SECRET）

public/index.html           公开页
public/style.css
public/app.js

src/index.js                Worker 入口：fetch + scheduled
src/router.js               路由分发 + 鉴权
src/admin-ui.js             后台界面（内联 HTML，仅鉴权通过后下发）

src/api/public.js           公开只读接口与订阅文件
src/api/admin.js            后台接口（登录、状态、流水线、源、手动源、配置、订阅、导入导出、密码）

src/core/keys.js            KV key 常量
src/core/store.js           KV 读写封装
src/core/util.js            响应/编码/哈希/校验工具
src/core/auth.js            PBKDF2 密码哈希 + HMAC 会话
src/core/normalize.js       配置解析与相对路径归一化
src/core/classify.js        成人/普通分类
src/core/speedtest.js       连通性与 TTFB 测速
src/core/merge.js           合并、去重、排序、输出裁剪
src/core/sources.js         默认源清单与初始化
src/core/pipeline.js        分段续跑状态机
```

## 本地开发（可选）

本机安装 Node.js 后：

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入 ADMIN_PASSWORD / SESSION_SECRET
npm run dev                       # 启动本地开发服务
npm run deploy                    # 部署
```

触发定时任务（本地验证）可参考 wrangler 的 `--test-scheduled` 用法。

## 注意

- 免费版 Worker 单次 CPU/子请求配额有限，全量整理依靠「心跳 cron 分段续跑 + 后台继续执行」完成，一轮约需一段时间；若要求一次跑完，建议升级 Workers Paid。
- 本系统只聚合公开源的**元数据（名称 / 接口地址）**，不代理、不托管任何内容。
