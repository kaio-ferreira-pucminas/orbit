// empresa-talento.js — Orbit · Perfil do Talento (visão recrutador/empresa)
// Mostra o perfil de um candidato para a empresa: hero + projetos + avaliações
// + habilidades + Score Orbit. JS puro, sem framework.

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  function $(s, root = document) { return root.querySelector(s); }
  function $$(s, root = document) { return [...root.querySelectorAll(s)]; }
  function escapeHtml(t) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(t == null ? '' : t).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function toast(msg, type) { if (window.showToast) window.showToast(msg, type); }

  /* ===== AUTH ===== */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');
  if (!token || !userJson) { window.location.href = '/pages/auth.html?tab=login'; return; }
  const currentUser = JSON.parse(userJson);

  const targetId = new URLSearchParams(window.location.search).get('id');
  if (!targetId) { window.location.href = '/pages/empresa-talentos.html'; return; }

  async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  /* ===== IDENTIDADE (topbar + sidebar) ===== */
  function renderIdentity() {
    const name = currentUser.name || 'Empresa';
    $('#sidebar-company-name').textContent = name;
    $('#emp-initials').textContent = initials(name);
    if (currentUser.avatarUrl) $('#emp-avatar').innerHTML = `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="${escapeHtml(name)}" />`;
  }

  /* ===== HELPERS DE RENDER ===== */
  const ICON = {
    loc:  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    sal:  '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    exp:  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    lang: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  };
  function metaItem(iconPaths, text) {
    return `<li class="talent-meta__item">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</svg>
      <span>${escapeHtml(text)}</span></li>`;
  }
  function stars(rating) {
    const r = Math.round(rating || 0);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${i <= r ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>`;
    }
    return out;
  }

  /* ===== RENDER ===== */
  function render(data) {
    const u = data.user || {};
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const reviews  = Array.isArray(data.reviews)  ? data.reviews  : [];
    const stats    = data.stats || {};

    // Avatar
    if (u.avatarUrl) $('#talent-avatar').innerHTML = `<img src="${escapeHtml(u.avatarUrl)}" alt="${escapeHtml(u.name)}" />`;
    else $('#talent-initials').textContent = initials(u.name);

    // Status / nome / título
    $('#talent-status').hidden = !u.available;
    $('#talent-name').textContent  = u.name || 'Talento';
    $('#talent-title').textContent = u.title || u.headline || 'Desenvolvedor(a)';

    // Meta (só itens com dado)
    const meta = [];
    if (u.location)          meta.push(metaItem(ICON.loc, u.location));
    if (u.salaryExpectation) meta.push(metaItem(ICON.sal, 'Pretensão: ' + u.salaryExpectation));
    if (u.yearsExperience)   meta.push(metaItem(ICON.exp, u.yearsExperience + (u.yearsExperience === 1 ? ' ano de experiência' : ' anos de experiência')));
    if (Array.isArray(u.languages) && u.languages.length) meta.push(metaItem(ICON.lang, u.languages.join(', ')));
    $('#talent-meta').innerHTML = meta.join('');

    // Bio
    const bio = $('#talent-bio');
    if (u.bio) { bio.textContent = u.bio; bio.hidden = false; } else { bio.hidden = true; }

    // Projetos
    if (projects.length) {
      const shown = projects.slice(0, 4);
      $('#talent-projects').innerHTML = shown.map(p => {
        const techs = (p.technologies || []).slice(0, 4).map(t => `<span class="talent-proj__tag">${escapeHtml(t)}</span>`).join('');
        const cover = p.coverUrl
          ? `style="background:url('${escapeHtml(p.coverUrl)}') center/cover no-repeat;"`
          : `style="background:${escapeHtml(p.coverGradient || 'linear-gradient(135deg,#131b2e 0%,#4648d4 100%)')};"`;
        const mono = (p.title || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        return `
          <article class="talent-proj">
            <div class="talent-proj__cover" ${cover}><span>${escapeHtml(mono)}</span></div>
            <div class="talent-proj__body">
              <h3 class="talent-proj__title">${escapeHtml(p.title || 'Projeto')}</h3>
              <p class="talent-proj__desc">${escapeHtml(p.description || '')}</p>
              ${techs ? `<div class="talent-proj__tags">${techs}</div>` : ''}
            </div>
          </article>`;
      }).join('');
      const all = $('#talent-projects-all');
      if (projects.length > shown.length) { all.textContent = `Ver todos os ${projects.length} projetos`; all.hidden = false; }
    } else {
      $('#talent-projects-section').hidden = true;
    }

    // Avaliações
    if (reviews.length) {
      $('#talent-reviews').innerHTML = reviews.map(r => `
        <article class="talent-review">
          <div class="talent-review__top">
            <div class="talent-review__badge">${escapeHtml(initials(r.authorName))}</div>
            <div class="talent-review__id">
              <div class="talent-review__author">${escapeHtml(r.authorName || 'Empresa')}</div>
              <div class="talent-review__role">${escapeHtml(r.authorRole || '')}</div>
            </div>
            <div class="talent-review__stars">${stars(r.rating)}</div>
          </div>
          <p class="talent-review__text">${escapeHtml(r.comment || '')}</p>
        </article>`).join('');
    } else {
      $('#talent-reviews-section').hidden = true;
    }

    // Habilidades
    const skills = Array.isArray(u.skills) ? u.skills : [];
    if (skills.length) {
      $('#talent-skills').innerHTML = skills.map(s => `<span class="talent-skill">${escapeHtml(s)}</span>`).join('');
    } else {
      $('#talent-skills-card').hidden = true;
    }

    // Score Orbit (derivado do rating + projetos)
    const rating = stats.rating || 0;
    const score  = rating > 0 ? (rating / 5 * 10) : Math.min(9.6, 7.5 + projects.length * 0.2);
    const quality = score >= 9.5 ? 'A+' : score >= 9 ? 'A' : score >= 8 ? 'A-' : 'B+';
    $('#talent-score').textContent     = score.toFixed(1);
    $('#talent-quality').textContent   = quality;
    $('#talent-response').textContent  = u.responseTime || '< 24h';
    $('#talent-validated').textContent = projects.length;

    // Download CV
    const cvBtn = $('#btn-cv');
    if (u.resumeUrl) {
      cvBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = u.resumeUrl;
        a.download = u.resumeFileName || `cv-${(u.name || 'talento').toLowerCase().replace(/\s+/g, '-')}`;
        a.target = '_blank';
        document.body.appendChild(a); a.click(); a.remove();
      });
    } else {
      cvBtn.disabled = true;
      cvBtn.title = 'Este talento ainda não enviou um currículo.';
    }

    $('#talent-loading').hidden = true;
    $('#talent-content').hidden = false;
  }

  /* ===== CONTATO ===== */
  async function startConversationAndGo() {
    try {
      const res = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ targetUserId: targetId }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Não foi possível iniciar a conversa.', 'error'); return; }
      window.location.href = `/pages/mensagens.html?c=${encodeURIComponent(data.id)}`;
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível iniciar a conversa.', 'error');
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#btn-contact').addEventListener('click', startConversationAndGo);
    $('#btn-interview').addEventListener('click', () => {
      window.location.href = `/pages/entrevistas.html?dev=${encodeURIComponent(targetId)}`;
    });
    const novo = $('#btn-novo-job'); if (novo) novo.addEventListener('click', () => { window.location.href = '/pages/empresa-nova-vaga.html'; });
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== INIT ===== */
  async function init() {
    renderIdentity();
    setupEvents();
    try {
      const res = await api(`/api/users/${encodeURIComponent(targetId)}/profile`);
      if (!res.ok) {
        $('#talent-loading').textContent = 'Talento não encontrado.';
        return;
      }
      render(await res.json());
    } catch (err) {
      if (err.message !== 'Token expirado') $('#talent-loading').textContent = 'Não foi possível carregar o perfil.';
    }
  }

  init();
})();
