// header.js — Orbit · Header unificado (OrbitHeader)
// Componente transversal e AUTOSSUFICIENTE: injeta o próprio CSS + markup do
// header (logo + nav + sino + chat + avatar/menu do usuário) e carrega sozinho
// notifications.js + toast.js. Assim toda tela tem o MESMO header funcionando
// (dropdown de notificações + badge + toast em tempo real), bastando incluir:
//     <script src="../scripts/header.js"></script>
// JS puro, sem framework.

(function () {
  'use strict';

  // URL deste próprio script — usado para resolver os scripts irmãos
  const SELF = (document.currentScript && document.currentScript.src) || '';
  function sibling(name) {
    return SELF ? SELF.replace(/header\.js(\?.*)?$/, name) : '../scripts/' + name;
  }

  /* ===== USUÁRIO LOGADO ===== */
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('orbit_user') || 'null'); } catch (e) { currentUser = null; }
  // Sem usuário → não renderiza (o guard da própria página cuida do redirect)
  if (!currentUser) return;

  /* ===== HELPERS ===== */
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function avatarInner(user) {
    if (user && user.avatarUrl) return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name || '')}" />`;
    return `<span>${escapeHtml(initials(user && user.name))}</span>`;
  }

  /* ===== CSS (injetado uma vez) ===== */
  function ensureStyles() {
    if (document.getElementById('orbit-header-style')) return;
    const css = `
      .oh-header{position:sticky;top:0;z-index:100;background:#faf8ff;box-shadow:0 1px 2px rgba(19,27,46,.05);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;}
      .oh-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:12px 24px;}
      .oh-left{display:flex;align-items:center;gap:32px;}
      .oh-logo{font-weight:700;font-size:24px;letter-spacing:-1.2px;color:#4648d4;text-decoration:none;line-height:32px;}
      .oh-nav{display:flex;gap:24px;}
      .oh-link{font-family:'Manrope','Inter',sans-serif;font-weight:700;font-size:18px;letter-spacing:-.45px;line-height:28px;color:rgba(19,27,46,.6);text-decoration:none;padding-bottom:6px;border-bottom:2px solid transparent;transition:color .2s,border-color .2s;}
      .oh-link:hover{color:#131b2e;}
      .oh-link--active{color:#4648d4;border-bottom-color:#4648d4;}
      .oh-right{display:flex;align-items:center;gap:16px;}
      .oh-icon-btn{background:none;border:none;cursor:pointer;padding:8px;border-radius:6px;color:#464554;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s;text-decoration:none;}
      .oh-icon-btn:hover{background:#e2e7ff;color:#4648d4;}
      .oh-avatar{width:32px;height:32px;border-radius:12px;border:2px solid rgba(70,72,212,.2);background:linear-gradient(135deg,#4648d4 0%,#6063ee 100%);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s,transform .15s;overflow:hidden;}
      .oh-avatar:hover{border-color:#4648d4;transform:scale(1.05);}
      .oh-avatar img{width:100%;height:100%;object-fit:cover;display:block;}
      .oh-usermenu{position:relative;}
      .oh-usermenu__dropdown{position:absolute;top:calc(100% + 8px);right:0;width:260px;background:#fff;border:1px solid #e2e7ff;border-radius:12px;box-shadow:0 8px 24px rgba(19,27,46,.12);padding:8px;z-index:200;opacity:0;pointer-events:none;transform:translateY(-4px) scale(.98);transform-origin:top right;transition:opacity .15s ease,transform .15s ease;}
      .oh-usermenu--open .oh-usermenu__dropdown{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}
      .oh-usermenu__head{display:flex;align-items:center;gap:12px;padding:10px 12px;}
      .oh-usermenu__avatar{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4648d4 0%,#6063ee 100%);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}
      .oh-usermenu__avatar img{width:100%;height:100%;object-fit:cover;display:block;}
      .oh-usermenu__info{flex:1;min-width:0;}
      .oh-usermenu__name{font-family:'Manrope','Inter',sans-serif;font-weight:700;font-size:14px;line-height:18px;color:#131b2e;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .oh-usermenu__email{font-size:12px;line-height:16px;color:#464554;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .oh-usermenu__divider{height:1px;background:#e2e7ff;margin:6px 0;}
      .oh-usermenu__item{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:none;background:none;border-radius:8px;cursor:pointer;text-decoration:none;font-weight:500;font-size:14px;line-height:20px;color:#131b2e;text-align:left;transition:background .15s,color .15s;}
      .oh-usermenu__item:hover{background:#faf8ff;color:#4648d4;}
      .oh-usermenu__item svg{flex-shrink:0;color:#464554;}
      .oh-usermenu__item:hover svg{color:#4648d4;}
      .oh-usermenu__item--danger{color:#c0392b;}
      .oh-usermenu__item--danger svg{color:#c0392b;}
      .oh-usermenu__item--danger:hover{background:#fef2f2;color:#c0392b;}

      /* ===== Dropdown de notificações (contrato do notifications.js) ===== */
      .orbit-notif{position:relative;}
      .orbit-notif__btn{position:relative;}
      .orbit-notif__badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:8px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;}
      .orbit-notif__dropdown{position:absolute;top:calc(100% + 8px);right:0;width:320px;max-height:420px;background:#fff;border:1px solid #e2e7ff;border-radius:12px;box-shadow:0 12px 32px rgba(19,27,46,.18);z-index:300;display:flex;flex-direction:column;overflow:hidden;}
      .orbit-notif__header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e7ff;}
      .orbit-notif__title{font-family:'Manrope','Inter',sans-serif;font-weight:800;font-size:15px;color:#131b2e;}
      .orbit-notif__mark{font-size:12px;font-weight:700;color:#4648d4;background:none;border:none;cursor:pointer;}
      .orbit-notif__mark:hover{opacity:.75;}
      .orbit-notif__list{overflow-y:auto;display:flex;flex-direction:column;}
      .orbit-notif__item{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #e2e7ff;align-items:center;}
      .orbit-notif__item--unread{background:rgba(70,72,212,.04);}
      .orbit-notif__body{flex:1;min-width:0;}
      .orbit-notif__msg{font-size:13px;color:#131b2e;line-height:18px;margin:0;}
      .orbit-notif__time{font-size:11px;color:#464554;margin:2px 0 0;}
      .orbit-notif__empty{padding:24px 16px;text-align:center;font-size:13px;color:#464554;}

      @media (max-width:680px){ .oh-nav{display:none;} .oh-inner{padding:10px 16px;} }
    `;
    const style = document.createElement('style');
    style.id = 'orbit-header-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== MARKUP ===== */
  const BELL_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
  const CHAT_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const USER_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const LOGOUT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

  const NAV = [
    { key: 'feed',          href: '/pages/feed.html',          label: 'Feed' },
    { key: 'oportunidades', href: '/pages/oportunidades.html', label: 'Oportunidades' },
    { key: 'projetos',      href: '/pages/meus-projetos.html', label: 'Projetos' },
    { key: 'mensagens',     href: '/pages/mensagens.html',     label: 'Mensagens' },
  ];
  // aba ativa pela URL atual
  const FILE = location.pathname.substring(location.pathname.lastIndexOf('/') + 1);
  const ACTIVE = { 'feed.html':'feed', 'oportunidades.html':'oportunidades', 'meus-projetos.html':'projetos', 'mensagens.html':'mensagens' }[FILE] || '';

  function buildHTML() {
    const navLinks = NAV.map(n =>
      `<a href="${n.href}" class="oh-link${n.key === ACTIVE ? ' oh-link--active' : ''}">${n.label}</a>`
    ).join('');

    return `
      <header class="oh-header">
        <div class="oh-inner">
          <div class="oh-left">
            <a href="/pages/feed.html" class="oh-logo">Orbit</a>
            <nav class="oh-nav" aria-label="Navegação principal">${navLinks}</nav>
          </div>
          <div class="oh-right">
            <div class="orbit-notif" id="orbit-notif">
              <button class="oh-icon-btn orbit-notif__btn" id="notif-btn" aria-label="Notificações" title="Notificações" aria-haspopup="true" aria-expanded="false">
                ${BELL_SVG}<span class="orbit-notif__badge" id="notif-badge" hidden>0</span>
              </button>
            </div>
            <a href="/pages/mensagens.html" class="oh-icon-btn" aria-label="Mensagens" title="Mensagens">${CHAT_SVG}</a>
            <div class="oh-usermenu" id="oh-usermenu">
              <button class="oh-avatar" id="oh-avatar-btn" aria-label="Abrir menu do usuário" aria-haspopup="menu" aria-expanded="false">${avatarInner(currentUser)}</button>
              <div class="oh-usermenu__dropdown" id="oh-usermenu-dropdown" role="menu" aria-hidden="true">
                <div class="oh-usermenu__head">
                  <div class="oh-usermenu__avatar">${avatarInner(currentUser)}</div>
                  <div class="oh-usermenu__info">
                    <p class="oh-usermenu__name">${escapeHtml(currentUser.name || 'Usuário')}</p>
                    <p class="oh-usermenu__email">${escapeHtml(currentUser.email || '')}</p>
                  </div>
                </div>
                <div class="oh-usermenu__divider"></div>
                <a href="/pages/profile.html" class="oh-usermenu__item" role="menuitem">${USER_SVG}<span>Ir para o perfil</span></a>
                <button type="button" class="oh-usermenu__item oh-usermenu__item--danger" id="oh-logout" role="menuitem">${LOGOUT_SVG}<span>Sair</span></button>
              </div>
            </div>
          </div>
        </div>
      </header>`;
  }

  /* ===== WIRING ===== */
  function wire() {
    const menu     = document.getElementById('oh-usermenu');
    const avatar   = document.getElementById('oh-avatar-btn');
    const dropdown = document.getElementById('oh-usermenu-dropdown');
    const logout   = document.getElementById('oh-logout');

    function open()  { menu.classList.add('oh-usermenu--open');  avatar.setAttribute('aria-expanded','true');  dropdown.setAttribute('aria-hidden','false'); }
    function close() { menu.classList.remove('oh-usermenu--open'); avatar.setAttribute('aria-expanded','false'); dropdown.setAttribute('aria-hidden','true'); }

    avatar.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.contains('oh-usermenu--open') ? close() : open(); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    logout.addEventListener('click', () => {
      close();
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== DEPENDÊNCIAS (toast + notificações) ===== */
  function loadDeps() {
    // toast primeiro (notifications.js usa window.showToast)
    ['toast.js', 'notifications.js'].forEach(name => {
      const already = document.querySelector(`script[src*="${name}"]`);
      if (already) return;
      const s = document.createElement('script');
      s.src = sibling(name);
      s.defer = false;
      document.body.appendChild(s);
    });
  }

  /* ===== MOUNT ===== */
  function mount() {
    ensureStyles();
    let host = document.getElementById('orbit-header');
    if (!host) {
      host = document.createElement('div');
      host.id = 'orbit-header';
      document.body.insertBefore(host, document.body.firstChild);
    }
    host.innerHTML = buildHTML();
    wire();
    loadDeps();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // exposto p/ uso manual, se necessário
  window.OrbitHeader = { mount };

})();
