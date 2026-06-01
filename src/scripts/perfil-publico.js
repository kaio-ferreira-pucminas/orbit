// perfil-publico.js — Orbit · Perfil Público com Depoimentos (#5 — Tiago)
// JS puro, sem framework. Backend: JSON Server (GET /api/users/:id/profile).

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');
  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }
  const currentUser = JSON.parse(userJson);

  // id do perfil a exibir — query ?id= ou cai no próprio usuário
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('id') || currentUser.id;

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, Object.assign({}, options, {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, (options && options.headers) || {}),
    }));
    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  const PROJ_GRADIENTS = [
    'linear-gradient(135deg, #131b2e 0%, #4648d4 100%)',
    'linear-gradient(135deg, #1e293b 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #4648d4 0%, #6063ee 100%)',
    'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
  ];
  function gradFor(id) {
    let h = 0; const s = String(id || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % PROJ_GRADIENTS.length;
    return PROJ_GRADIENTS[h];
  }
  function techArray(p) {
    if (Array.isArray(p.technologies)) return p.technologies;
    if (Array.isArray(p.stack)) return p.stack;
    return [];
  }
  function stars(n) {
    const full = Math.round(n || 0);
    let s = '';
    for (let i = 0; i < 5; i++) {
      s += `<svg width="16" height="16" viewBox="0 0 24 24" fill="${i < full ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>`;
    }
    return s;
  }

  /* ===== RENDER ===== */
  function render(data) {
    const user = data.user || {};
    const projects = data.projects || [];
    const reviews = data.reviews || [];
    const stats = data.stats || {};

    // Identidade
    $('#pp-name').textContent = user.name || 'Usuário';
    $('#pp-title').textContent = user.title || user.headline || 'Desenvolvedor(a)';
    $('#pp-location').textContent = user.location || 'Brasil';
    $('#pp-initials').textContent = initials(user.name);
    if (user.avatarUrl) $('#pp-avatar').innerHTML = `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" />`;

    // Stats
    $('#pp-rating').textContent = stats.rating ? stats.rating.toFixed(1) : '—';
    $('#pp-reviews-count').textContent = `(${stats.reviewsCount || reviews.length} reviews)`;
    $('#pp-connections').textContent = user.connectionsCount != null ? user.connectionsCount : '—';
    $('#pp-projects-count').textContent = stats.projectsCount != null ? stats.projectsCount : projects.length;

    // Disponibilidade
    if (user.available === false) {
      $('#pp-avail-value').textContent = 'Indisponível';
      $('#pp-avail-sub').textContent = 'Não está buscando novas conexões no momento';
    }

    // Sobre
    $('#pp-about').textContent = user.bio || 'Este usuário ainda não adicionou uma biografia.';

    // Habilidades
    $('#pp-skills').innerHTML = (user.skills || []).length
      ? (user.skills || []).map(s => `<span class="pp-skill">${escapeHtml(s)}</span>`).join('')
      : '<span class="pp-reviews__empty">Nenhuma habilidade cadastrada.</span>';

    // Depoimentos (reviews)
    const rv = $('#pp-reviews');
    rv.innerHTML = reviews.length
      ? reviews.map(r => `
          <div class="pp-review">
            <div class="pp-review__stars">${stars(r.rating)}</div>
            <p class="pp-review__comment">"${escapeHtml(r.comment || '')}"</p>
            <div class="pp-review__author">
              <div class="pp-review__avatar">${initials(r.authorName || r.author || 'Empresa')}</div>
              <div class="pp-review__author-info">
                <span class="pp-review__author-name">${escapeHtml(r.authorName || r.author || 'Empresa')}</span>
                <span class="pp-review__author-role">${escapeHtml(r.authorRole || r.companyName || 'Parceiro')}</span>
              </div>
            </div>
          </div>`).join('')
      : '<p class="pp-reviews__empty">Este usuário ainda não recebeu depoimentos.</p>';

    // Projetos
    const pj = $('#pp-projects');
    pj.innerHTML = projects.length
      ? projects.slice(0, 4).map(p => {
          const tags = techArray(p).slice(0, 3).map(t => `<span class="pp-proj-tag">${escapeHtml(t)}</span>`).join('');
          return `
            <article class="pp-proj-card">
              <div class="pp-proj-card__cover" style="background:${p.coverGradient || gradFor(p.id)}">
                <span class="pp-proj-card__cover-text">${escapeHtml(p.title || 'Projeto')}</span>
              </div>
              <div class="pp-proj-card__body">
                <h3 class="pp-proj-card__title">${escapeHtml(p.title || 'Projeto')}</h3>
                <p class="pp-proj-card__desc">${escapeHtml(p.description || '')}</p>
                ${tags ? `<div class="pp-proj-card__tags">${tags}</div>` : ''}
              </div>
            </article>`;
        }).join('')
      : '<p class="pp-projects__empty">Nenhum projeto em destaque.</p>';

    // Botão seguir: esconde se for o próprio perfil
    if (targetId === currentUser.id) {
      $('#btn-follow').style.display = 'none';
      $('#btn-message').style.display = 'none';
    } else {
      $('#btn-message').href = '/pages/mensagens.html';
    }

    $('#pp-loading').hidden = true;
    $('#pp-content').hidden = false;
  }

  /* ===== SEGUIR (compatível com/sem endpoint de follows) ===== */
  let following = false;
  async function toggleFollow() {
    const btn = $('#btn-follow');
    try {
      // tenta persistir via endpoint de follows (existe após integração com a feature de follows)
      const res = await api('/api/follows', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
      if (res.ok) {
        const data = await res.json();
        following = !!data.following;
      } else {
        following = !following; // fallback otimista
      }
    } catch (err) {
      if (err.message === 'Token expirado') return;
      following = !following; // endpoint ausente nesta branch → alterna localmente
    }
    btn.classList.toggle('is-following', following);
    btn.textContent = following ? 'Seguindo' : 'Seguir';
    toast(following ? 'Você começou a seguir.' : 'Você deixou de seguir.', 'success');
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#btn-follow').addEventListener('click', toggleFollow);
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== INIT ===== */
  async function init() {
    setupEvents();
    try {
      const res = await api(`/api/users/${targetId}/profile`);
      if (!res.ok) { $('#pp-loading').textContent = 'Perfil não encontrado.'; return; }
      render(await res.json());
    } catch (err) {
      if (err.message !== 'Token expirado') $('#pp-loading').textContent = 'Não foi possível carregar o perfil.';
    }
  }

  init();

})();
