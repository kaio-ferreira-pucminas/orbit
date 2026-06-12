// sidebar.js — Orbit · Sidebar unificada (OrbitSidebar)
// Componente transversal das telas DEV com menu lateral. Renderiza a sidebar via JS
// (reusa as classes .dash-sidebar/.dash-nav já estilizadas pelo CSS de cada página,
// então não há shift de layout), com TODOS os links corretos + aba ativa pela URL +
// logout. Basta incluir, ANTES do script principal da página:
//     <div id="orbit-sidebar"></div>
//     <script src="../scripts/sidebar.js"></script>
// JS puro, sem framework.

(function () {
  'use strict';

  /* ===== USUÁRIO LOGADO ===== */
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('orbit_user') || 'null'); } catch (e) { currentUser = null; }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function userRole(u) {
    if (!u) return 'Desenvolvedor(a)';
    return u.title || (u.type === 'company' ? 'Empresa' : 'Desenvolvedor(a)');
  }
  function brandAvatar(u) {
    if (u && u.avatarUrl) return `<img src="${escapeHtml(u.avatarUrl)}" alt="${escapeHtml(u.name || '')}" />`;
    return `<span>${escapeHtml(initials(u && u.name))}</span>`;
  }

  /* ===== ÍCONES ===== */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    feed:      '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    projetos:  '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    oportunidades: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    mensagens: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    talentos:  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    agenda:    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    entrevistas: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    config:    '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>',
    logout:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    orbit:     '<circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/><path d="M3 12 Q7 6 12 12 Q17 18 21 12" stroke="white" stroke-width="1.5" fill="none"/>',
  };
  function navIcon(paths) {
    return `<svg class="dash-nav__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  /* ===== NAV (adapta por tipo de conta) ===== */
  const isCompany = !!(currentUser && currentUser.type === 'company');
  const NAV = isCompany ? [
    { key: 'dashboard', href: '/pages/empresa-dashboard.html', label: 'Dashboard',         icon: ICONS.dashboard },
    { key: 'feed',      href: '/pages/feed.html',              label: 'Feed',              icon: ICONS.feed },
    { key: 'agenda',    href: '/pages/agenda.html',            label: 'Agenda',            icon: ICONS.agenda },
    { key: 'talentos',  href: '/pages/empresa-talentos.html',  label: 'Busca de Talentos', icon: ICONS.talentos },
    { key: 'vagas',     href: '/pages/empresa-vagas.html',      label: 'Gerenciar Vagas',   icon: ICONS.oportunidades },
    { key: 'entrevistas', href: '/pages/entrevistas.html',     label: 'Entrevistas',       icon: ICONS.entrevistas },
    { key: 'mensagens', href: '/pages/mensagens.html',         label: 'Mensagens',         icon: ICONS.mensagens },
  ] : [
    { key: 'dashboard',     href: '/pages/dashboard.html',     label: 'Dashboard',     icon: ICONS.dashboard },
    { key: 'feed',          href: '/pages/feed.html',          label: 'Feed',          icon: ICONS.feed },
    { key: 'agenda',        href: '/pages/agenda.html',        label: 'Agenda',        icon: ICONS.agenda },
    { key: 'projetos',      href: '/pages/meus-projetos.html', label: 'Meus Projetos', icon: ICONS.projetos },
    { key: 'oportunidades', href: '/pages/oportunidades.html', label: 'Oportunidades', icon: ICONS.oportunidades },
    { key: 'entrevistas',   href: '/pages/entrevistas.html',   label: 'Entrevistas',   icon: ICONS.entrevistas },
    { key: 'mensagens',     href: '/pages/mensagens.html',     label: 'Mensagens',     icon: ICONS.mensagens },
  ];
  // aba ativa pela URL
  const FILE = location.pathname.substring(location.pathname.lastIndexOf('/') + 1);
  const ACTIVE = (isCompany ? {
    'empresa-dashboard.html': 'dashboard',
    'feed.html': 'feed',
    'agenda.html': 'agenda',
    'empresa-talentos.html':  'talentos',
    'empresa-vagas.html': 'vagas',
    'empresa-nova-vaga.html': 'vagas',
    'empresa-candidatos.html': 'vagas',
    'entrevistas.html': 'entrevistas',
    'mensagens.html': 'mensagens',
  } : {
    'dashboard.html': 'dashboard',
    'feed.html': 'feed',
    'agenda.html': 'agenda',
    'meus-projetos.html': 'projetos',
    'oportunidades.html': 'oportunidades',
    'vagas.html': 'oportunidades',
    'vaga-detalhes.html': 'oportunidades',
    'entrevistas.html': 'entrevistas',
    'mensagens.html': 'mensagens',
  })[FILE] || '';

  /* ===== MARKUP ===== */
  function buildHTML() {
    const links = NAV.map(n => {
      const active = n.key === ACTIVE;
      return `<a href="${n.href}" class="dash-nav__link${active ? ' dash-nav__link--active' : ''}"${active ? ' aria-current="page"' : ''}>${navIcon(n.icon)}<span>${n.label}</span></a>`;
    }).join('');

    return `
      <aside class="dash-sidebar" aria-label="Menu lateral">
        <a href="/pages/profile.html" class="dash-sidebar__brand dash-sidebar__brand--user" title="Ver meu perfil">
          <div class="dash-sidebar__logo-icon dash-sidebar__avatar">${brandAvatar(currentUser)}</div>
          <div class="dash-sidebar__brand-text">
            <span class="dash-sidebar__brand-name">${escapeHtml(currentUser && currentUser.name ? currentUser.name : 'Usuário')}</span>
            <span class="dash-sidebar__brand-sub dash-sidebar__brand-role">${escapeHtml(userRole(currentUser))}</span>
          </div>
        </a>

        <nav class="dash-sidebar__nav" aria-label="Navegação principal">${links}</nav>

        <div class="dash-sidebar__bottom">
          <div class="dash-sidebar__divider"></div>
          <a href="/pages/profile.html" class="dash-nav__link${ACTIVE === 'config' ? ' dash-nav__link--active' : ''}">${navIcon(ICONS.config)}<span>Configurações</span></a>
          <button type="button" class="dash-nav__link dash-nav__link--btn" id="btn-logout">${navIcon(ICONS.logout)}<span>Sair</span></button>
        </div>
      </aside>`;
  }

  /* ===== WIRING (logout) =====
     Liga o logout no componente. As páginas que também ligam #btn-logout continuam
     funcionando (efeito idêntico: limpa sessão e volta ao login). */
  function wire() {
    const logout = document.getElementById('btn-logout');
    if (logout) {
      logout.addEventListener('click', () => {
        localStorage.removeItem('orbit_token');
        localStorage.removeItem('orbit_user');
        window.location.href = '/pages/auth.html?tab=login';
      });
    }
  }

  /* ===== CSS (ajustes da área de perfil — injetado uma vez) ===== */
  function ensureStyles() {
    if (document.getElementById('orbit-sidebar-style')) return;
    const css = `
      .dash-sidebar__brand--user{text-decoration:none;cursor:pointer;}
      .dash-sidebar__brand--user:hover .dash-sidebar__brand-name{color:var(--primary,#4648d4);}
      .dash-sidebar__avatar{overflow:hidden;}
      .dash-sidebar__avatar img{width:100%;height:100%;object-fit:cover;display:block;}
      .dash-sidebar__avatar span{color:#fff;font-weight:700;font-size:14px;}
      .dash-sidebar__brand-text{min-width:0;}
      .dash-sidebar__brand--user .dash-sidebar__brand-name{font-size:16px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dash-sidebar__brand-role{text-transform:none;letter-spacing:0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    `;
    const style = document.createElement('style');
    style.id = 'orbit-sidebar-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== MOUNT (síncrono: roda antes do script da página) ===== */
  function mount() {
    ensureStyles();
    let host = document.getElementById('orbit-sidebar');
    if (!host) {
      host = document.createElement('div');
      host.id = 'orbit-sidebar';
      document.body.insertBefore(host, document.body.firstChild);
    }
    host.innerHTML = buildHTML();
    wire();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }

  window.OrbitSidebar = { mount };

})();
