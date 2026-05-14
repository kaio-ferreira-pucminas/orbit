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

})();
