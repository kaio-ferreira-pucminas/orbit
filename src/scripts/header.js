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
      .oh-burger{display:none;background:none;border:none;cursor:pointer;padding:8px;border-radius:6px;color:#131b2e;align-items:center;justify-content:center;}
      .oh-burger:hover{background:#e2e7ff;color:#4648d4;}
      @keyframes oh-slidedown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
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

      /* O CSS do sino/dropdown (.orbit-notif*) é injetado pelo notifications.js
         (autossuficiente), que o loadDeps já carrega — evita duplicação aqui. */

      /* ===== Busca ===== */
      .oh-search{position:relative;display:flex;align-items:center;}
      .oh-search__input{width:0;opacity:0;padding:0;border:1px solid transparent;border-radius:8px;font-size:14px;font-family:inherit;height:38px;background:#fff;color:#131b2e;transition:width .25s ease,opacity .2s,padding .25s;}
      .oh-search--open .oh-search__input{width:260px;opacity:1;padding:0 12px;border-color:#e2e7ff;margin-right:4px;}
      .oh-search--open .oh-search__input:focus{outline:none;border-color:#4648d4;}
      .oh-search__modal{position:absolute;top:calc(100% + 8px);right:0;width:360px;max-height:460px;overflow-y:auto;background:#fff;border:1px solid #e2e7ff;border-radius:12px;box-shadow:0 12px 32px rgba(19,27,46,.18);z-index:300;}
      .oh-search__group{border-bottom:1px solid #f0f0f6;padding-bottom:6px;}
      .oh-search__group-title{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#8a8a99;padding:10px 14px 4px;}
      .oh-search__item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;text-decoration:none;color:#131b2e;}
      .oh-search__item:hover{background:#f2f3ff;}
      .oh-search__item-av{width:30px;height:30px;border-radius:8px;background:#e2e7ff;color:#4648d4;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;overflow:hidden;}
      .oh-search__item-av img{width:100%;height:100%;object-fit:cover;}
      .oh-search__item-main{flex:1;min-width:0;display:flex;flex-direction:column;}
      .oh-search__item-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .oh-search__item-sub{font-size:11px;color:#464554;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .oh-search__footer{padding:10px 14px;text-align:center;font-size:13px;font-weight:700;color:#4648d4;cursor:pointer;}
      .oh-search__footer:hover{background:#f2f3ff;}
      .oh-search__empty{padding:18px 14px;text-align:center;font-size:13px;color:#8a8a99;}

      @media (max-width:680px){
        .oh-inner{padding:10px 16px;}
        .oh-left{gap:10px;}
        .oh-burger{display:flex;}
        /* Nav vira menu dropdown (abre pelo hambúrguer) */
        .oh-nav{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:2px;background:#fff;border-top:1px solid #e2e7ff;box-shadow:0 14px 28px rgba(19,27,46,.12);padding:8px 12px;z-index:350;}
        .oh-header--menu-open .oh-nav{display:flex;animation:oh-slidedown .18s ease;}
        .oh-nav .oh-link{font-size:16px;padding:12px 10px;border-bottom:none;border-radius:8px;}
        .oh-nav .oh-link--active{background:#f2f3ff;border-bottom:none;}
        /* Busca: fixa, ocupando a tela com margem (o dropdown do sino é tratado pelo notifications.js) */
        .oh-search--open .oh-search__input{position:fixed;top:8px;left:8px;right:8px;width:auto;z-index:400;height:42px;padding:0 12px;border-color:#4648d4;margin:0;}
        .oh-search__modal{position:fixed;top:58px;left:8px;right:8px;width:auto;max-height:70vh;}
      }
    `;
    const style = document.createElement('style');
    style.id = 'orbit-header-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== MARKUP ===== */
  const SEARCH_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const BELL_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
  const CHAT_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const USER_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const DASH_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
  const DASH_HREF = (currentUser.type === 'company') ? '/pages/empresa-dashboard.html' : '/pages/dashboard.html';
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
            <button class="oh-burger" id="oh-burger" type="button" aria-label="Abrir menu" aria-expanded="false">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <a href="/pages/feed.html" class="oh-logo">Orbit</a>
            <nav class="oh-nav" aria-label="Navegação principal">${navLinks}</nav>
          </div>
          <div class="oh-right">
            <div class="oh-search" id="oh-search">
              <input type="search" class="oh-search__input" id="oh-search-input" placeholder="Buscar pessoas, empresas, vagas, posts…" autocomplete="off" aria-label="Pesquisar" />
              <button class="oh-icon-btn oh-search__toggle" id="oh-search-toggle" aria-label="Pesquisar" title="Pesquisar">${SEARCH_SVG}</button>
              <div class="oh-search__modal" id="oh-search-modal" hidden></div>
            </div>
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
                <a href="${DASH_HREF}" class="oh-usermenu__item" role="menuitem">${DASH_SVG}<span>Ir para o dashboard</span></a>
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

    // Menu mobile (hambúrguer) — abre/fecha a nav no celular
    const header = document.querySelector('.oh-header');
    const burger = document.getElementById('oh-burger');
    if (header && burger) {
      burger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = header.classList.toggle('oh-header--menu-open');
        burger.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', (e) => {
        if (e.target.closest('.oh-burger')) return;
        if (!header.contains(e.target) || e.target.closest('.oh-nav .oh-link')) {
          header.classList.remove('oh-header--menu-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  /* ===== BUSCA (ícone → input → modal de resultados rápidos) ===== */
  function wireSearch() {
    const wrap   = document.getElementById('oh-search');
    const toggle = document.getElementById('oh-search-toggle');
    const input  = document.getElementById('oh-search-input');
    const modal  = document.getElementById('oh-search-modal');
    if (!wrap || !toggle || !input || !modal) return;
    const token = localStorage.getItem('orbit_token');
    const API   = window.ORBIT_API_URL || 'http://localhost:3001';
    let timer = null;

    const go = (q) => { if (q && q.trim()) window.location.href = '/pages/busca.html?q=' + encodeURIComponent(q.trim()); };
    const openS  = () => { wrap.classList.add('oh-search--open'); input.focus(); };
    const closeS = () => { wrap.classList.remove('oh-search--open'); modal.hidden = true; };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wrap.classList.contains('oh-search--open')) {
        if (input.value.trim()) go(input.value); else closeS();
      } else openS();
    });
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { modal.hidden = true; return; }
      timer = setTimeout(() => runSearch(q), 250);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); go(input.value); }
      else if (e.key === 'Escape') closeS();
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) closeS(); });

    function avMini(u) {
      if (u && u.avatarUrl) return `<img src="${escapeHtml(u.avatarUrl)}" alt="" />`;
      return escapeHtml(initials(u && u.name));
    }
    function grp(title, items) {
      return items.length ? `<div class="oh-search__group"><div class="oh-search__group-title">${title}</div>${items.join('')}</div>` : '';
    }
    function item(href, av, name, sub) {
      return `<a class="oh-search__item" href="${href}"><span class="oh-search__item-av">${av}</span><span class="oh-search__item-main"><span class="oh-search__item-name">${escapeHtml(name)}</span><span class="oh-search__item-sub">${escapeHtml(sub)}</span></span></a>`;
    }

    async function runSearch(q) {
      try {
        const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&limit=4`, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) return;
        render(q, await res.json());
      } catch (e) { /* silencioso */ }
    }

    function render(q, d) {
      const posts = (d.posts || []).slice(0, 3).map(p => item('/pages/feed.html', avMini(p.author), (p.author && p.author.name) || 'Post', (p.content || '').replace(/\s+/g, ' ').slice(0, 50)));
      const people = (d.people || []).slice(0, 3).map(u => item('/pages/perfil-publico.html?id=' + encodeURIComponent(u.id), avMini(u), u.name, u.title || 'Desenvolvedor(a)'));
      const companies = (d.companies || []).slice(0, 3).map(c => item('/pages/empresa-perfil.html?id=' + encodeURIComponent(c.id), escapeHtml(c.logoInitials || initials(c.name)), c.name, c.industry || 'Empresa'));
      const jobs = (d.jobs || []).slice(0, 3).map(j => item('/pages/vaga-detalhes.html?id=' + encodeURIComponent(j.id), '&#128188;', j.title, j.companyName || ''));
      const topics = (d.topics || []).slice(0, 3).map(t => item('/pages/busca.html?q=' + encodeURIComponent(String(t.tag).replace('#', '')), '#', t.tag, t.postsCount + ' post(s)'));

      const has = posts.length || people.length || companies.length || jobs.length || topics.length;
      modal.innerHTML = has
        ? grp('Posts', posts) + grp('Pessoas', people) + grp('Empresas', companies) + grp('Vagas', jobs) + grp('Tópicos', topics)
          + `<div class="oh-search__footer" id="oh-search-all">Ver todos os resultados de "${escapeHtml(q)}"</div>`
        : `<div class="oh-search__empty">Nenhum resultado para "${escapeHtml(q)}"</div>`;
      modal.hidden = false;
      const all = document.getElementById('oh-search-all');
      if (all) all.addEventListener('click', () => go(q));
    }
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
    wireSearch();
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
