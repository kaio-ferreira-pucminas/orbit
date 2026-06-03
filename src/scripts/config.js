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
      '.emp-sidebar__logo-icon{color:#fff;}';
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
