// 404.js — Orbit
// Mostra "Ir para o Feed" se o usuário estiver logado, "Voltar ao início" caso contrário

(function () {
  'use strict';

  const token = localStorage.getItem('orbit_token');
  const user  = localStorage.getItem('orbit_user');

  if (token && user) {
    // Usuário logado: prioriza o Feed
    const primary = document.getElementById('error-cta-primary');
    const feedBtn = document.getElementById('error-cta-feed');

    if (primary) {
      primary.textContent = 'Ir para o Feed';
      primary.href        = '/pages/feed.html';
    }

    if (feedBtn) {
      feedBtn.textContent = 'Voltar ao início';
      feedBtn.href        = '/pages/index.html';
      feedBtn.style.display = '';
    }
  }
  // Se deslogado: layout padrão "Voltar ao início" + botão feed oculto
})();
