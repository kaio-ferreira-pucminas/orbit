// oportunidades.js — Orbit · Oportunidades Recomendadas (#6 — Eduardo)
// JS puro, sem framework. Backend: JSON Server (GET /api/recommendations/me).

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
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
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

  /* ===== ESTADO ===== */
  let recs = [];           // [{ matchScore, matchedSkills, reason, job }]
  const applied = new Set();

  /* ===== RENDER ===== */
  function buildCard(rec) {
    const job = rec.job || {};
    const matched = (rec.matchedSkills || []).map(s => String(s).toLowerCase());
    const tech = job.skills || job.tech || [];
    const tags = tech.map(t => {
      const isMatch = matched.includes(String(t).toLowerCase());
      return `<span class="opp-tag ${isMatch ? 'opp-tag--match' : ''}">${escapeHtml(t)}</span>`;
    }).join('');
    const isApplied = applied.has(job.id);
    const logo = job.logoInitials || (job.companyName || '?').slice(0, 2).toUpperCase();

    return `
      <article class="opp-card" data-job-id="${escapeHtml(job.id)}">
        <div class="opp-card__top">
          <div class="opp-card__logo">${escapeHtml(logo)}</div>
          <div class="opp-card__id">
            <h2 class="opp-card__title">${escapeHtml(job.title || 'Vaga')}</h2>
            <p class="opp-card__company">${escapeHtml(job.companyName || '')} • ${escapeHtml(job.modality || '')}</p>
          </div>
          <span class="opp-tag opp-tag--match" title="Compatibilidade">${rec.matchScore || 0}% Match</span>
        </div>
        <div class="opp-card__tags">${tags}</div>
        <p class="opp-card__reason"><strong>Por que recomendamos:</strong> ${escapeHtml(rec.reason || 'Alinhada ao seu perfil.')}</p>
        <div class="opp-card__foot">
          <div>
            <span class="opp-card__salary-label">Salário Estimado</span>
            <div class="opp-card__salary">${escapeHtml(job.salaryRange || job.salary || 'A combinar')}</div>
          </div>
          <div class="opp-card__actions">
            <button type="button" class="opp-btn-ghost" data-action="details">Ver Detalhes</button>
            <button type="button" class="opp-btn-primary" data-action="apply" ${isApplied ? 'disabled' : ''}>
              ${isApplied ? 'Candidatura enviada' : 'Candidatar-se'}
            </button>
          </div>
        </div>
      </article>`;
  }

  function getFilters() {
    return {
      q: ($('#filter-search').value || '').toLowerCase().trim(),
      tech: $('#filter-tech').value || '',
      level: $('#filter-level').value || '',
      modality: $('#filter-modality').value || '',
    };
  }

  function applyFilters(list) {
    const f = getFilters();
    return list.filter(rec => {
      const job = rec.job || {};
      const tech = job.skills || job.tech || [];
      if (f.modality && job.modality !== f.modality) return false;
      if (f.level && job.level !== f.level) return false;
      if (f.tech && !tech.some(t => t === f.tech)) return false;
      if (f.q) {
        const hay = [job.title, job.companyName, tech.join(' ')].join(' ').toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }

  function render() {
    const grid = $('#opp-grid');
    const filtered = applyFilters(recs);
    $('#results-count').textContent = filtered.length === 1
      ? '1 oportunidade recomendada'
      : `${filtered.length} oportunidades recomendadas`;

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="opp-empty">
          <svg class="opp-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p class="opp-empty__title">Nenhuma oportunidade encontrada</p>
          <p class="opp-empty__text">Ajuste os filtros ou complete seu perfil para receber mais recomendações.</p>
        </div>`;
      return;
    }
    grid.innerHTML = filtered.map(buildCard).join('');
  }

  function populateTech() {
    const sel = $('#filter-tech');
    // zera mantendo o placeholder (1ª option) — evita duplicar ao recarregar
    sel.length = 1;
    const set = new Set();
    recs.forEach(r => ((r.job && (r.job.skills || r.job.tech)) || []).forEach(t => set.add(t)));
    [...set].sort().forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
  }

  // Re-busca as recomendações no servidor (já refletindo as preferências salvas)
  // e re-renderiza. Usada no init e após salvar os Filtros Avançados.
  async function reloadRecs() {
    const res = await api('/api/recommendations/me');
    recs = await res.json();
    populateTech();
    render();
  }

  /* ===== CANDIDATURA RÁPIDA ===== */
  async function apply(jobId, btn) {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Enviando...';
    try {
      const res = await api('/api/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
      const data = await res.json();
      if (!res.ok && res.status !== 409) {
        btn.disabled = false; btn.textContent = original;
        toast(data.error || 'Não foi possível candidatar-se.', 'error'); return;
      }
      applied.add(jobId);
      btn.textContent = 'Candidatura enviada';
      toast(res.status === 409 ? 'Você já se candidatou a esta vaga.' : 'Candidatura enviada!', res.status === 409 ? 'info' : 'success');
    } catch (err) {
      if (err.message !== 'Token expirado') { btn.disabled = false; btn.textContent = original; toast('Erro ao candidatar-se.', 'error'); }
    }
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    ['#filter-search', '#filter-tech', '#filter-level', '#filter-modality'].forEach(sel => {
      const el = $(sel);
      el.addEventListener(sel === '#filter-search' ? 'input' : 'change', render);
    });
    $('#opp-grid').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('[data-job-id]');
      const jobId = card && card.getAttribute('data-job-id');
      if (btn.getAttribute('data-action') === 'apply') apply(jobId, btn);
      else if (btn.getAttribute('data-action') === 'details') window.location.href = `/pages/vaga-detalhes.html?id=${encodeURIComponent(jobId)}`;
    });
    // Filtros Avançados: abre o modal e, ao salvar, re-busca as recomendações
    const advBtn = $('#opp-adv-toggle');
    if (advBtn) advBtn.addEventListener('click', () => {
      if (window.OrbitJobPrefs) window.OrbitJobPrefs.open(reloadRecs);
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
      // marca quais já tenho candidatura (via applications/me, se existir)
      try {
        const ap = await api('/api/applications/me');
        if (ap.ok) (await ap.json()).forEach(a => applied.add(a.jobId));
      } catch { /* opcional */ }
      await reloadRecs(); // busca recomendações + popula tech + render
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#opp-grid').innerHTML = `<div class="opp-loading">Não foi possível carregar as recomendações.</div>`;
      }
    }
  }

  init();

})();
