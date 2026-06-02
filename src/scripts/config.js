// config.js — Orbit
// Fonte única da URL da API. Detecta automaticamente se está rodando local ou em produção.
//
// COMO ATUALIZAR APÓS O DEPLOY DO BACKEND:
// Substitua 'https://orbit-api.onrender.com' abaixo pela URL real do seu backend
// hospedado (Render, Railway, etc.). Mantenha sem barra final.

(function () {
  'use strict';

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // Em produção, frontend e API são servidos pelo MESMO serviço (Railway) → mesma origem,
  // então a URL da API é relativa (''). Local mantém a API em :3001.
  window.ORBIT_API_URL = isLocal
    ? 'http://localhost:3001'
    : '';

})();
