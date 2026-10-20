/**
 * 登录页逻辑：输入管理密码，登录成功后跳转到 /admin 后台。
 */
(function () {
  'use strict';

  var f = document.getElementById('f');
  var pwd = document.getElementById('pwd');
  var hint = document.getElementById('hint');
  var toastEl = document.getElementById('toast');

  function toast(msg, err) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.className = 'toast'; }, 2600);
  }

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    hint.textContent = '正在登录…';
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: pwd.value }),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { s: r.status, d: d }; });
      })
      .then(function (res) {
        if (res.d && res.d.ok) {
          location.href = '/admin';
          return;
        }
        hint.textContent = '登录失败';
        toast((res.d && res.d.error) || '登录失败', true);
      })
      .catch(function (e) {
        hint.textContent = '登录失败';
        toast('请求失败：' + e.message, true);
      });
  });

  // 已登录则直接跳转到后台
  fetch('/api/admin/state', { credentials: 'same-origin' }).then(function (r) {
    if (r.ok) location.href = '/admin';
  }).catch(function () {});
})();
