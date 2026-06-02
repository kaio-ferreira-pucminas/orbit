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
