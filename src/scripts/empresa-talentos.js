// empresa-talentos.js — Orbit · Busca de Talentos (#8 — Daniel)
// JS puro, sem framework. Backend: JSON Server (GET /api/talents).

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';
  const PAGE_SIZE = 6;

  /* ===== AUTH GUARD ===== */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');
  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }
  const currentUser = JSON.parse(userJson);

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return [...(root || document).querySelectorAll(s)]; }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  async function api(path) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }
    return res;
  }

  /* ===== ESTADO ===== */
  let allTalents = [];
  const activeSkills = new Set();
  let currentPage = 1;

  /* ===== IDENTIDADE ===== */
  function renderIdentity() {
    const name = currentUser.name || 'Empresa';
    $('#sidebar-company-name').textContent = name;
    $('#emp-initials').textContent = initials(name);
    if (currentUser.avatarUrl) $('#emp-avatar').innerHTML = `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="${escapeHtml(name)}" />`;
  }

  /* ===== FILTROS ===== */
  function checkedValues(name) { return $$(`input[name="${name}"]:checked`).map(c => c.value); }

  function getFilters() {
    return {
      q: ($('#talent-search').value || '').toLowerCase().trim(),
      skills: [...activeSkills],
      levels: checkedValues('level'),
      available: (($$('input[name="availability"]:checked')[0] || {}).value) || '',
      sort: $('#talent-sort').value || 'relevance',
    };
  }

  function applyFilters(list) {
    const f = getFilters();
    let out = list.filter(u => {
      const skills = (u.skills || []).map(s => s.toLowerCase());
      if (f.skills.length && !f.skills.every(s => skills.includes(s.toLowerCase()))) return false;
      if (f.levels.length) {
        const lv = String(u.level || u.seniority || '').toLowerCase();
        if (!f.levels.map(x => x.toLowerCase()).includes(lv)) return false;
      }
      if (f.available === 'true' && u.available !== true) return false;
      if (f.q) {
        const hay = [u.name, u.title, u.headline, (u.skills || []).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
    if (f.sort === 'rating') out = out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return out;
  }

  /* ===== RENDER ===== */
  function buildCard(u) {
    const skills = u.skills || [];
    const shown = skills.slice(0, 3).map(s => `<span class="emp-tag">${escapeHtml(s)}</span>`).join('');
    const extra = skills.length > 3 ? `<span class="emp-tag emp-tag--more">+${skills.length - 3}</span>` : '';
    const avatar = u.avatarUrl
      ? `<img src="${escapeHtml(u.avatarUrl)}" alt="${escapeHtml(u.name)}" />`
      : `<span>${initials(u.name)}</span>`;
    const rating = u.rating ? u.rating.toFixed(1) : '—';
    const loc = u.available
      ? `<span class="emp-talent-card__loc"><span class="emp-talent-card__loc-dot"></span>Disponível</span>`
      : `<span class="emp-talent-card__loc">${escapeHtml(u.title || 'Desenvolvedor(a)')}</span>`;

    return `
      <article class="emp-talent-card" data-user-id="${escapeHtml(u.id)}">
        <div class="emp-talent-card__top">
          <div class="emp-talent-card__avatar">${avatar}</div>
          <div class="emp-talent-card__id">
            <div class="emp-talent-card__name">${escapeHtml(u.name)}</div>
            <div class="emp-talent-card__title">${escapeHtml(u.title || u.headline || 'Desenvolvedor(a)')}</div>
          </div>
          <div class="emp-talent-card__rating">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>
            ${rating}
          </div>
        </div>
        <p class="emp-talent-card__bio">${escapeHtml(u.bio || u.headline || 'Profissional de tecnologia na plataforma Orbit.')}</p>
        <div class="emp-talent-card__skills">${shown}${extra}</div>
        <div class="emp-talent-card__foot">
          ${loc}
          <button type="button" class="emp-btn-ghost" data-action="profile">Ver Perfil</button>
        </div>
      </article>`;
  }

  function render() {
    const grid = $('#talent-grid');
    const pagBox = $('#talent-pagination');
    const filtered = applyFilters(allTalents);
    $('#talent-count').textContent = `(${filtered.length})`;

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="emp-empty">
          <svg class="emp-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p class="emp-empty__title">Nenhum talento encontrado</p>
          <p class="emp-empty__text">Ajuste os filtros de habilidades, nível ou disponibilidade.</p>
        </div>`;
      pagBox.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    grid.innerHTML = pageItems.map(buildCard).join('');

    // paginação (container dedicado)
    if (totalPages > 1) {
      let html = '<div class="emp-pagination">';
      html += `<button class="emp-page-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>`;
      for (let p = 1; p <= totalPages; p++) {
        html += `<button class="emp-page-btn ${p === currentPage ? 'emp-page-btn--active' : ''}" data-page="${p}">${p}</button>`;
      }
      html += `<button class="emp-page-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>`;
      html += '</div>';
      pagBox.innerHTML = html;
    } else {
      pagBox.innerHTML = '';
    }
  }

  function renderSkillChips() {
    // Conta frequência de cada skill para mostrar as mais relevantes primeiro
    const freq = new Map();
    allTalents.forEach(u => (u.skills || []).forEach(s => freq.set(s, (freq.get(s) || 0) + 1)));
    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(e => e[0]);
    const box = $('#skill-chips');
    box.innerHTML = top.map(s =>
      `<button type="button" class="emp-skill-chip ${activeSkills.has(s) ? 'emp-skill-chip--active' : ''}" data-skill="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join('');
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#talent-search').addEventListener('input', () => { currentPage = 1; render(); });
    $('#talent-sort').addEventListener('change', () => { currentPage = 1; render(); });
    $$('input[name="level"]').forEach(c => c.addEventListener('change', () => { currentPage = 1; render(); }));
    $$('input[name="availability"]').forEach(c => c.addEventListener('change', () => { currentPage = 1; render(); }));

    $('#skill-chips').addEventListener('click', (ev) => {
      const chip = ev.target.closest('[data-skill]');
      if (!chip) return;
      const s = chip.getAttribute('data-skill');
      if (activeSkills.has(s)) activeSkills.delete(s); else activeSkills.add(s);
      chip.classList.toggle('emp-skill-chip--active');
      currentPage = 1; render();
    });

    $('#btn-clear-filters').addEventListener('click', () => {
      $('#talent-search').value = '';
      activeSkills.clear();
      $$('input[name="level"]').forEach(c => { c.checked = false; });
      const allRadio = $$('input[name="availability"]')[0]; if (allRadio) allRadio.checked = true;
      renderSkillChips();
      currentPage = 1; render();
    });

    // delegação para paginação e ações dos cards (no container pai)
    document.addEventListener('click', (ev) => {
      const pg = ev.target.closest('.emp-page-btn[data-page]');
      if (pg && !pg.disabled) {
        const v = pg.getAttribute('data-page');
        const filtered = applyFilters(allTalents);
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (v === 'prev') currentPage = Math.max(1, currentPage - 1);
        else if (v === 'next') currentPage = Math.min(totalPages, currentPage + 1);
        else currentPage = Number(v);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const profileBtn = ev.target.closest('.emp-talent-card [data-action="profile"]');
      if (profileBtn) {
        const card = profileBtn.closest('[data-user-id]');
        const id = card && card.getAttribute('data-user-id');
        if (id) window.location.href = `/pages/empresa-talento.html?id=${encodeURIComponent(id)}`;
      }
    });

    $('#btn-novo-job').addEventListener('click', () => { window.location.href = '/pages/empresa-nova-vaga.html'; });
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
      const res = await api('/api/talents');
      allTalents = await res.json();
      renderSkillChips();
      render();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#talent-grid').innerHTML = `<div class="emp-loading">Não foi possível carregar os talentos.</div>`;
      }
    }
  }

  init();

})();
