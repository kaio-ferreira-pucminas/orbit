// toast.js — Orbit
// Sistema de notificações global (canto inferior direito)
// Uso: showToast('Mensagem', 'success' | 'error')

(function () {
  'use strict';

  const DURATION    = 4000; // ms antes de fechar automaticamente
  const CONTAINER_ID = 'toast-container';

  /* ── Garante que o container existe ── */
  function getContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      document.body.appendChild(el);
    }
    return el;
  }

  /* ── Ícones SVG inline ── */
  const ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6"  y1="6" x2="18" y2="18"/>
              </svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>`,
  };

  /* ── Cria e exibe um toast ── */
  function showToast(message, type = 'success') {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${ICONS[type]}</span>
      <span class="toast__message">${message}</span>
      <button class="toast__close" aria-label="Fechar notificação">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    // Fecha ao clicar no X
    toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));

    container.appendChild(toast);

    // Força reflow para a animação de entrada funcionar
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    // Auto-dismiss
    const timer = setTimeout(() => dismiss(toast), DURATION);

    // Pausa o timer ao passar o mouse
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => dismiss(toast), DURATION / 2);
    });
  }

  /* ── Remove o toast com animação de saída ── */
  function dismiss(toast) {
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }

  // Expõe globalmente (showToast + alias orbitToast usado por algumas telas)
  window.showToast = showToast;
  window.orbitToast = showToast;
})();
