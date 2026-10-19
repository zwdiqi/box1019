/**
 * 公开页逻辑：拉取状态与两个订阅文件，渲染概览与源预览。
 * 纯只读，不需要登录。订阅链接统一放在后台管理页。
 */
(function () {
  'use strict';

  var S = { status: null, tv: null, av: null, cat: 'tv', q: '' };

  var $ = function (sel) { return document.querySelector(sel); };

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'toast'; }, 2200);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTime(iso) {
    if (!iso) return '尚未生成';
    try { return new Date(iso).toLocaleString('zh-CN'); } catch (e) { return String(iso); }
  }

  function tipText(site) {
    if (site.api && site.api.indexOf('csp_') === 0) return 'csp_';
    if (Number(site.type) === 3) return 'type 3';
    return site.type == null ? '—' : 'type ' + site.type;
  }

  function latHtml(ms) {
    if (ms == null || !isFinite(ms)) return '<span class="lat na">未测速</span>';
    var cls = ms < 400 ? 'fast' : (ms < 1200 ? 'mid' : 'slow');
    return '<span class="lat ' + cls + '">' + Math.round(ms) + ' ms</span>';
  }

  function currentSites() {
    var file = S.cat === 'av' ? S.av : S.tv;
    var sites = (file && Array.isArray(file.sites)) ? file.sites.slice() : [];
    var q = S.q.trim().toLowerCase();
    if (q) {
      sites = sites.filter(function (s) {
        return String(s.name || '').toLowerCase().indexOf(q) >= 0
          || String(s.api || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    sites.sort(function (a, b) {
      var am = Number.isFinite(a._latency) ? a._latency : Infinity;
      var bm = Number.isFinite(b._latency) ? b._latency : Infinity;
      if (am !== bm) return am - bm;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
    });
    return sites;
  }

  function renderStats() {
    var c = (S.status && S.status.counts) || {};
    var items = [
      ['普通源', c.tv], ['成人源', c.av], ['直播源', c.live], ['有效源', c.alive],
      ['失效源', c.dead], ['抓取站点', c.sites], ['源地址', c.sources]
    ];
    $('#stats').innerHTML = items.map(function (it) {
      return '<div class="stat"><div class="k">' + it[0] + '</div><div class="v">' + (it[1] == null ? '0' : it[1]) + '</div></div>';
    }).join('');
    var extra = '';
    if (S.status && S.status.errorCount) extra += ' · 抓取错误 ' + S.status.errorCount;
    $('#updated').textContent = '更新于 ' + fmtTime(S.status && S.status.updatedAt) + extra;
  }

  function renderTable() {
    var sites = currentSites();
    $('#count').textContent = '共 ' + sites.length + ' 条';
    if (!sites.length) {
      $('#rows').innerHTML = '<tr><td colspan="5" class="muted" style="padding:18px">没有匹配的源。若尚未生成，请先在后台执行一次整理。</td></tr>';
      return;
    }
    $('#rows').innerHTML = sites.map(function (s, i) {
      return '<tr>' +
        '<td class="muted">' + (i + 1) + '</td>' +
        '<td>' + esc(s.name || '(未命名)') + '</td>' +
        '<td class="mono">' + esc(s.api || '') + '</td>' +
        '<td><span class="pill">' + esc(tipText(s)) + '</span></td>' +
        '<td>' + latHtml(s._latency) + '</td>' +
      '</tr>';
    }).join('');
  }

  function render() { renderStats(); renderTable(); }

  function json(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (btn) {
      var target = $(btn.getAttribute('data-copy'));
      if (target) copy(target.textContent);
      return;
    }
    var cp = e.target.closest('[data-text]');
    if (cp) { copy(cp.getAttribute('data-text')); return; }

    var seg = e.target.closest('.seg-btn');
    if (seg) {
      S.cat = seg.getAttribute('data-cat');
      var btns = document.querySelectorAll('.seg-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i] === seg);
      renderTable();
    }
  });

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制：' + text); });
    } else {
      toast(text);
    }
  }

  $('#q').addEventListener('input', function (e) { S.q = e.target.value; renderTable(); });

  Promise.all([
    json('/api/public/status').catch(function () { return { data: null }; }),
    json('/tv.json').catch(function () { return null; }),
    json('/av.json').catch(function () { return null; })
  ]).then(function (r) {
    S.status = r[0] && r[0].data ? r[0].data : r[0];
    S.tv = r[1];
    S.av = r[2];
    render();
  }).catch(function (e) {
    $('#rows').innerHTML = '<tr><td colspan="5" class="muted" style="padding:18px">加载失败：' + esc(e.message) + '</td></tr>';
  });
})();
