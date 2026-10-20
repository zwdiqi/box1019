/**
 * 后台界面（内联 HTML，刻意不放进 public/，只能由鉴权通过的 /admin 返回）。
 *
 * 说明：登录页与后台主页都是完全静态的字符串。客户端脚本一律使用字符串拼接，
 * 不出现反引号与 ${，这样整段 HTML 就能安全地作为一个 JS 模板字面量返回。
 */

const SHARED_CSS = `
:root{
  --bg:#0f1218; --panel:#171b24; --panel2:#1e2430; --line:#2a313f;
  --text:#e6e9ef; --muted:#9aa4b6; --accent:#4c8dff; --accent2:#3ad29f;
  --warn:#ffb020; --danger:#ff5c5c; --radius:10px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1180px;margin:0 auto;padding:18px}
header.top{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
header.top h1{font-size:18px;margin:0;font-weight:600}
header.top .spacer{flex:1}
.badge{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--panel2);color:var(--muted);border:1px solid var(--line)}
.badge.warn{color:var(--warn);border-color:#5a4616}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}
.tab{background:var(--panel);border:1px solid var(--line);color:var(--muted);padding:8px 14px;border-radius:999px;cursor:pointer;font-size:13px}
.tab:hover{color:var(--text)}
.tab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 12px;font-weight:600}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.stat .k{font-size:12px;color:var(--muted)}
.stat .v{font-size:20px;font-weight:600;margin-top:2px}
button{background:var(--accent);border:1px solid var(--accent);color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px}
button:hover{filter:brightness(1.08)}
button.ghost{background:transparent;border-color:var(--line);color:var(--text)}
button.ghost:hover{border-color:var(--accent);color:var(--accent)}
button.danger{background:var(--danger);border-color:var(--danger)}
button.ok{background:var(--accent2);border-color:var(--accent2);color:#062018}
button:disabled{opacity:.5;cursor:not-allowed}
input,select,textarea{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:7px 9px;font:inherit;width:100%}
input[type=checkbox]{width:auto}
textarea{min-height:120px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
th{color:var(--muted);font-weight:500;font-size:12px}
td.tight{width:1%;white-space:nowrap}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all}
.muted{color:var(--muted)}
.small{font-size:12px}
.link-box{display:flex;gap:8px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px}
.link-box code{flex:1;word-break:break-all;font-size:12px}
.progress{height:8px;background:var(--panel2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.progress > i{display:block;height:100%;background:var(--accent);width:0}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:3px 10px;margin:0 6px 6px 0;font-size:12px}
.chip button{padding:0 6px;font-size:11px;line-height:18px;border-radius:999px;background:transparent;border-color:var(--line);color:var(--muted)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg-btn{background:transparent;border:0;color:var(--muted);padding:7px 14px;cursor:pointer;font:inherit;font-size:13px}
.seg-btn.active{background:var(--accent);color:#fff}
.au-preset{background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:6px 14px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px}
.au-preset:hover{border-color:var(--accent);color:var(--accent)}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}
.lat{font-variant-numeric:tabular-nums;font-size:12px}
.lat.fast{color:var(--accent2)}
.lat.mid{color:var(--warn)}
.lat.slow{color:var(--danger)}
.lat.na{color:var(--muted)}
.pill{display:inline-block;font-size:11px;padding:1px 8px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);color:var(--muted)}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#222a38;border:1px solid var(--line);color:var(--text);padding:10px 18px;border-radius:10px;opacity:0;pointer-events:none;transition:.25s}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.err{border-color:var(--danger);color:#ffd7d7}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-card{width:100%;max-width:360px}
.err-list{max-height:220px;overflow:auto;font-size:12px}
.log{padding:4px 0;border-bottom:1px dashed var(--line);word-break:break-all}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
`;

/** 登录页 */
export function loginPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TVBox 整理后台 · 登录</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <div class="card login-card">
    <p class="muted small" id="hint">请输入管理密码</p>
    <form id="f" autocomplete="off">
      <input type="password" id="pwd" placeholder="管理密码" autocomplete="current-password" autofocus>
      <div style="height:12px"></div>
      <button type="submit" style="width:100%">登录</button>
    </form>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
