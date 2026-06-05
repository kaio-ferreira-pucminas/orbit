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

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function mesAno(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

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

    // Orbit Pro — "Na órbita desde <mês ano>" a partir do createdAt
    const desde = mesAno(user.createdAt);
    if (desde) $('#pp-pro-sub').textContent = `Na órbita desde ${desde}`;

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

    // Projetos (clicáveis → modal com a aplicação rodando + avaliações)
    projectsCache = projects;
    const pj = $('#pp-projects');
    pj.innerHTML = projects.length
      ? projects.slice(0, 6).map(p => {
          const tags = techArray(p).slice(0, 3).map(t => `<span class="pp-proj-tag">${escapeHtml(t)}</span>`).join('');
          const rating = p.ratingCount ? `<span class="pp-proj-card__rating">★ ${p.ratingAvg || 0} (${p.ratingCount})</span>` : '';
          return `
            <article class="pp-proj-card pp-proj-card--clickable" data-proj-id="${escapeHtml(p.id)}" role="button" tabindex="0" title="Ver projeto">
              <div class="pp-proj-card__cover" style="background:${p.coverGradient || gradFor(p.id)}">
                <span class="pp-proj-card__cover-text">${escapeHtml(p.title || 'Projeto')}</span>
                ${p.liveUrl ? '<span class="pp-proj-card__live">● ao vivo</span>' : ''}
              </div>
              <div class="pp-proj-card__body">
                <h3 class="pp-proj-card__title">${escapeHtml(p.title || 'Projeto')}</h3>
                <p class="pp-proj-card__desc">${escapeHtml(p.description || '')}</p>
                ${tags ? `<div class="pp-proj-card__tags">${tags}</div>` : ''}
                ${rating}
              </div>
            </article>`;
        }).join('')
      : '<p class="pp-projects__empty">Nenhum projeto em destaque.</p>';

    // Contribuições do GitHub (somente devs que informaram o github)
    if (user.type === 'dev' && user.github && window.OrbitContrib) {
      const sec = $('#pp-contrib-section'); if (sec) sec.hidden = false;
      window.OrbitContrib.mount($('#gc-pub'), user.github);
    }

    // Botão seguir: esconde se for o próprio perfil
    if (targetId === currentUser.id) {
      $('#btn-follow').style.display = 'none';
    }
    // Visibilidade inicial do botão Mensagem (empresa já vê; dev só após follow-status)
    updateMessageButton();

    $('#pp-loading').hidden = true;
    $('#pp-content').hidden = false;
  }

  /* ===== REGRA DO BOTÃO MENSAGEM =====
     Aparece se: sou empresa (posso falar direto) OU já sigo o dono do perfil.
     Nunca aparece no próprio perfil. */
  function canMessage() {
    return currentUser.type === 'company' || following === true;
  }
  function updateMessageButton() {
    const msg = $('#btn-message');
    if (!msg) return;
    if (targetId === currentUser.id) { msg.style.display = 'none'; return; }
    msg.style.display = canMessage() ? '' : 'none';
  }
  // Reflete o estado de follow no botão Seguir + revalida o botão Mensagem
  function applyFollowState() {
    const btn = $('#btn-follow');
    if (btn && targetId !== currentUser.id) {
      btn.classList.toggle('is-following', following);
      btn.textContent = following ? 'Seguindo' : 'Seguir';
    }
    updateMessageButton();
  }
  // Busca o estado real de follow no load (corrige o rótulo e a visibilidade)
  async function loadFollowStatus() {
    if (targetId === currentUser.id) return;
    try {
      const res = await api(`/api/users/${targetId}/follow-status`);
      if (res.ok) {
        const data = await res.json();
        following = !!data.following;
      }
    } catch (err) { /* mantém following=false em caso de erro */ }
    applyFollowState();
  }

  /* ===== SEGUIR (compatível com/sem endpoint de follows) ===== */
  let following = false;
  let projectsCache = [];
  async function toggleFollow() {
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
    applyFollowState(); // atualiza rótulo do Seguir + mostra/esconde o Mensagem
    toast(following ? 'Você começou a seguir.' : 'Você deixou de seguir.', 'success');
  }

  /* ===== MENSAGEM: cria/reaproveita a conversa e abre o chat ===== */
  async function startConversationAndGo() {
    try {
      const res  = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Não foi possível iniciar a conversa.', 'error');
        return;
      }
      // redireciona já com a conversa aberta (deep-link tratado em mensagens.js)
      window.location.href = `/pages/mensagens.html?c=${encodeURIComponent(data.id)}`;
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível iniciar a conversa.', 'error');
    }
  }

  /* ===== MODAL DE PROJETO (roda a aplicação dentro do Orbit + avaliações) ===== */
  let projModalEl = null;
  function ensureProjModal() {
    if (projModalEl) return projModalEl;
    const el = document.createElement('div');
    el.className = 'pp-projmodal'; el.hidden = true;
    el.innerHTML =
      '<div class="pp-projmodal__overlay" data-close></div>' +
      '<div class="pp-projmodal__dialog" role="dialog" aria-modal="true">' +
        '<header class="pp-projmodal__head"><h2 class="pp-projmodal__title" id="ppm-title"></h2>' +
          '<button type="button" class="pp-projmodal__close" data-close aria-label="Fechar">&times;</button></header>' +
        '<div class="pp-projmodal__body" id="ppm-body"></div>' +
      '</div>';
    el.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeProjModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) closeProjModal(); });
    document.body.appendChild(el);
    projModalEl = el; return el;
  }
  function closeProjModal() { if (projModalEl) { projModalEl.hidden = true; const b = $('#ppm-body'); if (b) b.innerHTML = ''; } }

  function openProjectModal(proj) {
    ensureProjModal();
    $('#ppm-title').textContent = proj.title || 'Projeto';
    const live = proj.liveUrl;
    const repo = proj.repoUrl || proj.githubUrl;
    const tags = techArray(proj).map(t => `<span class="pp-proj-tag">${escapeHtml(t)}</span>`).join('');
    const isOwner = targetId === currentUser.id;
    let starsHtml = '<div class="ppm-stars-input" id="ppm-stars">';
    for (let i = 1; i <= 5; i++) starsHtml += `<button type="button" class="ppm-star" data-val="${i}" aria-label="${i}">★</button>`;
    starsHtml += '</div>';
    $('#ppm-body').innerHTML =
      (live
        ? `<div class="ppm-live"><iframe class="ppm-iframe" src="${escapeHtml(live)}" sandbox="allow-scripts allow-forms allow-popups allow-same-origin" referrerpolicy="no-referrer" loading="lazy"></iframe>
             <p class="ppm-live__hint">Rodando dentro do Orbit. Se a página não carregar (alguns sites bloqueiam incorporação), <a href="${escapeHtml(live)}" target="_blank" rel="noopener noreferrer">abra em nova aba</a>.</p></div>`
        : '<div class="ppm-nolive">Este projeto não tem URL publicada para rodar aqui.</div>') +
      `<div class="ppm-meta">
         ${proj.description ? `<p class="ppm-desc">${escapeHtml(proj.description)}</p>` : ''}
         ${tags ? `<div class="pp-proj-card__tags">${tags}</div>` : ''}
         <div class="ppm-links">
           ${repo ? `<a href="${escapeHtml(repo)}" target="_blank" rel="noopener noreferrer" class="ppm-link">Ver repositório</a>` : ''}
           ${live ? `<a href="${escapeHtml(live)}" target="_blank" rel="noopener noreferrer" class="ppm-link">Abrir em nova aba</a>` : ''}
         </div>
       </div>
       <div class="ppm-reviews">
         <h3 class="ppm-reviews__title">Avaliações <span id="ppm-avg"></span></h3>
         <div id="ppm-review-list" class="ppm-review-list"><p class="pp-reviews__empty">Carregando…</p></div>
         ${isOwner ? '<p class="pp-reviews__empty">Você não pode avaliar o próprio projeto.</p>'
           : `<form class="ppm-form" id="ppm-form">${starsHtml}<textarea id="ppm-comment" class="ppm-comment" rows="2" placeholder="Comentário (opcional)"></textarea><button type="submit" class="ppm-submit">Enviar avaliação</button></form>`}
       </div>`;
    projModalEl.hidden = false;

    let selected = 0;
    const starsBox = $('#ppm-stars');
    if (starsBox) starsBox.addEventListener('click', (e) => {
      const b = e.target.closest('.ppm-star'); if (!b) return;
      selected = parseInt(b.getAttribute('data-val'), 10);
      Array.prototype.forEach.call(starsBox.querySelectorAll('.ppm-star'), (s, i) => s.classList.toggle('is-on', i < selected));
    });
    const form = $('#ppm-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selected) { toast('Dê uma nota de 1 a 5.', 'error'); return; }
      submitProjectReview(proj.id, selected, $('#ppm-comment').value.trim());
    });
    loadProjectReviews(proj.id);
  }

  async function loadProjectReviews(projId) {
    try {
      const res = await api(`/api/projects/${projId}/reviews`);
      const list = await res.json();
      const box = $('#ppm-review-list'); if (!box) return;
      const proj = projectsCache.find(p => String(p.id) === String(projId));
      const avgEl = $('#ppm-avg'); if (avgEl && proj) avgEl.textContent = proj.ratingCount ? `· ★ ${proj.ratingAvg} (${proj.ratingCount})` : '';
      box.innerHTML = (Array.isArray(list) && list.length)
        ? list.map(r => `<div class="ppm-rv"><div class="ppm-rv__top"><strong>${escapeHtml(r.authorName)}</strong><span class="ppm-rv__stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div>${r.comment ? `<p class="ppm-rv__c">${escapeHtml(r.comment)}</p>` : ''}</div>`).join('')
        : '<p class="pp-reviews__empty">Ainda sem avaliações. Seja o primeiro!</p>';
    } catch (e) { /* silencioso */ }
  }

  async function submitProjectReview(projId, rating, comment) {
    try {
      const res = await api(`/api/projects/${projId}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível avaliar.', 'error'); return; }
      const proj = projectsCache.find(p => String(p.id) === String(projId));
      if (proj) { proj.ratingAvg = data.ratingAvg; proj.ratingCount = data.ratingCount; }
      toast('Avaliação enviada!', 'success');
      const f = $('#ppm-form'); if (f) f.reset();
      const sb = $('#ppm-stars'); if (sb) Array.prototype.forEach.call(sb.querySelectorAll('.ppm-star'), s => s.classList.remove('is-on'));
      loadProjectReviews(projId);
    } catch (err) { if (err.message !== 'Token expirado') toast('Não foi possível avaliar.', 'error'); }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    const follow = $('#btn-follow');
    if (follow) follow.addEventListener('click', toggleFollow);
    const msg = $('#btn-message');
    if (msg) msg.addEventListener('click', (e) => { e.preventDefault(); startConversationAndGo(); });
    const pj = $('#pp-projects');
    if (pj) pj.addEventListener('click', (e) => {
      const card = e.target.closest('[data-proj-id]'); if (!card) return;
      const proj = projectsCache.find(p => String(p.id) === String(card.getAttribute('data-proj-id')));
      if (proj) openProjectModal(proj);
    });
  }

  /* ===== INIT ===== */
  async function init() {
    setupEvents();
    try {
      const res = await api(`/api/users/${targetId}/profile`);
      if (!res.ok) { $('#pp-loading').textContent = 'Perfil não encontrado.'; return; }
      render(await res.json());
      await loadFollowStatus(); // estado real de follow → rótulo + visibilidade do Mensagem
    } catch (err) {
      if (err.message !== 'Token expirado') $('#pp-loading').textContent = 'Não foi possível carregar o perfil.';
    }
  }

  init();

})();
