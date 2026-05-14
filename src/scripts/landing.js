// landing.js — Orbit
// JS puro, sem framework

(function () {
  'use strict';

  /* -----------------------------------------------
     NAVBAR: toggle mobile
  ----------------------------------------------- */
  const toggle   = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const navActions = document.getElementById('navActions');

  if (toggle) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navActions.classList.toggle('open', isOpen);
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        navActions.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* -----------------------------------------------
     NAVBAR: active link
  ----------------------------------------------- */
  const links = document.querySelectorAll('.navbar__links a');
  links.forEach((link) => {
    link.addEventListener('click', () => {
      links.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  /* -----------------------------------------------
     NAVBAR: sticky shadow ao rolar
  ----------------------------------------------- */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.boxShadow = window.scrollY > 8
        ? '0 2px 16px rgba(0,0,0,.08)'
        : 'none';
    }, { passive: true });
  }

  /* -----------------------------------------------
     AUTH-AWARE: se usuário logado, troca CTAs
  ----------------------------------------------- */
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, ch => map[ch]);
  }

  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');

  if (token && userJson) {
    let user;
    try { user = JSON.parse(userJson); } catch { user = null; }

    if (user) applyLoggedInState(user);
  }

  function applyLoggedInState(user) {
    /* (1) NAVBAR: substitui Entrar/Criar Conta pelo user menu ----- */
    const navActions = document.getElementById('navActions');
    if (navActions) {
      navActions.innerHTML = `
        <div class="landing-user-menu" id="landingUserMenu">
          <button class="landing-user-menu__avatar" type="button"
            id="landingAvatarBtn" aria-haspopup="menu" aria-expanded="false">
            ${ user.avatarUrl
              ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" />`
              : `<span>${escapeHtml(initials(user.name))}</span>`
            }
          </button>

          <div class="landing-user-menu__dropdown" role="menu" aria-hidden="true">
            <div class="landing-user-menu__header">
              <div class="landing-user-menu__avatar" style="cursor:default">
                ${ user.avatarUrl
                  ? `<img src="${escapeHtml(user.avatarUrl)}" alt="" />`
                  : `<span>${escapeHtml(initials(user.name))}</span>`
                }
              </div>
              <div class="landing-user-menu__user-info">
                <p class="landing-user-menu__name">${escapeHtml(user.name)}</p>
                <p class="landing-user-menu__email">${escapeHtml(user.email)}</p>
              </div>
            </div>

            <div class="landing-user-menu__divider"></div>

            <a href="/pages/feed.html" class="landing-user-menu__item" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="9"/>
                <rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/>
                <rect x="3" y="16" width="7" height="5"/>
              </svg>
              <span>Ir para o Feed</span>
            </a>

            <a href="/pages/profile.html" class="landing-user-menu__item" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Meu perfil</span>
            </a>

            <button type="button" class="landing-user-menu__item landing-user-menu__item--danger"
              id="landingLogoutBtn" role="menuitem">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      `;

      // Wire dropdown
      const menu      = document.getElementById('landingUserMenu');
      const avatarBtn = document.getElementById('landingAvatarBtn');
      const logoutBtn = document.getElementById('landingLogoutBtn');

      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('landing-user-menu--open');
        avatarBtn.setAttribute('aria-expanded',
          menu.classList.contains('landing-user-menu--open') ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
          menu.classList.remove('landing-user-menu--open');
          avatarBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          menu.classList.remove('landing-user-menu--open');
          avatarBtn.setAttribute('aria-expanded', 'false');
        }
      });

      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('orbit_token');
        localStorage.removeItem('orbit_user');
        if (window.showToast) window.showToast('Você saiu da sua conta.', 'success');
        setTimeout(() => window.location.reload(), 800);
      });
    }

    /* (2) HERO: substitui 2 CTAs por 1 "Ir para o Feed" ----- */
    const heroActions = document.querySelector('.hero__actions');
    if (heroActions) {
      heroActions.innerHTML = `
        <a href="/pages/feed.html" class="btn btn--primary btn--lg">Ir para o Feed</a>
        <a href="/pages/profile.html" class="btn btn--outline btn--lg">Ver meu perfil</a>
      `;
    }

    /* (3) CTA section bottom: substitui CTAs ----- */
    const ctaActions = document.querySelector('.cta__actions');
    if (ctaActions) {
      ctaActions.innerHTML = `
        <a href="/pages/feed.html" class="btn btn--white btn--lg">Ir para o Feed</a>
      `;
    }

    /* (4) Segmented section: redireciona links para feed.html ----- */
    document.querySelectorAll('a[href*="auth.html"]').forEach((a) => {
      a.href = '/pages/feed.html';
    });
  }

})();
