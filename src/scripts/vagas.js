// vagas.js — Orbit · Listagem de Vagas com filtros (#2 — Daniel)
// JS puro, sem framework. Backend: JSON Server.

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

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return [...(root || document).querySelectorAll(s)]; }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  // converte "R$ 12.000 - 16.000" → número aproximado para ordenar
  function salaryValue(range) {
    const nums = String(range || '').replace(/\./g, '').match(/\d+/g);
    return nums ? Math.max(...nums.map(Number)) : 0;
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

  /* ===== ESTADO ===== */
  let allJobs = [];
  const savedIds = new Set();

  /* ===== FILTROS ===== */
  function checkedValues(name) {
    return $$(`input[name="${name}"]:checked`).map(c => c.value);
  }

  function getFilters() {
    return {
      q:        ($('#filter-search').value || '').toLowerCase().trim(),
      modSel:   $('#filter-modality').value || '',
      tech:     $('#filter-tech').value || '',
      level:    $('#filter-level').value || '',
      modChecks: checkedValues('modality'),
      lvlChecks: checkedValues('level'),
      sort:     $('#filter-sort').value || 'recent',
    };
  }

  function applyFilters(jobs) {
    const f = getFilters();
    let list = jobs.filter(j => {
      const tech = j.skills || j.tech || [];
      // modalidade: select rápido + checkboxes (união)
      const mods = new Set([...(f.modSel ? [f.modSel] : []), ...f.modChecks]);
      if (mods.size && !mods.has(j.modality)) return false;
      // nível: select rápido + checkboxes
      const lvls = new Set([...(f.level ? [f.level] : []), ...f.lvlChecks]);
      if (lvls.size && !lvls.has(j.level)) return false;
      // tech
      if (f.tech && !tech.some(t => t === f.tech)) return false;
      // busca textual
      if (f.q) {
        const hay = [j.title, j.companyName, tech.join(' ')].join(' ').toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });

    if (f.sort === 'salary') {
      list = list.sort((a, b) => salaryValue(b.salaryRange || b.salary) - salaryValue(a.salaryRange || a.salary));
    } else {
      list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }

  /* ===== RENDER ===== */
  function badgesFor(job, idx) {
    // Heurística simples para badges de exemplo (sem campo dedicado no schema)
    const b = [];
    const ageDays = (Date.now() - new Date(job.createdAt).getTime()) / 86400000;
    if (ageDays <= 3) b.push('<span class="vaga-badge vaga-badge--novo">Novo</span>');
    if (idx === 0) b.push('<span class="vaga-badge vaga-badge--destaque">Destaque</span>');
    return b.join('');
  }

  function buildCard(job, idx) {
    const tech = job.skills || job.tech || [];
    const tags = tech.map(t => `<span class="vaga-tag">${escapeHtml(t)}</span>`).join('');
    const saved = savedIds.has(job.id) || job.savedByMe;

    return `
      <article class="vaga-card" data-job-id="${escapeHtml(job.id)}">
        <div class="vaga-card__main">
          <div class="vaga-card__top">
            <h3 class="vaga-card__title">${escapeHtml(job.title)}</h3>
            ${badgesFor(job, idx)}
          </div>
          <p class="vaga-card__company">${escapeHtml(job.companyName || '')}</p>
          <div class="vaga-card__tags">${tags}</div>
          <div class="vaga-card__meta">
            <span class="vaga-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>${escapeHtml(job.location || job.modality)}
            </span>
            <span class="vaga-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>${escapeHtml(job.modality)} · ${escapeHtml(job.level)}
            </span>
            <span class="vaga-meta-item vaga-meta-item--salary">${escapeHtml(job.salaryRange || job.salary || '')}</span>
          </div>
        </div>
        <div class="vaga-card__actions">
          <button type="button" class="vaga-btn-primary" data-action="details">Ver Detalhes</button>
          <button type="button" class="vaga-save-btn ${saved ? 'is-saved' : ''}" data-action="save">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            ${saved ? 'Salva' : 'Salvar'}
          </button>
        </div>
      </article>`;
  }

  function render() {
    const list = $('#vagas-list');
    const filtered = applyFilters(allJobs);
    $('#results-count').textContent = filtered.length === 1
      ? 'Mostrando 1 oportunidade encontrada'
      : `Mostrando ${filtered.length} oportunidades encontradas`;

    if (!filtered.length) {
      list.innerHTML = `
        <div class="vagas-empty">
          <svg class="vagas-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p class="vagas-empty__title">Nenhuma vaga encontrada</p>
          <p class="vagas-empty__text">Ajuste os filtros ou limpe a busca para ver mais oportunidades.</p>
        </div>`;
      return;
    }
    list.innerHTML = filtered.map((j, i) => buildCard(j, i)).join('');
  }

  function renderSaved() {
    const box = $('#saved-list');
    const saved = allJobs.filter(j => savedIds.has(j.id));
    if (!saved.length) {
      box.innerHTML = `<p class="vagas-saved__empty">Nenhuma vaga salva ainda.</p>`;
      return;
    }
    box.innerHTML = saved.slice(0, 5).map(j => `
      <div class="vagas-saved__item" data-job-id="${escapeHtml(j.id)}">
        <span class="vagas-saved__item-title">${escapeHtml(j.title)}</span>
        <span class="vagas-saved__item-meta">${escapeHtml(j.companyName || '')} · ${escapeHtml(j.modality)}</span>
      </div>`).join('');
  }

  /* ===== SALVAR VAGA ===== */
  async function toggleSave(jobId) {
    try {
      const res = await api('/api/saved-jobs', { method: 'POST', body: JSON.stringify({ jobId }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Erro ao salvar.', 'error'); return; }
      if (data.saved) savedIds.add(jobId); else savedIds.delete(jobId);
      render();
      renderSaved();
      toast(data.saved ? 'Vaga salva!' : 'Vaga removida dos salvos.', 'success');
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Não foi possível salvar a vaga.', 'error');
    }
  }

  /* ===== POPULA FILTRO DE TECH ===== */
  function populateTech() {
    const set = new Set();
    allJobs.forEach(j => (j.skills || j.tech || []).forEach(t => set.add(t)));
    const sel = $('#filter-tech');
    [...set].sort().forEach(t => {
      const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    ['#filter-search', '#filter-modality', '#filter-tech', '#filter-level', '#filter-sort'].forEach(sel => {
      const el = $(sel);
      el.addEventListener(sel === '#filter-search' ? 'input' : 'change', render);
    });
    $$('.vagas-check input').forEach(c => c.addEventListener('change', render));

    $('#btn-clear-filters').addEventListener('click', () => {
      $('#filter-search').value = '';
      $('#filter-modality').value = '';
      $('#filter-tech').value = '';
      $('#filter-level').value = '';
      $('#filter-sort').value = 'recent';
      $$('.vagas-check input').forEach(c => { c.checked = false; });
      render();
    });

    $('#vagas-list').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('[data-job-id]');
      const jobId = card && card.getAttribute('data-job-id');
      const action = btn.getAttribute('data-action');
      if (action === 'save') toggleSave(jobId);
      else if (action === 'details') window.location.href = `/pages/vaga-detalhes.html?id=${encodeURIComponent(jobId)}`;
    });

    $('#saved-list').addEventListener('click', (ev) => {
      const item = ev.target.closest('[data-job-id]');
      if (item) window.location.href = `/pages/vaga-detalhes.html?id=${encodeURIComponent(item.getAttribute('data-job-id'))}`;
    });

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
      const [jobsRes, savedRes] = await Promise.all([
        api('/api/jobs'),
        api('/api/saved-jobs/me').catch(() => null),
      ]);
      allJobs = await jobsRes.json();
      if (savedRes && savedRes.ok) {
        const saved = await savedRes.json();
        saved.forEach(s => savedIds.add(s.jobId));
      }
      // marca savedByMe vindos do /api/jobs
      allJobs.forEach(j => { if (j.savedByMe) savedIds.add(j.id); });
      populateTech();
      render();
      renderSaved();
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#vagas-list').innerHTML = `<div class="vagas-loading">Não foi possível carregar as vagas.</div>`;
      }
    }
  }

  init();

})();