(function(){
  var f=document.getElementById('f'), pwd=document.getElementById('pwd'), hint=document.getElementById('hint'), toastEl=document.getElementById('toast');
  function toast(msg,err){ toastEl.textContent=msg; toastEl.className='toast show'+(err?' err':''); }
  f.addEventListener('submit',function(e){
    e.preventDefault();
    hint.textContent='正在登录…';
    fetch('/api/admin/login',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({password:pwd.value})
    }).then(function(r){ return r.json().then(function(d){ return {s:r.status,d:d}; }); }).then(function(res){
      if(res.d && res.d.ok){ location.href='/admin'; return; }
      hint.textContent='登录失败';
      toast((res.d && res.d.error) || '登录失败',true);
    }).catch(function(e){ toast('请求失败：'+e.message,true); });
  });
})();
</script>
</body>
</html>`;
}

/** 后台主页 */
export function adminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TVBox 源整理后台</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>TVBox 源自动整理</h1>
    <span class="badge" id="bgPipe">空闲</span>
    <span class="badge warn" id="bgPwd" style="display:none">使用默认密码</span>
    <span class="spacer"></span>
    <button class="ghost" id="btnLogout">退出登录</button>
  </header>
  <nav class="tabs" id="tabs"></nav>
  <main id="view"></main>
</div>
<div class="toast" id="toast"></div>
<script>
(function(){
'use strict';

var TABS=[['dash','数据看板'],['preview','源预览'],['sources','源地址清单'],['manual','手动源'],['lives','直播源'],['output','自动源编辑'],['subs','自定义订阅'],['config','配置'],['security','密码']];
var S={state:null,tv:null,av:null,tab:'dash',pollTimer:null};

var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

function req(method,path,body){
  var opt={method:method,headers:{},credentials:'same-origin'};
  if(body!==undefined){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  return fetch(path,opt).then(function(res){
    return res.text().then(function(txt){
      var data=null;
      try{ data=txt?JSON.parse(txt):null; }catch(e){ data=null; }
      if(res.status===401){ location.href='/admin'; throw new Error('未授权'); }
      if(!res.ok||!data||data.ok===false){ throw new Error((data&&data.error)||('HTTP '+res.status)); }
      return data.data;
    });
  });
}

function esc(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg,err){
  var el=$('#toast'); el.textContent=msg; el.className='toast show'+(err?' err':'');
  clearTimeout(el._t); el._t=setTimeout(function(){ el.className='toast'; },2800);
}
function download(name,text){
  var blob=new Blob([text],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}
function pickFile(cb){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){ try{ cb(JSON.parse(rd.result)); }catch(e){ toast('JSON 解析失败：'+e.message,true); } };
    rd.readAsText(f);
  };
  inp.click();
}
// 与后端 src/core/normalize.js 完全一致的稳定哈希与站点 id 算法
function stableHash(input){
  var h=2166136261>>>0, s=String(input);
  for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return h.toString(36);
}
function siteId(site){
  var api=typeof site.api==='string'?site.api:'';
  if(site.key) return site.key+'#'+stableHash(api);
  return 'h'+stableHash((site.name||'')+'|'+api+'|'+(site.type==null?'':site.type));
}
function fmtTime(iso){ if(!iso) return '—'; try{ return new Date(iso).toLocaleString('zh-CN'); }catch(e){ return String(iso); } }
function liveIdOf(l){ if(l&&l._id) return l._id; return 'lv_'+stableHash((l&&l.url)||''); }

// —— 在线测速（批量分片，每片 6 个地址，避免超出免费版单次子请求限额） ——
var SRCRES={};   // 源地址清单测试结果 url -> result
var LIVETEST={}; // 直播源清单测试结果 url -> result
function testBadge(r,src){
  if(!r) return '—';
  if(r.ok){
    var extra='';
    if(src){
      if(r.sites!=null) extra=' · '+r.sites+' 站点';
      else if(r.repos!=null) extra=' · '+r.repos+' 仓库';
      else if(src==='live'&&r.valid===false) return '<span class="lat slow" title="'+esc(r.error||'内容无效')+'">无效</span>';
    }
    return '<span class="lat fast">'+r.ms+'ms'+esc(extra)+'</span>';
  }
  return '<span class="lat slow" title="'+esc(r.error||'失败')+'">失败</span>';
}
function testUrls(kind,urls,resMap,statId,onBatch,onDone){
  var chunks=[];
  for(var i=0;i<urls.length;i+=6){ chunks.push(urls.slice(i,i+6)); }
  var total=urls.length, doneN=0;
  function next(){
    if(!chunks.length){ if(onDone) onDone(); return Promise.resolve(); }
    var batch=chunks.shift();
    return req('POST','/api/admin/test',{kind:kind,urls:batch}).then(function(d){
      (d.results||[]).forEach(function(r){ resMap[r.url]=r; });
      doneN+=batch.length;
      var st=document.getElementById(statId);
      if(st) st.textContent='测速中 '+doneN+'/'+total+' …';
      if(onBatch) onBatch();
      return next();
    });
  }
  return next();
}

// —— 加载与渲染 ——
function loadState(){
  return req('GET','/api/admin/state').then(function(d){ S.state=d; return d; });
}
function loadFiles(){
  // no-store：订阅文件带 Cache-Control: max-age=600，若用浏览器缓存，
  // 整理完成或改动后会被旧缓存挡住，导致「自动源编辑 / 直播源」显示过期数据。
  function file(path){
    return fetch(path,{credentials:'same-origin',cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  }
  var tvFn='tv', avFn='av';
  if(S.state&&S.state.config){ tvFn=S.state.config.tvFilename||'tv'; avFn=S.state.config.avFilename||'av'; }
  return Promise.all([file('/'+tvFn+'.json'),file('/'+avFn+'.json')]).then(function(r){ S.tv=r[0]; S.av=r[1]; });
}

function render(){
  $('#bgPwd').style.display=(S.state&&S.state.usingDefaultPassword)?'':'none';
  var p=S.state&&S.state.pipeline;
  $('#bgPipe').textContent=(p&&p.running)?(p.phase+' '+p.percent+'%'):'空闲';
  $('#bgPipe').className='badge'+((p&&p.running)?' warn':'');
  $('#tabs').innerHTML=TABS.map(function(t){ return '<button class="tab'+(S.tab===t[0]?' active':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>'; }).join('');
  if(S.tab==='dash') renderDash();
  else if(S.tab==='preview') renderPreview();
  else if(S.tab==='sources') renderSources();
  else if(S.tab==='manual') renderManual();
  else if(S.tab==='lives') renderLives();
  else if(S.tab==='output') renderOutput();
  else if(S.tab==='subs') renderSubs();
  else if(S.tab==='config'){ renderConfig(); updateIntervalHint(); }
  else if(S.tab==='security') renderSecurity();
}

function card(inner){ return '<div class="card">'+inner+'</div>'; }
function statsHtml(c){
  c=c||{};
  var items=[['源地址',c.sources],['抓取站点',c.sites],['测速',c.tested],['有效',c.alive],['失效',c.dead],['普通源',c.tv],['成人源',c.av],['直播源',c.live]];
  return '<div class="grid">'+items.map(function(it){ return '<div class="stat"><div class="k">'+it[0]+'</div><div class="v">'+(it[1]==null?'0':it[1])+'</div></div>'; }).join('')+'</div>';
}

// 数据看板
function renderDash(){
  var st=S.state||{}, lr=st.lastRun, p=st.pipeline;
  var html='';
  html+=card(
    '<h2>运行状态</h2>'+
    (p? ('<div class="row" style="margin-bottom:10px"><b id="phaseTxt">'+esc(p.phase)+'</b><span class="muted small">开始 '+fmtTime(p.startedAt)+' · 更新 '+fmtTime(p.updatedAt)+'</span></div>'+
          '<div class="progress"><i id="bar" style="width:'+p.percent+'%"></i></div>'+
          '<div class="muted small" style="margin-top:6px">进度 '+p.percent+'% · 源 '+p.sourceCursor+' · 分片 '+p.chunkCursor+'/'+p.chunkCount+' · 错误 '+(p.errorCount||0)+'</div>')
        : '<p class="muted">当前没有进行中的整理任务。</p>')+
    '<div class="toolbar" style="margin-top:14px">'+
      '<button data-act="start">立即执行整理</button>'+
      '<button class="ghost" data-act="step">继续执行</button>'+
      '<button class="ghost" data-act="force">强制重新执行</button>'+
      '<button class="ghost" data-act="reload">刷新</button>'+
    '</div>'+
    '<p class="muted small">免费版单次 CPU 有限，一次点击跑不完是正常的；可隔一会儿点「继续执行」，或依赖每 15 分钟的心跳自动续跑。</p>'
  );
  html+=subsLinksCard(st);
  html+=card('<h2>上次整理结果</h2>'+(lr? ('<div class="row" style="margin-bottom:10px"><span class="muted small">时间 '+fmtTime(lr.time)+' · 耗时 '+(lr.durationMs==null?'—':Math.round(lr.durationMs/1000)+'s')+' · 原因 '+esc(lr.reason||'')+' · 错误 '+(lr.errorCount||0)+'</span></div>'+statsHtml(lr.counts)) : '<p class="muted">尚无记录，请先执行一次整理。</p>'));
  if(lr&&lr.errors&&lr.errors.length){
    html+=card('<h2>最近错误（最多 50 条）</h2><div class="err-list">'+lr.errors.map(function(e){ return '<div class="log"><b>'+esc(e.message)+'</b><br><span class="muted">'+esc(e.url)+'</span></div>'; }).join('')+'</div>');
  }
  $('#view').innerHTML=html;
  schedulePoll();
}

// 源预览：只读展示 tv.json / av.json 中的源，支持分类切换、搜索、在线测速与手动排序
var PREV={cat:'tv',q:'',test:{},ids:null,sel:{}};
function renderPreview(){
  var html=card(
    '<h2>源预览 · 测速 · 排序</h2>'+
    '<p class="muted small">展示当前 tv.json / av.json 中的源（含手动源）。勾选后可对单个或多个源<b>在线测速</b>（结果临时显示，不写回配置）；用 ↑ / ↓ 调整顺序后点「保存排序」，<b>手动排序会持久保存，重新整理后依然生效</b>；未排序的源仍按测速速度排列。</p>'+
    '<div class="row" style="margin-bottom:12px">'+
      '<div class="seg" id="prevSeg">'+
        '<button class="seg-btn'+(PREV.cat==='tv'?' active':'')+'" data-cat="tv">普通源</button>'+
        '<button class="seg-btn'+(PREV.cat==='av'?' active':'')+'" data-cat="av">成人源</button>'+
      '</div>'+
      '<input id="prevQ" placeholder="搜索源名称 / 接口地址…" style="flex:1;min-width:160px" value="'+esc(PREV.q)+'">'+
      '<span class="muted small" id="prevCount"></span>'+
    '</div>'+
    '<div class="toolbar">'+
      '<label class="row small"><input type="checkbox" id="prevSelAll"> 全选</label>'+
      '<button class="ghost" data-act="test-sites-sel">测试所选</button>'+
      '<button class="ghost" data-act="test-sites-all">测速全部</button>'+
      '<button data-act="save-order">保存排序</button>'+
      '<button class="ghost" data-act="reset-order">重置排序</button>'+
      '<span class="muted small" id="prevStat"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr><th style="width:34px"></th><th style="width:44px">#</th><th>名称</th><th>接口 / 爬虫</th><th style="width:80px">类型</th><th style="width:130px">延迟 / 测速</th><th style="width:84px">排序</th></tr></thead>'+
      '<tbody id="prevRows"><tr><td colspan="7" class="muted" style="padding:18px">加载中…</td></tr></tbody>'+
    '</table></div>'
  );
  $('#view').innerHTML=html;
  renderPreviewTable();
}
function prevSites(){
  var file=PREV.cat==='av'?S.av:S.tv;
  var sites=(file&&Array.isArray(file.sites))?file.sites.slice():[];
  var q=PREV.q.trim().toLowerCase();
  if(q){
    sites=sites.filter(function(s){
      return String(s.name||'').toLowerCase().indexOf(q)>=0
        || String(s.api||'').toLowerCase().indexOf(q)>=0;
    });
  }
  if(PREV.ids){
    // 手动排序编辑中：登记过的按登记顺序排前，未登记的排最后（保持原有相对顺序）
    var idx={}; PREV.ids.forEach(function(id,i){ idx[id]=i; });
    sites.sort(function(a,b){
      var ia=idx[a._id||siteId(a)]; if(ia==null) ia=1e9;
      var ib=idx[b._id||siteId(b)]; if(ib==null) ib=1e9;
      return ia-ib;
    });
  }
  return sites;
}
function prevEnsureIds(){
  if(PREV.ids) return;
  // 首次排序时，以当前完整显示顺序（含被搜索隐藏的行）初始化
  var file=PREV.cat==='av'?S.av:S.tv;
  var sites=(file&&Array.isArray(file.sites))?file.sites:[];
  PREV.ids=sites.map(function(s){ return s._id||siteId(s); });
}
function prevMove(id,dir){
  prevEnsureIds();
  // 与搜索可见的相邻行交换，保证搜索状态下也能逐步移动
  var vis=prevSites().map(function(s){ return s._id||siteId(s); });
  var pos=vis.indexOf(id);
  var other=vis[pos+dir];
  if(pos<0||other==null) return;
  var i=PREV.ids.indexOf(id), j=PREV.ids.indexOf(other);
  PREV.ids[i]=other; PREV.ids[j]=id;
  renderPreviewTable();
}
function renderPreviewTable(){
  var sites=prevSites();
  $('#prevCount').textContent='共 '+sites.length+' 条';
  if(!sites.length){
    $('#prevRows').innerHTML='<tr><td colspan="7" class="muted" style="padding:18px">没有匹配的源。若尚未生成，请先在「数据看板」执行一次整理。</td></tr>';
    return;
  }
  $('#prevRows').innerHTML=sites.map(function(s,i){
    var id=s._id||siteId(s);
    var tip=s.api&&s.api.indexOf('csp_')===0?'csp_':(Number(s.type)===3?'type 3':(s.type==null?'—':'type '+s.type));
    var lat;
    var tr=PREV.test[s.api];
    if(tr) lat=testBadge(tr);
    else if(s._latency==null||!isFinite(s._latency)) lat='<span class="lat na">未测速</span>';
    else lat='<span class="lat '+(s._latency<400?'fast':(s._latency<1200?'mid':'slow'))+'">'+Math.round(s._latency)+' ms</span>';
    var testable=/^https?:/i.test(String(s.api||''));
    return '<tr data-id="'+esc(id)+'">'+
      '<td>'+(testable?'<input type="checkbox" class="prev-sel" data-url="'+esc(s.api)+'"'+(PREV.sel[s.api]?' checked':'')+'>':'')+'</td>'+
      '<td class="muted">'+(i+1)+'</td>'+
      '<td>'+esc(s.name||'(未命名)')+'</td>'+
      '<td class="mono">'+esc(s.api||'')+'</td>'+
      '<td><span class="pill">'+esc(tip)+'</span></td>'+
      '<td>'+lat+'</td>'+
      '<td class="tight">'+
        '<button class="ghost" data-act="ord-up" data-id="'+esc(id)+'" title="上移">↑</button>'+
        '<button class="ghost" data-act="ord-down" data-id="'+esc(id)+'" title="下移">↓</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var all=$('#prevSelAll');
  if(all){ all.checked=false; }
}

// 订阅链接：后台里直接给出可用的 TVBox 订阅地址
function subsLinksCard(st){
  var origin=location.origin;
  var cfg=(st&&st.config)||{};
  var tvFn=cfg.tvFilename||'tv';
  var avFn=cfg.avFilename||'av';
  var html='<h2>订阅链接</h2>'+
    '<p class="muted small">把下面的地址填入 TVBox 的「配置地址」即可使用。若域名是 workers.dev / pages.dev，国内通常无法访问，请先绑定自有域名。</p>'+
    linkBox('普通源',origin+'/'+tvFn+'.json')+
    linkBox('成人源',origin+'/'+avFn+'.json');
  var subs=(st&&st.subs)||[];
  var enabled=!(st&&st.config&&st.config.customFilesEnabled===false);
  if(subs.length&&enabled){
    subs.forEach(function(s){ html+=linkBox(s.title||s.name, origin+'/'+s.name+'.json'); });
  }
  return card(html);
}
function linkBox(label,url){
  return '<div class="link-box">'+
    '<span class="muted small" style="min-width:56px">'+esc(label)+'</span>'+
    '<code>'+esc(url)+'</code>'+
    '<button class="ghost" data-act="copy" data-text="'+esc(url)+'">复制</button>'+
    '<a href="'+esc(url)+'" download>下载</a>'+
  '</div>';
}

function schedulePoll(){
  clearTimeout(S.pollTimer);
  var p=S.state&&S.state.pipeline;
  if(!(p&&p.running)) return;
  S.pollTimer=setTimeout(function(){
    // 只在看板轮询：切到别的标签页时停止，否则重建 DOM 会冲掉正在编辑的内容
    if(S.tab!=='dash') return;
    loadState().then(render).catch(function(){});
  },4000);
}

// 源地址清单
var CATEGORY_SELECT='<td class="tight"><select name="category"><option value="auto">自动判断</option><option value="av">成人源</option><option value="tv">普通源</option></select></td>';
function renderSources(){
  var list=(S.state&&S.state.sources)||[];
  var rows=list.map(function(s,i){
    var cat=s.category==='av'||s.category==='tv'?s.category:'auto';
    return '<tr>'+
      '<td><input name="name" value="'+esc(s.name)+'" placeholder="备注名"></td>'+
      '<td><input name="url" value="'+esc(s.url)+'" placeholder="https://.../config.json"></td>'+
      '<td class="tight"><select name="category">'+
        '<option value="auto"'+(cat==='auto'?' selected':'')+'>自动判断</option>'+
        '<option value="av"'+(cat==='av'?' selected':'')+'>成人源</option>'+
        '<option value="tv"'+(cat==='tv'?' selected':'')+'>普通源</option>'+
      '</select></td>'+
      '<td class="tight"><input type="checkbox" name="enabled"'+(s.enabled!==false?' checked':'')+'></td>'+
      '<td class="small" data-testid="1">'+testBadge(SRCRES[s.url],true)+'</td>'+
      '<td class="tight"><button class="ghost" data-act="test-src" data-i="'+i+'" title="在线测试该源（下载+解密+解析）">测试</button></td>'+
      '<td class="tight"><button class="ghost" data-act="del-src" data-i="'+i+'">删除</button></td>'+
    '</tr>';
  }).join('');
  var html=card(
    '<h2>源地址清单</h2>'+
    '<p class="muted small">这些是「待下载整理」的源配置地址。<b>只要是 JSON 都会尽量读出内容</b>：标准 TVBox 单配置（含 sites）、多仓格式（含 urls）、以及各种「接口清单」（顶层数组或 data/list/items 里装着 name + api 的条目，会自动补上 type 变成可用站点）。</p>'+
    '<p class="muted small"><b>分类</b>：选「自动判断」时按关键字识别成人源；如果这个源里全是成人内容、关键字识别不准，直接选「成人源」，它下面的所有站点会强制写进 av.json（选「普通源」同理）。<b>测试</b>按钮可在线验证单个源：下载 + 自动解密 + 解析，显示耗时与可提取的站点/仓库数量；也可用「测试全部」批量验证。</p>'+
    '<table><thead><tr><th>备注</th><th>地址</th><th>分类</th><th>启用</th><th style="width:150px">测试结果</th><th style="width:60px">测试</th><th></th></tr></thead><tbody id="srcRows">'+rows+'</tbody></table>'+
    '<div class="toolbar" style="margin-top:12px">'+
      '<button class="ghost" data-act="add-src">新增一行</button>'+
      '<button data-act="save-src">保存清单</button>'+
      '<button class="ghost" data-act="import-src">导入 JSON</button>'+
      '<button class="ghost" data-act="export-src">导出 JSON</button>'+
      '<button class="ghost" data-act="test-src-all">测试全部</button>'+
      '<span class="muted small" id="srcStat"></span>'+
    '</div>'+
    '<h2 style="margin-top:22px">批量导入链接</h2>'+
    '<p class="muted small">每行一个地址。可只写地址，也可写成「备注名,地址」。支持一次粘贴几十条，追加到上面表格后再点「保存清单」。</p>'+
    '<textarea id="bulkSrc" rows="5" placeholder="我的成人源,https://xxx.com/config.json&#10;https://yyy.com/tv.json"></textarea>'+
    '<div class="toolbar" style="margin-top:8px">'+
      '<button class="ghost" data-act="bulk-src">追加到清单</button>'+
    '</div>'
  );
  $('#view').innerHTML=html;
}

function collectSources(){
  var out=[];
  $$('#srcRows tr').forEach(function(tr){
    var name=tr.querySelector('[name=name]').value.trim();
    var url=tr.querySelector('[name=url]').value.trim();
    var enabled=tr.querySelector('[name=enabled]').checked;
    var catEl=tr.querySelector('[name=category]');
    var category=catEl?catEl.value:'auto';
    if(url) out.push({name:name,url:url,enabled:enabled,category:category});
  });
  return out;
}

// 手动源（单文件，流水线永不覆盖）
function renderManual(){
  var m=(S.state&&S.state.manual)||{av:[],tv:[]};
  var html=card(
    '<h2>手动源 · 普通源 (tv)</h2>'+
    '<p class="muted small">手动添加/导入的源保存在一个 JSON 文件里，并会与自动整理结果一起出现在 tv.json / av.json 中；<b>系统自动更新时不会覆盖它</b>。</p>'+
    manualTable('tv', m.tv||[])+
    '<div class="toolbar" style="margin-top:10px">'+
      '<button class="ghost" data-act="add-manual" data-g="tv">新增一行</button>'+
    '</div>'
  );
  html+=card(
    '<h2>手动源 · 成人源 (av)</h2>'+
    '<p class="muted small">放在这里的条目会被视为成人源，写入 av.json。</p>'+
    manualTable('av', m.av||[])+
    '<div class="toolbar" style="margin-top:10px">'+
      '<button class="ghost" data-act="add-manual" data-g="av">新增一行</button>'+
    '</div>'
  );
  html+=card(
    '<h2>整体操作</h2>'+
    '<div class="toolbar">'+
      '<button data-act="save-manual">保存手动源</button>'+
      '<button class="ghost" data-act="import-manual">导入 JSON</button>'+
      '<button class="ghost" data-act="export-manual">导出手动源</button>'+
      '<button class="danger" data-act="clear-manual">清空手动源</button>'+
    '</div>'+
    '<p class="muted small">导入格式：{"tv":[{"name":"源名","api":"https://...","type":1}],"av":[...]}</p>'
  );
  $('#view').innerHTML=html;
}

function manualTable(g,list){
  var rows=list.map(function(s,i){
    return '<tr data-g="'+g+'" data-i="'+i+'">'+
      '<td><input name="name" value="'+esc(s.name)+'" placeholder="源名"></td>'+
      '<td><input name="api" value="'+esc(s.api)+'" placeholder="接口地址 / csp_ 爬虫"></td>'+
      '<td class="tight" style="width:90px"><input name="type" value="'+esc(s.type==null?'':s.type)+'" placeholder="type"></td>'+
      '<td><input name="ext" value="'+esc(s.ext)+'" placeholder="ext（可空）"></td>'+
      '<td class="tight"><button class="ghost" data-act="del-manual" data-g="'+g+'" data-i="'+i+'">删除</button></td>'+
    '</tr>';
  }).join('');
  return '<table><thead><tr><th>名称</th><th>接口/爬虫</th><th>type</th><th>ext</th><th></th></tr></thead><tbody data-tbody="'+g+'">'+rows+'</tbody></table>';
}

function collectManualGroup(g){
  var out=[];
  $$('tbody[data-tbody='+g+'] tr').forEach(function(tr){
    var name=tr.querySelector('[name=name]').value.trim();
    var api=tr.querySelector('[name=api]').value.trim();
    var typeRaw=tr.querySelector('[name=type]').value.trim();
    var ext=tr.querySelector('[name=ext]').value.trim();
    if(!api) return;
    var item={name:name,api:api};
    if(typeRaw!=='' && !isNaN(Number(typeRaw))) item.type=Number(typeRaw);
    if(ext) item.ext=ext;
    out.push(item);
  });
  return out;
}

// 直播源（自动检测有效后按速度并入 tv.json）
function renderLives(){
  var list=(S.state&&S.state.lives)||[];
  var liveEnabled=(S.state&&S.state.config&&S.state.config.liveEnabled)!==false;
  var rows=list.map(function(l,i){
    return '<tr data-i="'+i+'">'+
      '<td><input name="name" value="'+esc(l.name)+'" placeholder="直播源名"></td>'+
      '<td><input name="url" class="mono" value="'+esc(l.url)+'" placeholder="https://user:pass@host/...m3u"></td>'+
      '<td class="tight" style="width:80px"><input name="type" value="'+esc(l.type==null?'':l.type)+'" placeholder="type"></td>'+
      '<td><input name="ua" class="mono" value="'+esc(l.ua)+'" placeholder="UA（可空，留空用全局）"></td>'+
      '<td><input name="epg" value="'+esc(l.epg)+'" placeholder="EPG（可空）"></td>'+
      '<td class="tight"><input type="checkbox" name="enabled"'+(l.enabled!==false?' checked':'')+'></td>'+
      '<td class="small" data-testid="1">'+testBadge(LIVETEST[l.url],'live')+'</td>'+
      '<td class="tight"><button class="ghost" data-act="test-live" data-i="'+i+'" title="在线测试该直播源">测试</button></td>'+
      '<td class="tight"><button class="ghost" data-act="live-up" data-i="'+i+'" title="上移">↑</button><button class="ghost" data-act="live-down" data-i="'+i+'" title="下移">↓</button></td>'+
      '<td class="tight"><button class="ghost" data-act="del-live" data-i="'+i+'">删除</button></td>'+
    '</tr>';
  }).join('');
  var html=card(
    '<h2>直播源清单</h2>'+
    '<p class="muted small">这些直播源会在整理时被自动下载检测：<b>只有检测正常的才会写入 tv.json 的 lives 数组，并按检测速度（毫秒）升序排列</b>。'+
      'URL 支持 <code>https://user:pass@host/path</code> 形式的加密连接（自动转为 Basic Auth）。'+
      '每行可单独设置 UA（留空用配置里的全局 UA）。'+
      (liveEnabled?'':'<b>（当前配置已关闭直播源自动更新）</b>')+'</p>'+
    '<table><thead><tr><th>名称</th><th>地址</th><th style="width:60px">type</th><th style="width:200px">UA（可空）</th><th>EPG</th><th style="width:44px">启用</th><th style="width:110px">测试结果</th><th style="width:60px">测试</th><th style="width:80px">排序</th><th></th></tr></thead><tbody id="liveRows">'+rows+'</tbody></table>'+
    '<div class="toolbar" style="margin-top:12px">'+
      '<button class="ghost" data-act="add-live">新增一行</button>'+
      '<button data-act="save-lives">保存清单</button>'+
      '<button class="ghost" data-act="import-live">导入 JSON</button>'+
      '<button class="ghost" data-act="export-live">导出 JSON</button>'+
      '<button class="ghost" data-act="test-live-all">测试全部</button>'+
      '<span class="muted small" id="liveStat"></span>'+
    '</div>'+
    '<h2 style="margin-top:22px">批量导入直播源</h2>'+
    '<p class="muted small">每行一个地址。可只写地址，也可写成「备注名,地址」。追加到上面表格后再点「保存清单」。</p>'+
    '<textarea id="bulkLive" rows="4" placeholder="央视直播,https://xxx.com/live.m3u&#10;https://yyy.com/tv.txt"></textarea>'+
    '<div class="toolbar" style="margin-top:8px">'+
      '<button class="ghost" data-act="bulk-live">追加到清单</button>'+
    '</div>'
  );
  html+=liveResultCard();
  $('#view').innerHTML=html;
}

function liveResultCard(){
  var tv=S.tv;
  var lives=(tv&&Array.isArray(tv.lives))?tv.lives:[];
  if(!lives.length){
    return card('<h2>当前 tv.json 中的直播源</h2><p class="muted">暂无。执行一次整理并完成检测后，这里会列出已并入的直播源。</p>');
  }
  var rows=lives.map(function(l,i){
    var id=liveIdOf(l);
    return '<tr data-id="'+esc(id)+'">'+
      '<td class="muted">'+(i+1)+'</td>'+
      '<td>'+esc(l.name)+'</td>'+
      '<td class="mono">'+esc(l.url)+'</td>'+
      '<td class="tight">'+esc(l.type==null?'':l.type)+'</td>'+
      '<td class="tight muted small">'+(typeof l._latency==='number'?l._latency+'ms':'未测速')+'</td>'+
      '<td class="tight"><button class="ghost" data-act="lvord-up" title="上移">↑</button><button class="ghost" data-act="lvord-down" title="下移">↓</button></td>'+
    '</tr>';
  }).join('');
  return card(
    '<h2>当前 tv.json 中的直播源（共 '+lives.length+' 条）</h2>'+
    '<p class="muted small">默认按检测速度升序排列。用「↑ / ↓」调整顺序后点「保存直播排序」，<b>手动排序会持久保存，重新整理后依然生效</b>。</p>'+
    '<table><thead><tr><th style="width:40px">#</th><th>名称</th><th>地址</th><th style="width:60px">type</th><th style="width:80px">速度</th><th style="width:80px">排序</th></tr></thead><tbody id="tvLiveRows">'+rows+'</tbody></table>'+
    '<div class="toolbar" style="margin-top:10px">'+
      '<button data-act="lvord-save">保存直播排序</button>'+
      '<button class="ghost" data-act="lvord-reset">重置直播排序</button>'+
      '<span class="muted small" id="lvordStat"></span>'+
    '</div>'
  );
}

// 表格行上移/下移（DOM 移动，保存时按 DOM 顺序收集）
function moveRowUp(tr){ if(tr&&tr.previousElementSibling) tr.parentNode.insertBefore(tr,tr.previousElementSibling); }
function moveRowDown(tr){ if(tr&&tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling,tr); }

function collectLives(){
  var out=[];
  $$('#liveRows tr').forEach(function(tr){
    var name=tr.querySelector('[name=name]').value.trim();
    var url=tr.querySelector('[name=url]').value.trim();
    var typeRaw=tr.querySelector('[name=type]').value.trim();
    var ua=tr.querySelector('[name=ua]').value.trim();
    var epg=tr.querySelector('[name=epg]').value.trim();
    var enabled=tr.querySelector('[name=enabled]').checked;
    if(!url) return;
    var item={name:name,url:url,enabled:enabled};
    if(typeRaw!=='' && !isNaN(Number(typeRaw))) item.type=Number(typeRaw);
    if(ua) item.ua=ua;
    if(epg) item.epg=epg;
    out.push(item);
  });
  return out;
}

// 自动源编辑（overrides / blocklist）
function renderOutput(){
  var st=S.state||{}, ov=st.overrides||{}, bl=st.blocklist||[];
  var blSet={}; bl.forEach(function(x){ blSet[x]=true; });
  var manualIds={};
  var mm=st.manual||{av:[],tv:[]};
  (mm.av||[]).concat(mm.tv||[]).forEach(function(s){ manualIds[siteId(s)]=true; });

  var rows=[];
  function collect(file,cat){
    if(!file||!Array.isArray(file.sites)) return;
    file.sites.forEach(function(s){
      var id=s._id||siteId(s);
      if(manualIds[id]) return;
      if(blSet[id]) return;
      rows.push({id:id,cat:cat,s:s,edited:!!ov[id]});
    });
  }
  collect(S.tv,'tv'); collect(S.av,'av');

  var body=rows.map(function(r){
    var s=r.s, patch=ov[r.id]||{};
    var name=patch.name!==undefined?patch.name:s.name;
    var api=patch.api!==undefined?patch.api:s.api;
    var cat=patch.category||r.cat;
    var origCat=r.cat;
    return '<tr data-id="'+esc(r.id)+'" data-oname="'+esc(s.name)+'" data-oapi="'+esc(s.api)+'" data-ocat="'+origCat+'">'+
      '<td><input name="name" value="'+esc(name)+'"></td>'+
      '<td><input name="api" class="mono" value="'+esc(api)+'"></td>'+
      '<td class="tight" style="width:110px"><select name="cat">'+
        '<option value="tv"'+(cat==='tv'?' selected':'')+'>普通</option>'+
        '<option value="av"'+(cat==='av'?' selected':'')+'>成人</option>'+
      '</select></td>'+
      '<td class="tight muted small">'+(s._latency==null?'—':s._latency+'ms')+'</td>'+
      '<td class="tight">'+(r.edited?'<span class="badge">已改</span> ':'')+'<button class="ghost" data-act="hide" data-id="'+esc(r.id)+'">删除</button></td>'+
    '</tr>';
  }).join('');

  var ovList=Object.keys(ov);
  var html=card(
    '<h2>自动源编辑</h2>'+
    '<p class="muted small">下面是当前 tv.json / av.json 里的自动源（不含手动源）。修改名称/接口/分类会写入 overrides，删除会写入 blocklist，<b>重新整理后依然生效</b>。</p>'+
    '<div class="toolbar">'+
      '<button data-act="save-output">保存修改</button>'+
      '<button class="ghost" data-act="reload-output">刷新列表</button>'+
    '</div>'+
    (rows.length? '<table><thead><tr><th>名称</th><th>接口</th><th>分类</th><th>延迟</th><th></th></tr></thead><tbody id="outRows">'+body+'</tbody></table>'
                : '<p class="muted">暂无自动源，请先在「数据看板」执行一次整理。</p>')+
    '<p class="muted small" style="margin-top:10px">本次将提交 '+rows.length+' 条待管理项；已修改 '+ovList.length+' 条，已删除 '+bl.length+' 条。</p>'
  );

  if(ovList.length){
    html+=card('<h2>已修改（overrides）</h2>'+ovList.map(function(id){
      return '<span class="chip mono">'+esc(id)+'<button data-act="clear-ov" data-id="'+esc(id)+'">清除</button></span>';
    }).join(''));
  }
  if(bl.length){
    html+=card('<h2>已删除（blocklist）</h2><p class="muted small">「恢复」将源放回输出列表；「彻底删除」立即从当前 tv.json / av.json 中移除该源，并永久拦截自动整理重新加入。</p>'+
      '<div class="toolbar" style="margin-top:10px;margin-bottom:10px">'+
        '<button class="danger" data-act="clear-blocklist">全部清除（共 '+bl.length+' 条）</button>'+
      '</div>'+
      bl.map(function(id){
      return '<span class="chip mono">'+esc(id)+
        '<button data-act="unblock" data-id="'+esc(id)+'">恢复</button>'+
        '<button class="danger" data-act="purge" data-id="'+esc(id)+'">彻底删除</button>'+
        '</span>';
    }).join(''));
  }
  $('#view').innerHTML=html;
}

// 自定义订阅
function renderSubs(){
  var subs=(S.state&&S.state.subs)||[];
  var enabled=(S.state&&S.state.config&&S.state.config.customFilesEnabled)!==false;
  var rows=subs.map(function(s,i){
    return '<tr data-i="'+i+'">'+
      '<td><input name="name" class="mono" value="'+esc(s.name)+'" placeholder="xxx（= /xxx.json）"></td>'+
      '<td><input name="title" value="'+esc(s.title)+'" placeholder="订阅标题"></td>'+
      '<td class="tight"><input type="checkbox" name="tv"'+(s.includeTv!==false?' checked':'')+'></td>'+
      '<td class="tight"><input type="checkbox" name="av"'+(s.includeAv?' checked':'')+'></td>'+
      '<td><input name="keywords" value="'+esc(s.keywords)+'" placeholder="按名称过滤，逗号分隔（可空）"></td>'+
      '<td class="tight"><button class="ghost" data-act="del-sub" data-i="'+i+'">删除</button></td>'+
    '</tr>';
  }).join('');
  var html=card(
    '<h2>自定义订阅文件</h2>'+
    '<p class="muted small">创建一个自定义命名的订阅文件，可直接给 TVBox 使用：/名称.json。名称只能包含字母、数字、_、-，且不能是保留名。'+(enabled?'':'<b>（当前配置已关闭自定义订阅）</b>')+'</p>'+
    '<table><thead><tr><th>名称</th><th>标题</th><th>含普通</th><th>含成人</th><th>关键字过滤</th><th></th></tr></thead><tbody id="subRows">'+rows+'</tbody></table>'+
    '<div class="toolbar" style="margin-top:12px">'+
      '<button class="ghost" data-act="add-sub">新增一行</button>'+
      '<button data-act="save-subs">保存</button>'+
    '</div>'
  );
  if(subs.length){
    html+=card('<h2>订阅链接</h2>'+subs.map(function(s){
      return '<div class="link-box"><code>'+esc(location.origin+'/'+s.name+'.json')+'</code><button class="ghost" data-act="copy" data-text="'+esc(location.origin+'/'+s.name+'.json')+'">复制</button></div>';
    }).join(''));
  }
  $('#view').innerHTML=html;
}

function collectSubs(){
  var out=[];
  $$('#subRows tr').forEach(function(tr){
    var name=tr.querySelector('[name=name]').value.trim();
    if(!name) return;
    out.push({
      name:name,
      title:tr.querySelector('[name=title]').value.trim(),
      includeTv:tr.querySelector('[name=tv]').checked,
      includeAv:tr.querySelector('[name=av]').checked,
      keywords:tr.querySelector('[name=keywords]').value.trim()
    });
  });
  return out;
}

// 配置
function monthRange(){ var out=[]; for(var i=1;i<=12;i++){ out.push(i); } return out; }
var MONTH_LABELS={}; (function(){ for(var i=1;i<=12;i++){ MONTH_LABELS[i]=i+'月'; } })();
function dayRange(){ var out=[]; for(var i=1;i<=31;i++){ out.push(i); } return out; }
var DAY_OF_MONTH_LABELS={}; (function(){ for(var i=1;i<=31;i++){ DAY_OF_MONTH_LABELS[i]=i+'日'; } })();
function pad2(v){ v=String(v); return v.length<2?'0'+v:v; }
function hourRange(){ var out=[]; for(var i=0;i<24;i++){ out.push(i); } return out; }
function optionList(list,selected,labels){
  return list.map(function(v){
    return '<option value="'+v+'"'+(Number(selected)===v?' selected':'')+'>'+(labels&&labels[v]!=null?labels[v]:pad2(v))+'</option>';
  }).join('');
}

function renderConfig(){
  var c=(S.state&&S.state.config)||{};
  var kw=Array.isArray(c.adultKeywords)?c.adultKeywords.join(','):'';
  var au=c.autoUpdate||{};
  var auMode=au.mode==='datetime'?'datetime':'interval';
  var intervalHours=au.intervalHours==null?168:Number(au.intervalHours);
  var html=card(
    '<h2>自动更新时间</h2>'+
    '<p class="muted small">支持两种模式：<b>间隔模式</b>每隔 N 小时自动整理一次；<b>指定时间</b>在每年某月某日某时某分执行。到点检测由每 15 分钟一次的心跳任务完成。</p>'+
    '<div class="row" style="margin-bottom:10px">'+
      '<label class="row small"><input type="checkbox" id="au"'+(au.enabled!==false?' checked':'')+'> 启用自动更新</label>'+
    '</div>'+
    '<div class="row" style="margin-bottom:12px">'+
      '<div class="seg" id="auMode">'+
        '<button class="seg-btn'+(auMode==='interval'?' active':'')+'" data-mode="interval">间隔模式</button>'+
        '<button class="seg-btn'+(auMode==='datetime'?' active':'')+'" data-mode="datetime">指定时间</button>'+
      '</div>'+
    '</div>'+
    // 间隔模式
    '<div id="auIntervalPanel" style="display:'+(auMode==='interval'?'block':'none')+'">'+
      '<p class="muted small">选择预设间隔，或在下方输入自定义小时数：</p>'+
      '<div class="row" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">'+
        '<button type="button" class="au-preset" data-hours="12">12 小时</button>'+
        '<button type="button" class="au-preset" data-hours="24">1 天</button>'+
        '<button type="button" class="au-preset" data-hours="168">1 周</button>'+
        '<button type="button" class="au-preset" data-hours="360">半个月</button>'+
        '<button type="button" class="au-preset" data-hours="720">1 个月</button>'+
      '</div>'+
      '<div class="grid">'+
        '<div class="stat"><div class="k">间隔小时数</div><input type="number" id="auInterval" min="1" max="8784" value="'+intervalHours+'"></div>'+
      '</div>'+
      '<p class="muted small" style="margin-top:8px" id="auIntervalHint"></p>'+
    '</div>'+
    // 指定时间模式
    '<div id="auDatetimePanel" style="display:'+(auMode==='datetime'?'block':'none')+'">'+
      '<div class="grid">'+
        '<div class="stat"><div class="k">月份</div><select id="auMonth">'+optionList(monthRange(), au.month==null?1:au.month, MONTH_LABELS)+'</select></div>'+
        '<div class="stat"><div class="k">日期</div><select id="auDay">'+optionList(dayRange(), au.day==null?1:au.day, DAY_OF_MONTH_LABELS)+'</select></div>'+
        '<div class="stat"><div class="k">小时</div><select id="auHour">'+optionList(hourRange(), au.hour==null?11:au.hour)+'</select></div>'+
        '<div class="stat"><div class="k">分钟</div><select id="auMin">'+optionList([0,15,30,45], au.minute==null?0:au.minute)+'</select></div>'+
      '</div>'+
      '<p class="muted small" style="margin-top:10px">指定时间为<b>北京时间</b>，分钟只能选 0 / 15 / 30 / 45。若设定的「几号」超过当月天数，自动取当月最后一天。</p>'+
    '</div>'+
    '<p class="muted small" style="margin-top:10px">改完点最下方的「保存配置」生效，不需要重新部署。</p>'
  );
  html+=card(
    '<h2>直播源自动更新</h2>'+
    '<p class="muted small">开启后，整理时会把「直播源」页里的地址逐个下载检测：<b>检测正常的才写入 tv.json 的 lives，并按速度升序排列</b>。正文短于长度下限、请求失败或返回 HTML 的视为失效，不会写入。</p>'+
    '<div class="row" style="margin-bottom:10px">'+
      '<label class="row small"><input type="checkbox" id="lvEn"'+(c.liveEnabled!==false?' checked':'')+'> 启用直播源自动更新</label>'+
    '</div>'+
    '<div class="grid">'+
      cfgField('liveTimeoutMs','直播源超时(ms)',c.liveTimeoutMs)+
      cfgField('liveMinBytes','正文长度下限(字节)',c.liveMinBytes)+
    '</div>'
  );
  html+=card(
    '<h2>成人源识别关键字</h2>'+
    '<p class="muted small">逗号或换行分隔；中文按子串匹配，拉丁字母按词边界匹配（避免 av 命中 java）。</p>'+
    '<textarea id="kw">'+esc(kw)+'</textarea>'
  );
  html+=card(
    '<h2>输出订阅文件名</h2>'+
    '<p class="muted small">默认输出为 <code>/tv.json</code> 和 <code>/av.json</code>，可在此修改为任意名称（如 <code>a07v</code>），TVBox 里的配置地址相应改为 <code>/a07v.json</code>。只允许字母、数字、下划线、短横线，不能与自定义订阅重名。</p>'+
    '<div class="grid">'+
      cfgField('tvFilename','普通源文件名（不含 .json）',c.tvFilename||'tv')+
      cfgField('avFilename','成人源文件名（不含 .json）',c.avFilename||'av')+
    '</div>'
  );
  html+=card(
    '<h2>抓取与测速参数</h2>'+
    '<div class="grid">'+
      '<div class="stat" style="grid-column:span 2"><div class="k">全局 User-Agent（下载 / 测速 / 直播源探测均使用）</div><input name="userAgent" value="'+esc(c.userAgent||'okhttp/4.9.0')+'"></div>'+
      cfgField('fetchTimeoutMs','下载超时(ms)',c.fetchTimeoutMs)+
      cfgField('probeTimeoutMs','测速超时(ms)',c.probeTimeoutMs)+
      cfgField('probeConcurrency','测速并发(1-5)',c.probeConcurrency)+
      cfgField('chunkSize','每分片站点数',c.chunkSize)+
      cfgField('maxSites','单源最大站点',c.maxSites)+
      cfgField('maxRepos','多仓最大数量',c.maxRepos)+
      cfgField('tickSubrequestBudget','单次子请求预算',c.tickSubrequestBudget)+
      cfgField('heartbeatSubrequestBudget','心跳子请求预算',c.heartbeatSubrequestBudget)+
      cfgField('tickTimeBudgetMs','单次时间预算(ms)',c.tickTimeBudgetMs)+
    '</div>'+
    '<p class="muted small">Cloudflare 免费版单次调用仅 50 个外部子请求，故默认按免费版预置（45 / 40），整理全靠心跳分段续跑；升级到付费版（10000/次）后可把「单次子请求预算」调到 9000 左右一次跑完。注意别超过 50，否则单次调用会报错。</p>'+
    '<div class="row" style="margin-top:12px">'+
      '<label class="row small"><input type="checkbox" id="hb"'+(c.heartbeatEnabled!==false?' checked':'')+'> 启用心跳续跑</label>'+
      '<label class="row small"><input type="checkbox" id="cf"'+(c.customFilesEnabled!==false?' checked':'')+'> 启用自定义订阅</label>'+
    '</div>'+
    '<div class="toolbar" style="margin-top:14px">'+
      '<button data-act="save-config">保存配置</button>'+
      '<button class="ghost" data-act="reset-config">恢复默认值</button>'+
    '</div>'
  );
  $('#view').innerHTML=html;
}
function cfgField(name,label,val){
  return '<div class="stat"><div class="k">'+label+'</div><input name="'+name+'" value="'+esc(val==null?'':val)+'"></div>';
}

function collectConfig(){
  var cfg={};
  var STRING_FIELDS={'userAgent':true,'tvFilename':true,'avFilename':true};
  $$('#view input[name]').forEach(function(inp){
    var n=inp.getAttribute('name');
    if(inp.type==='checkbox'){ cfg[n]=inp.checked; return; }
    var v=inp.value.trim();
    if(STRING_FIELDS[n]){ cfg[n]=v; return; }
    cfg[n]=v===''?undefined:Number(v);
  });
  cfg.adultKeywords=$('#kw').value.split(/[,，、\\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
  cfg.heartbeatEnabled=$('#hb').checked;
  cfg.customFilesEnabled=$('#cf').checked;
  cfg.liveEnabled=$('#lvEn').checked;
  cfg.autoUpdate={
    enabled:$('#au').checked,
    mode:$('#auMode .seg-btn.active').getAttribute('data-mode'),
    intervalHours:Math.max(1,Math.min(8784,Math.round(Number($('#auInterval').value)||168))),
    month:Number($('#auMonth').value),
    day:Number($('#auDay').value),
    hour:Number($('#auHour').value),
    minute:Number($('#auMin').value)
  };
  return cfg;
}

// 密码
function renderSecurity(){
  $('#view').innerHTML=card(
    '<h2>修改管理密码</h2>'+
    (S.state&&S.state.usingDefaultPassword?'<p class="muted small" style="color:var(--warn)">当前仍在使用默认密码，请尽快修改。</p>':'')+
    '<div class="grid">'+
      '<div class="stat"><div class="k">当前密码</div><input type="password" id="curPwd" autocomplete="current-password"></div>'+
      '<div class="stat"><div class="k">新密码（≥6 位）</div><input type="password" id="newPwd" autocomplete="new-password"></div>'+
    '</div>'+
    '<div class="toolbar" style="margin-top:14px"><button data-act="change-pwd">修改密码</button></div>'
  );
}

// —— 动作 ——
$('#tabs').addEventListener('click',function(e){
  var b=e.target.closest('[data-tab]'); if(!b) return;
  S.tab=b.getAttribute('data-tab'); render();
});

$('#btnLogout').addEventListener('click',function(){
  req('POST','/api/admin/logout').then(function(){ location.href='/admin'; }).catch(function(){ location.href='/admin'; });
});

$('#view').addEventListener('click',function(e){
  var seg=e.target.closest('#prevSeg .seg-btn');
  if(seg){
    PREV.cat=seg.getAttribute('data-cat');
    $$('#prevSeg .seg-btn').forEach(function(b){ b.classList.toggle('active',b===seg); });
    PREV.ids=null;   // 切换分类时清除排序编辑状态
    PREV.sel={};     // 清除勾选状态
    renderPreviewTable();
    return;
  }
  // 自动更新模式切换
  var auSeg=e.target.closest('#auMode .seg-btn');
  if(auSeg){
    $$('#auMode .seg-btn').forEach(function(b){ b.classList.toggle('active',b===auSeg); });
    var mode=auSeg.getAttribute('data-mode');
    var iv=document.getElementById('auIntervalPanel');
    var dt=document.getElementById('auDatetimePanel');
    if(iv) iv.style.display=mode==='interval'?'block':'none';
    if(dt) dt.style.display=mode==='datetime'?'block':'none';
    return;
  }
  // 间隔预设按钮
  var preset=e.target.closest('.au-preset');
  if(preset){
    var h=Number(preset.getAttribute('data-hours'));
    var inp=document.getElementById('auInterval');
    if(inp){ inp.value=h; updateIntervalHint(); }
    return;
  }
  var b=e.target.closest('[data-act]'); if(!b) return;
  var act=b.getAttribute('data-act');
  handle(act,b).catch(function(err){ toast(err.message||String(err),true); });
});

$('#view').addEventListener('input',function(e){
  var inp=e.target.closest('#prevQ');
  if(inp){ PREV.q=inp.value; renderPreviewTable(); return; }
  var auInp=e.target.closest('#auInterval');
  if(auInp){ updateIntervalHint(); return; }
});

$('#view').addEventListener('change',function(e){
  if(e.target&&e.target.id==='prevSelAll'){
    $$('#prevRows input.prev-sel').forEach(function(c){
      c.checked=e.target.checked;
      PREV.sel[c.getAttribute('data-url')]=e.target.checked;
    });
    return;
  }
  if(e.target&&e.target.classList&&e.target.classList.contains('prev-sel')){
    PREV.sel[e.target.getAttribute('data-url')]=e.target.checked;
  }
});

// 将间隔小时数转成可读描述
function formatInterval(hours){
  hours=Math.max(1,Math.min(8784,Math.round(Number(hours)||1)));
  if(hours<24) return hours+' 小时';
  var days=hours/24;
  if(hours%24===0){
    if(days===7) return '1 周（168 小时）';
    if(days===14) return '2 周（336 小时）';
    if(days===15) return '半个月（360 小时）';
    if(days===30) return '1 个月（720 小时）';
    if(days===1) return '1 天（24 小时）';
    return days+' 天（'+hours+' 小时）';
  }
  return hours+' 小时（约 '+days.toFixed(1)+' 天）';
}
function updateIntervalHint(){
  var inp=document.getElementById('auInterval');
  var hint=document.getElementById('auIntervalHint');
  if(inp&&hint) hint.textContent='当前间隔：'+formatInterval(inp.value);
}

function handle(act,btn){
  if(act==='reload'){ return loadState().then(render); }

  if(act==='start') return runPipeline('start');
  if(act==='force') return runPipeline('start?force=1');
  if(act==='step') return runPipeline('step');

  // —— 源预览：站点在线测速（单个勾选 / 全部） ——
  if(act==='test-sites-sel'||act==='test-sites-all'){
    var turls;
    if(act==='test-sites-sel'){
      turls=$$('#prevRows input.prev-sel').filter(function(c){ return c.checked; }).map(function(c){ return c.getAttribute('data-url'); }).filter(Boolean);
      if(!turls.length){ toast('请先勾选要测试的源（单个或多个均可）'); return Promise.resolve(); }
    }else{
      turls=prevSites().map(function(s){ return s.api; }).filter(function(u){ return /^https?:/i.test(String(u||'')); }).slice(0,60);
      if(!turls.length){ toast('没有可测试的接口地址（csp_ 爬虫需本地解析，无法在线测速）'); return Promise.resolve(); }
    }
    var tst=document.getElementById('prevStat'); if(tst) tst.textContent='准备测速…';
    return testUrls('site',turls,PREV.test,'prevStat',function(){ renderPreviewTable(); },function(){
      var s2=document.getElementById('prevStat');
      if(s2) s2.textContent='测速完成（结果临时显示，不写回配置）';
    });
  }
  // —— 源预览：手动排序（↑/↓ 交换，保存到后台持久化） ——
  if(act==='ord-up'){ prevMove(btn.getAttribute('data-id'),-1); return Promise.resolve(); }
  if(act==='ord-down'){ prevMove(btn.getAttribute('data-id'),1); return Promise.resolve(); }
  if(act==='save-order'){
    prevEnsureIds();
    if(!PREV.ids.length){ toast('当前分类没有源'); return Promise.resolve(); }
    return req('POST','/api/admin/order',{kind:PREV.cat,ids:PREV.ids}).then(function(){
      toast('排序已保存并写入当前订阅文件，重新整理后依然生效');
      PREV.ids=null;
      return loadFiles().then(render);
    });
  }
  if(act==='reset-order'){
    return req('POST','/api/admin/order',{kind:PREV.cat,ids:[]}).then(function(){
      toast('已恢复默认排序（按测速速度）');
      PREV.ids=null;
      return loadFiles().then(render);
    });
  }

  // —— 源地址清单：单条 / 全部在线测试（下载+解密+解析） ——
  if(act==='test-src'){
    var row=btn.closest('tr');
    var surl=row.querySelector('[name=url]').value.trim();
    if(!/^https?:/i.test(surl)){ toast('请先填写有效的源地址（http/https）'); return Promise.resolve(); }
    var scell=row.querySelector('[data-testid]');
    if(scell) scell.innerHTML='<span class="lat na">测试中…</span>';
    return req('POST','/api/admin/test',{kind:'source',urls:[surl]}).then(function(d){
      var r=(d.results||[])[0]||{ok:false,error:'无结果'};
      SRCRES[surl]=r;
      if(scell) scell.innerHTML=testBadge(r,true);
    });
  }
  if(act==='test-src-all'){
    var surls=[];
    $$('#srcRows tr').forEach(function(tr){
      var u=tr.querySelector('[name=url]').value.trim();
      if(/^https?:/i.test(u)) surls.push(u);
    });
    if(!surls.length){ toast('清单里没有有效的源地址'); return Promise.resolve(); }
    if(surls.length>60){ surls=surls.slice(0,60); toast('地址较多，本次测试前 60 条'); }
    var sst=document.getElementById('srcStat'); if(sst) sst.textContent='准备测速…';
    return testUrls('source',surls,SRCRES,'srcStat',function(){
      $$('#srcRows tr').forEach(function(tr){
        var u=tr.querySelector('[name=url]').value.trim();
        var c=tr.querySelector('[data-testid]');
        if(c&&SRCRES[u]) c.innerHTML=testBadge(SRCRES[u],true);
      });
    },function(){
      var s2=document.getElementById('srcStat');
      if(s2) s2.textContent='测试完成';
    });
  }

  // —— 直播源清单：单条 / 全部在线测试 ——
  if(act==='test-live'){
    var lrow=btn.closest('tr');
    var lurl=lrow.querySelector('[name=url]').value.trim();
    if(!/^https?:/i.test(lurl)){ toast('请先填写有效的直播源地址'); return Promise.resolve(); }
    var lcell=lrow.querySelector('[data-testid]');
    if(lcell) lcell.innerHTML='<span class="lat na">测试中…</span>';
    return req('POST','/api/admin/test',{kind:'live',urls:[lurl]}).then(function(d){
      var r=(d.results||[])[0]||{ok:false,error:'无结果'};
      LIVETEST[lurl]=r;
      if(lcell) lcell.innerHTML=testBadge(r,'live');
    });
  }
  if(act==='test-live-all'){
    var lurls=[];
    $$('#liveRows tr').forEach(function(tr){
      var u=tr.querySelector('[name=url]').value.trim();
      if(/^https?:/i.test(u)) lurls.push(u);
    });
    if(!lurls.length){ toast('清单里没有有效的直播源地址'); return Promise.resolve(); }
    if(lurls.length>60){ lurls=lurls.slice(0,60); toast('地址较多，本次测试前 60 条'); }
    var lst=document.getElementById('liveStat'); if(lst) lst.textContent='准备测速…';
    return testUrls('live',lurls,LIVETEST,'liveStat',function(){
      $$('#liveRows tr').forEach(function(tr){
        var u=tr.querySelector('[name=url]').value.trim();
        var c=tr.querySelector('[data-testid]');
        if(c&&LIVETEST[u]) c.innerHTML=testBadge(LIVETEST[u],'live');
      });
    },function(){
      var s2=document.getElementById('liveStat');
      if(s2) s2.textContent='测试完成';
    });
  }
  // —— 直播源清单：行上移/下移（DOM 移动，保存清单后生效） ——
  if(act==='live-up'){ moveRowUp(btn.closest('tr')); return Promise.resolve(); }
  if(act==='live-down'){ moveRowDown(btn.closest('tr')); return Promise.resolve(); }

  // —— tv.json 直播源：手动排序（持久化） ——
  if(act==='lvord-up'){ moveRowUp(btn.closest('tr')); return Promise.resolve(); }
  if(act==='lvord-down'){ moveRowDown(btn.closest('tr')); return Promise.resolve(); }
  if(act==='lvord-save'){
    var lids=$$('#tvLiveRows tr').map(function(tr){ return tr.getAttribute('data-id'); }).filter(Boolean);
    if(!lids.length){ toast('没有可排序的直播源'); return Promise.resolve(); }
    var lst2=document.getElementById('lvordStat'); if(lst2) lst2.textContent='保存中…';
    return req('POST','/api/admin/order',{kind:'lives',ids:lids}).then(function(){
      toast('直播源排序已保存并写入 tv.json，重新整理后依然生效');
      return loadFiles().then(render);
    });
  }
  if(act==='lvord-reset'){
    return req('POST','/api/admin/order',{kind:'lives',ids:[]}).then(function(){
      toast('已恢复默认排序（按测速速度）');
      return loadFiles().then(render);
    });
  }

  if(act==='add-src'){
    var tr=document.createElement('tr');
    tr.innerHTML='<td><input name="name" placeholder="备注名"></td><td><input name="url" placeholder="https://.../config.json"></td>'+CATEGORY_SELECT+'<td class="tight"><input type="checkbox" name="enabled" checked></td><td class="small" data-testid="1">—</td><td class="tight"><button class="ghost" data-act="test-src" title="在线测试该源（下载+解密+解析）">测试</button></td><td class="tight"><button class="ghost" data-act="del-src">删除</button></td>';
    $('#srcRows').appendChild(tr); return Promise.resolve();
  }
  if(act==='bulk-src'){
    var raw=$('#bulkSrc')?$('#bulkSrc').value:'';
    var lines=String(raw).split(String.fromCharCode(10));
    var added=0, skipped=0;
    lines.forEach(function(line){
      var text=line.trim();
      if(!text) return;
      var name='', url=text;
      var ci=text.search(/[,，]/);
      if(ci>0){
        var head=text.slice(0,ci).trim(), tail=text.slice(ci+1).trim();
        if(/^https?:/i.test(tail)){ name=head; url=tail; }
      }
      if(!/^https?:/i.test(url)){ skipped+=1; return; }
      var tr=document.createElement('tr');
      tr.innerHTML='<td><input name="name" value="'+esc(name)+'"></td><td><input name="url" value="'+esc(url)+'"></td>'+CATEGORY_SELECT+'<td class="tight"><input type="checkbox" name="enabled" checked></td><td class="tight"><button class="ghost" data-act="del-src">删除</button></td>';
      $('#srcRows').appendChild(tr);
      added+=1;
    });
    if($('#bulkSrc')) $('#bulkSrc').value='';
    toast('追加 '+added+' 行'+(skipped?('，忽略 '+skipped+' 行非链接'):'')+'，记得点「保存清单」');
    return Promise.resolve();
  }
  if(act==='del-src'){ btn.closest('tr').remove(); return Promise.resolve(); }
  if(act==='save-src'){
    return req('POST','/api/admin/sources',{sources:collectSources()}).then(function(d){ S.state.sources=d.sources; toast('源地址清单已保存'); render(); });
  }
  if(act==='export-src'){
    return req('GET','/api/admin/export?type=sources').then(function(d){ download('sources.json',JSON.stringify(d.data,null,2)); toast('已导出'); });
  }
  if(act==='import-src'){
    pickFile(function(data){ req('POST','/api/admin/import',{type:'sources',data:data}).then(function(){ toast('导入成功'); return loadState().then(render); }); });
    return Promise.resolve();
  }

  if(act==='add-live'){
    var ltr=document.createElement('tr');
    ltr.innerHTML='<td><input name="name" placeholder="直播源名"></td><td><input name="url" placeholder="https://user:pass@host/...m3u"></td><td style="width:80px"><input name="type" placeholder="type"></td><td><input name="ua" placeholder="UA（可空）"></td><td><input name="epg" placeholder="EPG（可空）"></td><td class="tight"><input type="checkbox" name="enabled" checked></td><td class="small" data-testid="1">—</td><td class="tight"><button class="ghost" data-act="test-live" title="在线测试该直播源">测试</button></td><td class="tight"><button class="ghost" data-act="live-up" title="上移">↑</button><button class="ghost" data-act="live-down" title="下移">↓</button></td><td class="tight"><button class="ghost" data-act="del-live">删除</button></td>';
    $('#liveRows').appendChild(ltr); return Promise.resolve();
  }
  if(act==='bulk-live'){
    var lraw=$('#bulkLive')?$('#bulkLive').value:'';
    var llines=String(lraw).split(String.fromCharCode(10));
    var ladded=0, lskipped=0;
    llines.forEach(function(line){
      var text=line.trim();
      if(!text) return;
      var name='', url=text;
      var ci=text.search(/[,，]/);
      if(ci>0){
        var head=text.slice(0,ci).trim(), tail=text.slice(ci+1).trim();
        if(/^https?:/i.test(tail)){ name=head; url=tail; }
      }
      if(!/^https?:/i.test(url)){ lskipped+=1; return; }
      var tr=document.createElement('tr');
      tr.innerHTML='<td><input name="name" value="'+esc(name)+'"></td><td><input name="url" value="'+esc(url)+'"></td><td style="width:80px"><input name="type"></td><td><input name="ua"></td><td><input name="epg"></td><td class="tight"><input type="checkbox" name="enabled" checked></td><td class="small" data-testid="1">—</td><td class="tight"><button class="ghost" data-act="test-live" title="在线测试该直播源">测试</button></td><td class="tight"><button class="ghost" data-act="live-up" title="上移">↑</button><button class="ghost" data-act="live-down" title="下移">↓</button></td><td class="tight"><button class="ghost" data-act="del-live">删除</button></td>';
      $('#liveRows').appendChild(tr);
      ladded+=1;
    });
    if($('#bulkLive')) $('#bulkLive').value='';
    toast('追加 '+ladded+' 行'+(lskipped?('，忽略 '+lskipped+' 行非链接'):'')+'，记得点「保存清单」');
    return Promise.resolve();
  }
  if(act==='del-live'){ btn.closest('tr').remove(); return Promise.resolve(); }
  if(act==='save-lives'){
    return req('POST','/api/admin/lives',{lives:collectLives()}).then(function(d){ S.state.lives=d.lives; toast('直播源清单已保存'); render(); });
  }
  if(act==='export-live'){
    return req('GET','/api/admin/export?type=lives').then(function(d){ download('lives.json',JSON.stringify(d.data,null,2)); toast('已导出'); });
  }
  if(act==='import-live'){
    pickFile(function(data){ req('POST','/api/admin/import',{type:'lives',data:data}).then(function(){ toast('导入成功'); return loadState().then(render); }); });
    return Promise.resolve();
  }

  if(act==='add-manual'){
    var g=btn.getAttribute('data-g');
    var tb=$('tbody[data-tbody='+g+']');
    var row=document.createElement('tr'); row.setAttribute('data-g',g);
    row.innerHTML='<td><input name="name" placeholder="源名"></td><td><input name="api" placeholder="接口地址 / csp_ 爬虫"></td><td style="width:90px"><input name="type" placeholder="type"></td><td><input name="ext" placeholder="ext（可空）"></td><td><button class="ghost" data-act="del-manual" data-g="'+g+'">删除</button></td>';
    tb.appendChild(row); return Promise.resolve();
  }
  if(act==='del-manual'){ btn.closest('tr').remove(); return Promise.resolve(); }
  if(act==='save-manual'){
    return req('POST','/api/admin/manual',{av:collectManualGroup('av'),tv:collectManualGroup('tv')}).then(function(d){ S.state.manual=d.manual; toast('手动源已保存'); render(); });
  }
  if(act==='clear-manual'){
    if(!confirm('确定清空全部手动源？')) return Promise.resolve();
    return req('POST','/api/admin/manual',{av:[],tv:[]}).then(function(d){ S.state.manual=d.manual; toast('已清空'); render(); });
  }
  if(act==='export-manual'){
    return req('GET','/api/admin/export?type=manual').then(function(d){ download('manual.json',JSON.stringify(d.data,null,2)); toast('已导出手动源'); });
  }
  if(act==='import-manual'){
    pickFile(function(data){ req('POST','/api/admin/import',{type:'manual',data:data}).then(function(){ toast('导入成功'); return loadState().then(render); }); });
    return Promise.resolve();
  }

  if(act==='reload-output'){ return loadFiles().then(render); }
  if(act==='hide'){
    var id=btn.getAttribute('data-id');
    var bl=(S.state.blocklist||[]).slice();
    if(bl.indexOf(id)<0) bl.push(id);
    return req('POST','/api/admin/blocklist',{blocklist:bl}).then(function(d){ S.state.blocklist=d.blocklist; toast('已从输出中删除'); return loadFiles().then(render); });
  }
  if(act==='unblock'){
    var id2=e.target.getAttribute('data-id');
    var bl2=(S.state.blocklist||[]).filter(function(x){ return x!==id2; });
    return req('POST','/api/admin/blocklist',{blocklist:bl2}).then(function(d){ S.state.blocklist=d.blocklist; toast('已恢复'); return loadFiles().then(render); });
  }
  if(act==='purge'){
    var idp=e.target.getAttribute('data-id');
    if(!confirm('彻底删除：立即从当前 tv.json / av.json 中移除该源，且自动整理不再重新加入。确定？')) return Promise.resolve();
    return req('POST','/api/admin/purge',{id:idp}).then(function(d){
      S.state.blocklist=d.blocklist||S.state.blocklist;
      if(d.overrides) S.state.overrides=d.overrides;
      toast('已彻底删除'+(d.removed?('，移除 '+d.removed+' 条'):''));
      return loadFiles().then(render);
    });
  }
  if(act==='clear-blocklist'){
    if(!S.state.blocklist||!S.state.blocklist.length){ toast('当前没有已删除的记录'); return Promise.resolve(); }
    if(!confirm('确定全部清除 '+S.state.blocklist.length+' 条已删除记录？清除后这些源将不再被拦截（下次整理时会重新评估是否有效）。')) return Promise.resolve();
    return req('POST','/api/admin/blocklist',{blocklist:[]}).then(function(d){
      S.state.blocklist=d.blocklist||[];
      toast('已全部清除 blocklist');
      return render();
    });
  }
  if(act==='clear-ov'){
    var id3=btn.getAttribute('data-id');
    var ov=Object.assign({},S.state.overrides||{}); delete ov[id3];
    return req('POST','/api/admin/overrides',{overrides:ov}).then(function(d){ S.state.overrides=d.overrides; toast('已清除修改'); return loadFiles().then(render); });
  }
  if(act==='save-output'){
    var ov2=Object.assign({},S.state.overrides||{});
    var blSet={}; (S.state.blocklist||[]).forEach(function(x){ blSet[x]=true; });
    $$('#outRows tr').forEach(function(tr){
      var id=tr.getAttribute('data-id');
      delete ov2[id]; delete blSet[id];
      var oname=tr.getAttribute('data-oname'), oapi=tr.getAttribute('data-oapi'), ocat=tr.getAttribute('data-ocat');
      var name=tr.querySelector('[name=name]').value.trim();
      var api=tr.querySelector('[name=api]').value.trim();
      var cat=tr.querySelector('[name=cat]').value;
      var patch={};
      if(name!==oname) patch.name=name;
      if(api!==oapi) patch.api=api;
      if(cat!==ocat) patch.category=cat;
      if(Object.keys(patch).length) ov2[id]=patch;
    });
    var blList=Object.keys(blSet);
    return req('POST','/api/admin/overrides',{overrides:ov2}).then(function(d){
      S.state.overrides=d.overrides;
      return req('POST','/api/admin/blocklist',{blocklist:blList});
    }).then(function(d){ S.state.blocklist=d.blocklist; toast('修改已保存'); return loadFiles().then(render); });
  }

  if(act==='add-sub'){
    var tr2=document.createElement('tr');
    tr2.innerHTML='<td><input name="name" placeholder="xxx"></td><td><input name="title" placeholder="标题"></td><td class="tight"><input type="checkbox" name="tv" checked></td><td class="tight"><input type="checkbox" name="av"></td><td><input name="keywords" placeholder="关键字过滤"></td><td class="tight"><button class="ghost" data-act="del-sub">删除</button></td>';
    $('#subRows').appendChild(tr2); return Promise.resolve();
  }
  if(act==='del-sub'){ btn.closest('tr').remove(); return Promise.resolve(); }
  if(act==='save-subs'){
    return req('POST','/api/admin/subs',{subs:collectSubs()}).then(function(d){ S.state.subs=d.subs; toast('自定义订阅已保存'); render(); });
  }
  if(act==='copy'){
    var text=btn.getAttribute('data-text');
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast('已复制'); });
    else toast(text);
    return Promise.resolve();
  }

  if(act==='save-config'){
    return req('POST','/api/admin/config',{config:collectConfig()}).then(function(d){ S.state.config=d.config; toast('配置已保存'); render(); });
  }
  if(act==='reset-config'){
    return req('GET','/api/admin/config').then(function(d){ S.state.config=d.defaults; toast('已载入默认值，请点保存'); render(); });
  }

  if(act==='change-pwd'){
    var cur=$('#curPwd').value, nw=$('#newPwd').value;
    if(nw.length<6){ return Promise.reject(new Error('新密码至少 6 位')); }
    return req('POST','/api/admin/password',{current:cur,next:nw}).then(function(){ toast('密码已修改'); S.state.usingDefaultPassword=false; render(); });
  }

  return Promise.resolve();
}

function runPipeline(route){
  return req('POST','/api/admin/pipeline/'+route).then(function(){
    return Promise.all([loadState(),loadFiles()]);
  }).then(function(){
    toast('已触发整理，可稍后「继续执行」或等待心跳续跑');
    render();
  });
}

// —— 启动 ——
Promise.all([loadState(),loadFiles()]).then(function(){
  render();
}).catch(function(err){
  toast('加载失败：'+(err.message||err),true);
});
})();
</script>
</body>
</html>`;
}
