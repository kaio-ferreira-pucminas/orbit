// config.js — Orbit
// Fonte única da URL da API. Detecta automaticamente se está rodando local ou em produção.
//
// COMO ATUALIZAR APÓS O DEPLOY DO BACKEND:
// Substitua 'https://orbit-api.onrender.com' abaixo pela URL real do seu backend
// hospedado (Render, Railway, etc.). Mantenha sem barra final.

(function () {
  'use strict';

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // Em produção, frontend e API são servidos pelo MESMO serviço (Railway) → mesma origem.
  // Usamos window.location.origin (e NÃO '') porque os scripts fazem
  // `window.ORBIT_API_URL || 'http://localhost:3001'`, e '' é falsy → cairia no localhost.
  window.ORBIT_API_URL = isLocal
    ? 'http://localhost:3001'
    : window.location.origin;

})();

// ============================================================
// Fallback GLOBAL de avatar/logo: se a imagem de perfil falhar ao carregar
// (ex.: arquivo ausente), troca automaticamente pelas INICIAIS — evita o ícone
// de "imagem quebrada". Cobre toda a aplicação (config.js é incluído em todas as telas).
// ============================================================
(function () {
  'use strict';

  function initialsFrom(name) {
    if (!name) return 'U';
    const ini = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
    return ini || 'U';
  }

  // Estilo das iniciais de fallback (centralizado, herda a cor do container)
  function ensureStyle() {
    if (document.getElementById('av-fallback-style')) return;
    const st = document.createElement('style');
    st.id = 'av-fallback-style';
    st.textContent =
      '.av-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:700;line-height:1;color:inherit;}' +
      '.emp-sidebar__logo-icon{color:#fff;}' +
      // iOS dá "zoom" automático ao focar inputs com font-size < 16px. Forçamos 16px nos campos
      // de texto em dispositivos de toque (cobre TODO o site, todos os navegadores) p/ evitar o zoom.
      '@media (pointer: coarse){' +
        'input[type="text"],input[type="email"],input[type="password"],input[type="search"],input[type="tel"],input[type="url"],input[type="number"],input[type="date"],input:not([type]),textarea,select{font-size:16px !important;}' +
      '}';
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureStyle);
  else ensureStyle();

  // Eventos de 'error' de recursos (img) não borbulham → captura na fase de captura.
  document.addEventListener('error', function (e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.avFallback) return;
    // Só trata imagens de avatar/logo (container com 'avatar'/'logo'/'-av' no class ou data-avatar)
    const holder = img.closest('[class*="avatar"], [class*="logo"], [class*="-av"], [data-avatar]');
    if (!holder) return;
    img.dataset.avFallback = '1';
    const name = img.getAttribute('alt') || holder.getAttribute('data-name') || '';
    const span = document.createElement('span');
    span.className = 'av-fallback';
    span.textContent = initialsFrom(name);
    img.replaceWith(span);
  }, true);
})();

// ============================================================
// Heartbeat de presença: enquanto houver uma tela logada aberta, marca o usuário
// como "online" (atualiza lastSeenAt). Usado pela badge de status do chat.
// ============================================================
(function () {
  'use strict';
  function beat() {
    const token = localStorage.getItem('orbit_token');
    if (!token) return;
    fetch((window.ORBIT_API_URL || '') + '/api/heartbeat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    }).catch(function () { /* silencioso */ });
  }
  beat();
  setInterval(function () { if (document.visibilityState !== 'hidden') beat(); }, 30000);
})();

// ============================================================
// Badge de mensagens não lidas no item "Mensagens" da sidebar (dev e empresa).
// Conta quantas CONVERSAS têm mensagens ainda não vistas; some quando é zero,
// para não poluir. Transversal: decora qualquer link de sidebar para mensagens.
// ============================================================
(function () {
  'use strict';
  const token = localStorage.getItem('orbit_token');
  if (!token) return;

  function ensureStyle() {
    if (document.getElementById('orbit-msg-badge-style')) return;
    const st = document.createElement('style');
    st.id = 'orbit-msg-badge-style';
    st.textContent =
      // Badge como FILHO FLEX do link (margin-left:auto): o próprio link (display:flex,
      // align-items:center) centraliza verticalmente → alinhamento perfeito com a label.
      // line-height = height centraliza o número dentro da bolinha.
      '.orbit-msg-badge{margin-left:auto;flex-shrink:0;min-width:18px;height:18px;padding:0 6px;box-sizing:border-box;border-radius:9px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 1px 3px rgba(239,68,68,.4);pointer-events:none;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function setBadge(count) {
    const links = document.querySelectorAll('a.dash-nav__link[href*="mensagens"], a.emp-nav__link[href*="mensagens"]');
    links.forEach(function (link) {
      let badge = link.querySelector('.orbit-msg-badge');
      if (count > 0) {
        if (!badge) {
          link.classList.add('orbit-has-msg-badge');
          badge = document.createElement('span');
          badge.className = 'orbit-msg-badge';
          badge.setAttribute('aria-label', 'mensagens não lidas');
          link.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : String(count);
      } else if (badge) {
        badge.remove();
        link.classList.remove('orbit-has-msg-badge');
      }
    });
  }

  async function poll() {
    try {
      const res = await fetch((window.ORBIT_API_URL || '') + '/api/conversations/me', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) return;
      const list = await res.json();
      const count = Array.isArray(list) ? list.filter(function (c) { return (c.unreadCount || 0) > 0; }).length : 0;
      setBadge(count);
    } catch (e) { /* silencioso */ }
  }

  function start() {
    ensureStyle();
    poll();
    setInterval(function () { if (document.visibilityState !== 'hidden') poll(); }, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// ============================================================
// Chrome mobile do dashboard: carrega o mobile-sidebar.js (sidebar off-canvas +
// sino fixo no topo-direito) automaticamente em QUALQUER tela que tenha sidebar.
// Assim nenhuma página precisa ser editada e telas novas ganham o comportamento
// de graça (atende ao pedido de "uma função que renderize por mim").
// ============================================================
(function () {
  'use strict';
  const SELF = document.currentScript;
  function srcFor(name) {
    const base = (SELF && SELF.src) ? SELF.src.replace(/config\.js(\?.*)?$/, '') : '../scripts/';
    return base + name;
  }
  function loadChrome() {
    if (!document.querySelector('.dash-sidebar, .emp-sidebar')) return;       // tela sem sidebar
    if (document.querySelector('script[src*="mobile-sidebar.js"]')) return;   // já incluído na página
    const s = document.createElement('script');
    s.src = srcFor('mobile-sidebar.js');
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadChrome);
  else loadChrome();
})();
