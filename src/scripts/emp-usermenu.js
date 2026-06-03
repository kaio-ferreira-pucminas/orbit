// emp-usermenu.js — Orbit · Dropdown do avatar na topbar de empresa
// Transforma o #emp-avatar (estático) num menu: Ir para o perfil · Sair.
// Incluir nas páginas de empresa que têm topbar. JS puro, autossuficiente.

(function () {
  'use strict';

  const USER_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const LOGOUT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

  function init() {
    const avatar = document.getElementById('emp-avatar');
    if (!avatar || avatar.dataset.menuDone) return;
    avatar.dataset.menuDone = '1';

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

    const dd = document.createElement('div');
    dd.className = 'emp-usermenu__dropdown';
    dd.setAttribute('role', 'menu');
    dd.innerHTML =
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
