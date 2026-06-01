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

  /* ===== ÍCONES ===== */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    projetos:  '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    oportunidades: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    mensagens: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    config:    '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>',
    logout:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    orbit:     '<circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/><path d="M3 12 Q7 6 12 12 Q17 18 21 12" stroke="white" stroke-width="1.5" fill="none"/>',
  };
  function navIcon(paths) {
    return `<svg class="dash-nav__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  /* ===== NAV ===== */
  const NAV = [
    { key: 'dashboard',     href: '/pages/dashboard.html',     label: 'Dashboard',     icon: ICONS.dashboard },
    { key: 'projetos',      href: '/pages/meus-projetos.html', label: 'Meus Projetos', icon: ICONS.projetos },
    { key: 'oportunidades', href: '/pages/oportunidades.html', label: 'Oportunidades', icon: ICONS.oportunidades },
    { key: 'mensagens',     href: '/pages/mensagens.html',     label: 'Mensagens',     icon: ICONS.mensagens },
  ];
  // aba ativa pela URL (vagas/vaga-detalhes contam como Oportunidades)
  const FILE = location.pathname.substring(location.pathname.lastIndexOf('/') + 1);
  const ACTIVE = {
    'dashboard.html': 'dashboard',
    'meus-projetos.html': 'projetos',
    'oportunidades.html': 'oportunidades',
    'vagas.html': 'oportunidades',
    'vaga-detalhes.html': 'oportunidades',
    'mensagens.html': 'mensagens',
  }[FILE] || '';

  /* ===== MARKUP ===== */
  function buildHTML() {
    const links = NAV.map(n => {
      const active = n.key === ACTIVE;
      return `<a href="${n.href}" class="dash-nav__link${active ? ' dash-nav__link--active' : ''}"${active ? ' aria-current="page"' : ''}>${navIcon(n.icon)}<span>${n.label}</span></a>`;
    }).join('');

    return `
      <aside class="dash-sidebar" aria-label="Menu lateral">
        <div class="dash-sidebar__brand">
          <div class="dash-sidebar__logo-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${ICONS.orbit}</svg>
          </div>
          <div class="dash-sidebar__brand-text">
            <span class="dash-sidebar__brand-name">Meu Orbit</span>
            <span class="dash-sidebar__brand-sub">PAINEL DE CONTROLE</span>
          </div>
        </div>

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

  /* ===== MOUNT (síncrono: roda antes do script da página) ===== */
  function mount() {
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
