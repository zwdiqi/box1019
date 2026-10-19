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
    <h2>TVBox 源整理后台</h2>
    <p class="muted small" id="hint">请输入管理密码</p>
    <form id="f" autocomplete="off">
      <input type="password" id="pwd" placeholder="管理密码" autocomplete="current-password" autofocus>
      <div style="height:12px"></div>
      <button type="submit" style="width:100%">登录</button>
    </form>
    <p class="muted small" style="margin-top:14px">首次部署若未设置 ADMIN_PASSWORD，默认密码为 <b>admin123</b>，请登录后立即修改。</p>
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
    <a href="/" target="_blank" class="small">公开页 ↗</a>
    <button class="ghost" id="btnLogout">退出登录</button>
  </header>
  <nav class="tabs" id="tabs"></nav>
  <main id="view"></main>
</div>
<div class="toast" id="toast"></div>
<script>
(function(){
'use strict';

var TABS=[['dash','数据看板'],['sources','源地址清单'],['manual','手动源'],['output','自动源编辑'],['subs','自定义订阅'],['config','配置'],['security','密码']];
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

// —— 加载与渲染 ——
function loadState(){
  return req('GET','/api/admin/state').then(function(d){ S.state=d; return d; });
}
function loadFiles(){
  function file(path){
    return fetch(path,{credentials:'same-origin'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  }
  return Promise.all([file('/tv.json'),file('/av.json')]).then(function(r){ S.tv=r[0]; S.av=r[1]; });
}

function render(){
  $('#bgPwd').style.display=(S.state&&S.state.usingDefaultPassword)?'':'none';
  var p=S.state&&S.state.pipeline;
  $('#bgPipe').textContent=(p&&p.running)?(p.phase+' '+p.percent+'%'):'空闲';
  $('#bgPipe').className='badge'+((p&&p.running)?' warn':'');
  $('#tabs').innerHTML=TABS.map(function(t){ return '<button class="tab'+(S.tab===t[0]?' active':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>'; }).join('');
  if(S.tab==='dash') renderDash();
  else if(S.tab==='sources') renderSources();
  else if(S.tab==='manual') renderManual();
  else if(S.tab==='output') renderOutput();
  else if(S.tab==='subs') renderSubs();
  else if(S.tab==='config') renderConfig();
  else if(S.tab==='security') renderSecurity();
}

function card(inner){ return '<div class="card">'+inner+'</div>'; }
function statsHtml(c){
  c=c||{};
  var items=[['源地址',c.sources],['抓取站点',c.sites],['测速',c.tested],['有效',c.alive],['失效',c.dead],['普通源',c.tv],['成人源',c.av]];
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
  html+=card('<h2>上次整理结果</h2>'+(lr? ('<div class="row" style="margin-bottom:10px"><span class="muted small">时间 '+fmtTime(lr.time)+' · 耗时 '+(lr.durationMs==null?'—':Math.round(lr.durationMs/1000)+'s')+' · 原因 '+esc(lr.reason||'')+' · 错误 '+(lr.errorCount||0)+'</span></div>'+statsHtml(lr.counts)) : '<p class="muted">尚无记录，请先执行一次整理。</p>'));
  if(lr&&lr.errors&&lr.errors.length){
    html+=card('<h2>最近错误（最多 50 条）</h2><div class="err-list">'+lr.errors.map(function(e){ return '<div class="log"><b>'+esc(e.message)+'</b><br><span class="muted">'+esc(e.url)+'</span></div>'; }).join('')+'</div>');
  }
  $('#view').innerHTML=html;
  schedulePoll();
}

function schedulePoll(){
  clearTimeout(S.pollTimer);
  var p=S.state&&S.state.pipeline;
  if(p&&p.running){
    S.pollTimer=setTimeout(function(){
      loadState().then(function(){ if(S.tab==='dash') render(); else render(); }).catch(function(){});
    },4000);
  }
}

// 源地址清单
function renderSources(){
  var list=(S.state&&S.state.sources)||[];
  var rows=list.map(function(s,i){
    return '<tr>'+
      '<td><input name="name" value="'+esc(s.name)+'" placeholder="备注名"></td>'+
      '<td><input name="url" value="'+esc(s.url)+'" placeholder="https://.../config.json"></td>'+
      '<td class="tight"><input type="checkbox" name="enabled"'+(s.enabled!==false?' checked':'')+'></td>'+
      '<td class="tight"><button class="ghost" data-act="del-src" data-i="'+i+'">删除</button></td>'+
    '</tr>';
  }).join('');
  var html=card(
    '<h2>源地址清单</h2>'+
    '<p class="muted small">这些是「待下载整理」的源配置地址（普通源 / 成人源都会从这里抓取，再自动分类）。支持 TVBox 单配置（含 sites）与多仓格式（含 urls）。</p>'+
    '<table><thead><tr><th>备注</th><th>地址</th><th>启用</th><th></th></tr></thead><tbody id="srcRows">'+rows+'</tbody></table>'+
    '<div class="toolbar" style="margin-top:12px">'+
      '<button class="ghost" data-act="add-src">新增一行</button>'+
      '<button data-act="save-src">保存清单</button>'+
      '<button class="ghost" data-act="import-src">导入 JSON</button>'+
      '<button class="ghost" data-act="export-src">导出 JSON</button>'+
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
    if(url) out.push({name:name,url:url,enabled:enabled});
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
    html+=card('<h2>已删除（blocklist）</h2>'+bl.map(function(id){
      return '<span class="chip mono">'+esc(id)+'<button data-act="unblock" data-id="'+esc(id)+'">恢复</button></span>';
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
function renderConfig(){
  var c=(S.state&&S.state.config)||{};
  var kw=Array.isArray(c.adultKeywords)?c.adultKeywords.join(','):'';
  var html=card(
    '<h2>成人源识别关键字</h2>'+
    '<p class="muted small">逗号或换行分隔；中文按子串匹配，拉丁字母按词边界匹配（避免 av 命中 java）。</p>'+
    '<textarea id="kw">'+esc(kw)+'</textarea>'
  );
  html+=card(
    '<h2>抓取与测速参数</h2>'+
    '<div class="grid">'+
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
  $$('#view input[name]').forEach(function(inp){
    var n=inp.getAttribute('name');
    if(inp.type==='checkbox'){ cfg[n]=inp.checked; return; }
    var v=inp.value.trim();
    cfg[n]=v===''?undefined:Number(v);
  });
  cfg.adultKeywords=$('#kw').value.split(/[,，、\\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
  cfg.heartbeatEnabled=$('#hb').checked;
  cfg.customFilesEnabled=$('#cf').checked;
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
  var b=e.target.closest('[data-act]'); if(!b) return;
  var act=b.getAttribute('data-act');
  handle(act,b).catch(function(err){ toast(err.message||String(err),true); });
});

function handle(act,btn){
  if(act==='reload'){ return loadState().then(render); }

  if(act==='start') return runPipeline('start');
  if(act==='force') return runPipeline('start?force=1');
  if(act==='step') return runPipeline('step');

  if(act==='add-src'){
    var tr=document.createElement('tr');
    tr.innerHTML='<td><input name="name" placeholder="备注名"></td><td><input name="url" placeholder="https://.../config.json"></td><td class="tight"><input type="checkbox" name="enabled" checked></td><td class="tight"><button class="ghost" data-act="del-src">删除</button></td>';
    $('#srcRows').appendChild(tr); return Promise.resolve();
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
    var id2=btn.getAttribute('data-id');
    var bl2=(S.state.blocklist||[]).filter(function(x){ return x!==id2; });
    return req('POST','/api/admin/blocklist',{blocklist:bl2}).then(function(d){ S.state.blocklist=d.blocklist; toast('已恢复'); return loadFiles().then(render); });
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
    return loadState();
  }).then(function(){ return loadFiles(); }).then(function(){
    toast('已触发整理，可稍后「继续执行」或等待心跳续跑');
    if(S.tab==='dash'||S.tab==='output') render(); else render();
  });
}

// —— 启动 ——
loadState().then(function(){
  return loadFiles();
}).then(function(){
  render();
}).catch(function(err){
  toast('加载失败：'+(err.message||err),true);
});
})();
</script>
</body>
</html>`;
}
