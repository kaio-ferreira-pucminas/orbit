// toast.js — Orbit
// Sistema de notificações global (canto superior direito) — autossuficiente:
// injeta seu próprio CSS, então funciona em qualquer tela que inclua este script.
// Uso: showToast('Mensagem', 'success' | 'error' | 'info')

(function () {
  'use strict';

  const DURATION    = 4000; // ms antes de fechar automaticamente
  const CONTAINER_ID = 'toast-container';
  const STYLE_ID     = 'orbit-toast-style';

  /* ── Injeta o CSS do toast (uma única vez) ──
     Torna o componente autossuficiente: o toast aparece no canto superior
     direito em QUALQUER tela que inclua este script, sem depender de qual
     folha de estilo a página carrega. */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      #${CONTAINER_ID}{position:fixed;top:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;}
      #${CONTAINER_ID} .toast{display:flex;align-items:center;gap:12px;min-width:280px;max-width:380px;padding:14px 16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:500;line-height:1.4;pointer-events:all;cursor:default;opacity:0;transform:translateX(110%);transition:opacity .3s ease,transform .3s ease;}
      #${CONTAINER_ID} .toast--visible{opacity:1;transform:translateX(0);}
      #${CONTAINER_ID} .toast--hiding{opacity:0;transform:translateX(110%);}
      #${CONTAINER_ID} .toast--success{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;}
      #${CONTAINER_ID} .toast--success .toast__icon{color:#059669;}
      #${CONTAINER_ID} .toast--error{background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;}
      #${CONTAINER_ID} .toast--error .toast__icon{color:#dc2626;}
      #${CONTAINER_ID} .toast--info{background:#eef0ff;border:1px solid #b4baf5;color:#2e3192;}
      #${CONTAINER_ID} .toast--info .toast__icon{color:#4648d4;}
      #${CONTAINER_ID} .toast__icon{flex-shrink:0;display:flex;align-items:center;}
      #${CONTAINER_ID} .toast__message{flex:1;}
      #${CONTAINER_ID} .toast__close{flex-shrink:0;display:flex;align-items:center;background:none;border:none;cursor:pointer;padding:2px;border-radius:4px;color:inherit;opacity:.6;transition:opacity .2s;}
      #${CONTAINER_ID} .toast__close:hover{opacity:1;}
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Garante que o container existe ── */
  function getContainer() {
    ensureStyles();
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
      <span class="toast__message"></span>
      <button class="toast__close" aria-label="Fechar notificação">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    // textContent (e não innerHTML): a mensagem pode conter dados de outros
    // usuários (nomes, títulos) — nunca interpretar como HTML
    toast.querySelector('.toast__message').textContent = message;

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
