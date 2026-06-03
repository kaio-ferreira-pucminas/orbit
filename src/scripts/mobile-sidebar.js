// mobile-sidebar.js — Orbit · Sidebar retrátil (off-canvas) no mobile
// Detecta a sidebar (.emp-sidebar ou .dash-sidebar), injeta o CSS de off-canvas,
// adiciona um botão hambúrguer flutuante + backdrop e abre/fecha com animação.
// Incluir DEPOIS do sidebar.js (quando houver). JS puro, autossuficiente.

(function () {
  'use strict';

  function init() {
    const sidebar = document.querySelector('.emp-sidebar, .dash-sidebar');
    if (!sidebar || document.getElementById('ms-toggle-btn')) return;

    // Brand da empresa: usa a foto/logo da empresa no ícone do topo da sidebar (se houver)
    try {
      const u = JSON.parse(localStorage.getItem('orbit_user') || 'null');
      const brandLogo = document.querySelector('.emp-sidebar__logo-icon');
      if (u && u.avatarUrl && brandLogo) {
        brandLogo.style.overflow = 'hidden';
        brandLogo.innerHTML = '<img src="' + String(u.avatarUrl).replace(/"/g, '&quot;') + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" />';
      }
    } catch (e) { /* ignora */ }

    if (!document.getElementById('mobile-sidebar-style')) {
      const css = `
        #ms-toggle-btn{display:none;}
        .ms-backdrop{display:none;position:fixed;inset:0;background:rgba(19,27,46,.45);opacity:0;pointer-events:none;transition:opacity .28s ease;z-index:1090;}
        @media (max-width:900px){
          #ms-toggle-btn{display:flex;position:fixed;top:10px;left:10px;z-index:1200;width:42px;height:42px;border-radius:10px;background:#fff;border:1px solid rgba(199,196,215,.55);box-shadow:0 4px 14px rgba(19,27,46,.16);align-items:center;justify-content:center;color:#131b2e;cursor:pointer;}
          /* Sidebars deslizam para fora da tela (off-canvas) */
          .emp-sidebar,.dash-sidebar{width:var(--sidebar-w)!important;transform:translateX(-100%);transition:transform .28s ease;z-index:1100;box-shadow:6px 0 40px rgba(19,27,46,.22);}
          body.ms-open .emp-sidebar,body.ms-open .dash-sidebar{transform:translateX(0);}
          /* Restaura a emp-sidebar cheia (desfaz o colapso de 64px) */
          .emp-sidebar{padding:28px 16px!important;}
          .emp-sidebar__brand{justify-content:flex-start!important;padding:0 12px 36px!important;}
          .emp-sidebar__brand-text{display:flex!important;}
          .emp-nav__link{justify-content:flex-start!important;}
          .emp-nav__link span{display:inline!important;}
          .emp-sidebar__upgrade{display:block!important;}
          .emp-sidebar__upgrade-label{display:inline!important;}
          /* Restaura a dash-sidebar cheia (desfaz colapso de ícones) */
          .dash-sidebar{padding:28px 16px!important;}
          .dash-sidebar__brand{justify-content:flex-start!important;}
          .dash-sidebar__brand-text{display:flex!important;}
          .dash-nav__link{justify-content:flex-start!important;}
          .dash-nav__link span{display:inline!important;}
          /* Conteúdo ocupa a tela toda; espaço para o botão flutuante */
          .emp-shell,.cand-main,.msg-main{margin-left:0!important;}
          .emp-content{padding:24px 16px!important;}
          .emp-topbar{padding-left:60px!important;}
          .cand-main{padding-top:64px!important;}
          .msg-list-panel__header{padding-left:56px!important;}
          /* Backdrop */
          .ms-backdrop{display:block;}
          body.ms-open .ms-backdrop{opacity:1;pointer-events:auto;}
        }
      `;
      const st = document.createElement('style');
      st.id = 'mobile-sidebar-style';
      st.textContent = css;
      document.head.appendChild(st);
    }

    const btn = document.createElement('button');
    btn.id = 'ms-toggle-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    document.body.appendChild(btn);

    const backdrop = document.createElement('div');
    backdrop.className = 'ms-backdrop';
    document.body.appendChild(backdrop);

    const close = () => document.body.classList.remove('ms-open');
    btn.addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('ms-open'); });
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) close(); }); // fecha ao navegar
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
