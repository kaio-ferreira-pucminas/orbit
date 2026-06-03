// mobile-sidebar.js — Orbit · Chrome mobile do dashboard
// Componente ÚNICO e compartilhado (carregado automaticamente pelo config.js em
// qualquer tela com sidebar). Responsável por, no mobile:
//   • Sidebar off-canvas (.emp-sidebar/.dash-sidebar) com hambúrguer que vira "X"
//     ao abrir (reposicionado para o canto do menu, sem cobrir o avatar).
//   • Sino de notificações FIXO no canto superior direito (acompanha o scroll),
//     presente em todas as telas do dashboard (exceto Mensagens, que tem topo próprio).
// Carrega sozinho suas dependências (toast.js + notifications.js). JS puro.

(function () {
  'use strict';

  const SELF = (document.currentScript && document.currentScript.src) || '';
  function sibling(name) {
    return SELF ? SELF.replace(/mobile-sidebar\.js(\?.*)?$/, name) : '../scripts/' + name;
  }

  const BELL_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  /* ── Dependências do sino (toast + notificações), como no header.js ── */
  function loadDeps() {
    ['toast.js', 'notifications.js'].forEach(function (name) {
      if (document.querySelector('script[src*="' + name + '"]')) return;
      const s = document.createElement('script');
      s.src = sibling(name);
      document.body.appendChild(s);
    });
  }

  /* ── CSS do chrome mobile (injetado uma vez) ── */
  function injectCSS() {
    if (document.getElementById('mobile-sidebar-style')) return;
    const css = `
      #ms-toggle-btn{display:none;}
      #ms-toggle-btn .ms-ico-close{display:none;}
      .ms-floating-notif{display:none;}
      .ms-backdrop{display:none;position:fixed;inset:0;background:rgba(19,27,46,.45);opacity:0;pointer-events:none;transition:opacity .28s ease;z-index:1090;}
      @media (max-width:900px){
        /* Botão hambúrguer (vira X ao abrir) */
        #ms-toggle-btn{display:flex;position:fixed;top:10px;left:10px;z-index:1200;width:42px;height:42px;border-radius:10px;background:#fff;border:1px solid rgba(199,196,215,.55);box-shadow:0 4px 14px rgba(19,27,46,.16);align-items:center;justify-content:center;color:#131b2e;cursor:pointer;transition:left .28s ease;}
        body.ms-open #ms-toggle-btn{left:calc(var(--sidebar-w, 256px) - 44px);width:34px;height:34px;border-radius:8px;}
        body.ms-open #ms-toggle-btn svg{width:18px;height:18px;}
        body.ms-open #ms-toggle-btn .ms-ico-open{display:none;}
        body.ms-open #ms-toggle-btn .ms-ico-close{display:block;}
        /* Folga no texto do brand p/ o X não cobrir o nome */
        body.ms-open .dash-sidebar__brand-text,body.ms-open .emp-sidebar__brand-text{padding-right:44px;}
        /* Sidebars deslizam para fora da tela (off-canvas), altura visível (dvh) */
        .emp-sidebar,.dash-sidebar{width:var(--sidebar-w)!important;height:100vh!important;height:100dvh!important;overflow-y:auto;transform:translateX(-100%);transition:transform .28s ease;z-index:1100;box-shadow:6px 0 40px rgba(19,27,46,.22);}
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
        /* Conteúdo ocupa a tela toda; folga no topo p/ não passar sob o hambúrguer/sino */
        body>main,.emp-shell,.cand-main{margin-left:0!important;}
        body>main:not(.msg-main){padding-top:60px!important;}
        .emp-content{padding:24px 16px!important;}
        .emp-topbar{padding-left:60px!important;}
        .cand-main{padding-top:64px!important;}
        .msg-list-panel__header{padding-left:56px!important;}
        /* Sino fixo no canto superior direito (segue o scroll) */
        .dash-welcome #orbit-notif{position:fixed!important;top:10px!important;right:10px!important;left:auto!important;z-index:1200;}
        .ms-floating-notif{display:block;position:fixed!important;top:10px!important;right:10px!important;left:auto!important;bottom:auto!important;z-index:1200;}
        body.ms-open .dash-welcome #orbit-notif,body.ms-open .ms-floating-notif{display:none;}
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

  /* ── Brand da empresa: usa a foto/logo no ícone do topo da sidebar (se houver) ── */
  function setupBrandLogo() {
    try {
      const u = JSON.parse(localStorage.getItem('orbit_user') || 'null');
      const brandLogo = document.querySelector('.emp-sidebar__logo-icon');
      if (u && u.avatarUrl && brandLogo) {
        brandLogo.style.overflow = 'hidden';
        const safeName = String(u.name || 'Empresa').replace(/"/g, '&quot;');
        brandLogo.innerHTML = '<img src="' + String(u.avatarUrl).replace(/"/g, '&quot;') + '" alt="' + safeName + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" />';
      }
    } catch (e) { /* ignora */ }
  }

  /* ── Sino flutuante: injeta um #orbit-notif fixo (top-right) nas telas que ainda
       não têm sino. Pula Mensagens (tem controles próprios no topo). ── */
  function ensureBell() {
    if (document.querySelector('.msg-main')) return;          // Mensagens: não injeta
    if (!localStorage.getItem('orbit_token')) return;          // sem sessão
    if (document.getElementById('orbit-notif')) return;        // já há sino (será posicionado via CSS)

    if (!document.getElementById('ms-notif-style')) {
      const st = document.createElement('style');
      st.id = 'ms-notif-style';
      st.textContent = '.ms-notif-btn{width:42px;height:42px;border-radius:10px;background:#fff;border:1px solid rgba(199,196,215,.55);box-shadow:0 4px 14px rgba(19,27,46,.16);display:flex;align-items:center;justify-content:center;color:#131b2e;cursor:pointer;position:relative;}.ms-notif-btn:hover{color:#4648d4;}';
      document.head.appendChild(st);
    }

    const wrap = document.createElement('div');
    wrap.className = 'orbit-notif ms-floating-notif';
    wrap.id = 'orbit-notif';
    wrap.innerHTML =
      '<button class="ms-notif-btn orbit-notif__btn" id="notif-btn" type="button" aria-label="Notificações" title="Notificações" aria-haspopup="true" aria-expanded="false">' +
        BELL_SVG +
        '<span class="orbit-notif__badge" id="notif-badge" hidden>0</span>' +
      '</button>';
    document.body.appendChild(wrap);
  }

  function init() {
    const sidebar = document.querySelector('.emp-sidebar, .dash-sidebar');
    if (!sidebar || document.getElementById('ms-toggle-btn')) return;

    setupBrandLogo();
    injectCSS();
    ensureBell();   // injeta o sino ANTES das deps (p/ o notifications.js encontrar #orbit-notif)
    loadDeps();     // toast.js + notifications.js (liga badge/dropdown/toast do sino)

    const btn = document.createElement('button');
    btn.id = 'ms-toggle-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg class="ms-ico-open" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
      '<svg class="ms-ico-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
    document.body.appendChild(btn);

    const backdrop = document.createElement('div');
    backdrop.className = 'ms-backdrop';
    document.body.appendChild(backdrop);

    function setOpen(open) {
      document.body.classList.toggle('ms-open', open);
      btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      btn.setAttribute('aria-expanded', String(open));
    }
    const close = function () { setOpen(false); };

    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!document.body.classList.contains('ms-open')); });
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('click', function (e) { if (e.target.closest('a')) close(); }); // fecha ao navegar
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
