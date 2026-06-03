// emp-usermenu.js — Orbit · Dropdown do avatar na topbar de empresa
// Transforma o #emp-avatar (estático) num menu: Ir para o perfil · Sair.
// Incluir nas páginas de empresa que têm topbar. JS puro, autossuficiente.

(function () {
  'use strict';

  const USER_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const LOGOUT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  const DASH_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';

  // CSS do dropdown (injetado uma vez). Antes dependia do CSS da página: nas telas que
  // não carregam empresa.css (ex.: Busca de Talentos) o menu ficava sem estilo/"bugado".
  function ensureStyles() {
    if (document.getElementById('emp-usermenu-style')) return;
    const css =
      '.emp-usermenu{position:relative;}' +
      '.emp-usermenu__dropdown{position:absolute;top:calc(100% + 8px);right:0;width:220px;background:#fff;border:1px solid var(--border-purple,#e2e7ff);border-radius:var(--radius,12px);box-shadow:0 8px 24px rgba(19,27,46,.12);padding:6px;z-index:200;opacity:0;pointer-events:none;transform:translateY(-4px) scale(.98);transform-origin:top right;transition:opacity .15s ease,transform .15s ease;}' +
      '.emp-usermenu--open .emp-usermenu__dropdown{opacity:1;pointer-events:auto;transform:none;}' +
      '.emp-usermenu__item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:none;background:none;border-radius:var(--radius-sm,8px);cursor:pointer;text-decoration:none;font-size:14px;font-weight:500;color:var(--text-dark,#131b2e);text-align:left;font-family:inherit;}' +
      '.emp-usermenu__item:hover{background:var(--light-purple,#f2f3ff);color:var(--primary,#4648d4);}' +
      '.emp-usermenu__item svg{flex-shrink:0;color:var(--text-muted,#5c647a);}' +
      '.emp-usermenu__item:hover svg{color:var(--primary,#4648d4);}' +
      '.emp-usermenu__item--danger{color:#c0392b;}' +
      '.emp-usermenu__item--danger svg{color:#c0392b;}' +
      '.emp-usermenu__item--danger:hover{background:#fef2f2;color:#c0392b;}';
    const st = document.createElement('style');
    st.id = 'emp-usermenu-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    const avatar = document.getElementById('emp-avatar');
    if (!avatar || avatar.dataset.menuDone) return;
    avatar.dataset.menuDone = '1';
    ensureStyles();

    // Envolve o avatar num wrapper relativo e injeta o dropdown
    const wrap = document.createElement('div');
    wrap.className = 'emp-usermenu';
    avatar.parentNode.insertBefore(wrap, avatar);
    wrap.appendChild(avatar);

    avatar.style.cursor = 'pointer';
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('aria-haspopup', 'menu');
    avatar.setAttribute('aria-expanded', 'false');
    avatar.setAttribute('tabindex', '0');

    let _u = null; try { _u = JSON.parse(localStorage.getItem('orbit_user') || 'null'); } catch (e) {}
    const dashHref = (_u && _u.type === 'company') ? '/pages/empresa-dashboard.html' : '/pages/dashboard.html';

    const dd = document.createElement('div');
    dd.className = 'emp-usermenu__dropdown';
    dd.setAttribute('role', 'menu');
    dd.innerHTML =
      `<a href="${dashHref}" class="emp-usermenu__item" role="menuitem">${DASH_SVG}<span>Ir para o dashboard</span></a>` +
      `<a href="/pages/profile.html" class="emp-usermenu__item" role="menuitem">${USER_SVG}<span>Ir para o perfil</span></a>` +
      `<button type="button" class="emp-usermenu__item emp-usermenu__item--danger" id="emp-usermenu-logout" role="menuitem">${LOGOUT_SVG}<span>Sair</span></button>`;
    wrap.appendChild(dd);

    function close() { wrap.classList.remove('emp-usermenu--open'); avatar.setAttribute('aria-expanded', 'false'); }
    function toggle(e) { e.preventDefault(); e.stopPropagation(); const open = wrap.classList.toggle('emp-usermenu--open'); avatar.setAttribute('aria-expanded', String(open)); }

    avatar.addEventListener('click', toggle);
    avatar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); if (e.key === 'Escape') close(); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });

    const logout = document.getElementById('emp-usermenu-logout');
    if (logout) logout.addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
