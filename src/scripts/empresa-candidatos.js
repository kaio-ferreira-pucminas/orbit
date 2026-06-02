// empresa-candidatos.js — Orbit · Candidatos por Vaga (#12 — Eduardo)
// JS puro, sem framework. Backend: JSON Server (GET /api/jobs/:id/applications).

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
  const params = new URLSearchParams(window.location.search);
  let jobId = params.get('id');

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

  const STATUS_LABEL = { enviada: 'Enviada', em_analise: 'Em Análise', entrevista: 'Entrevista', recusado: 'Recusado' };

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
  let applicants = [];

  /* ===== IDENTIDADE ===== */
  function renderIdentity() {
    $('#sidebar-company-name').textContent = currentUser.name || 'Empresa';
  }

  /* ===== RENDER ===== */
  function buildCard(a) {
    const c = a.candidate || {};
    const skills = c.skills || [];
    const shown = skills.slice(0, 4).map(s => `<span class="cand-tag">${escapeHtml(s)}</span>`).join('');
    const extra = skills.length > 4 ? `<span class="cand-tag cand-tag--more">+${skills.length - 4} skills</span>` : '';
    const avatar = c.avatarUrl ? `<img src="${escapeHtml(c.avatarUrl)}" alt="${escapeHtml(c.name)}" />` : `<span>${initials(c.name)}</span>`;
    const st = a.status || 'enviada';

    return `
      <article class="cand-card" data-user-id="${escapeHtml(c.id || '')}">
        <div class="cand-card__avatar">${avatar}</div>
        <div class="cand-card__body">
          <div class="cand-card__top">
            <span class="cand-card__name">${escapeHtml(c.name || 'Candidato')}</span>
            <span class="cand-card__role">${escapeHtml(c.title || c.headline || 'Desenvolvedor(a)')}</span>
          </div>
          <p class="cand-card__desc">${escapeHtml(c.bio || a.coverMessage || 'Candidatura enviada para a vaga.')}</p>
          <div class="cand-card__skills">${shown}${extra}</div>
        </div>
        <div class="cand-card__actions">
          <span class="cand-status cand-status--${st}">${escapeHtml(STATUS_LABEL[st] || st)}</span>
          <a class="cand-btn-primary" href="/pages/empresa-talento.html?id=${encodeURIComponent(c.id || '')}">Ver Perfil Completo</a>
          <a class="cand-btn-ghost" href="/pages/mensagens.html">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Enviar Mensagem
          </a>
        </div>
      </article>`;
  }

  function applyFilter(list) {
    const f = $('#filter-status').value;
    return f ? list.filter(a => a.status === f) : list;
  }

  function renderList() {
    const box = $('#cand-list');
    const filtered = applyFilter(applicants);
    if (!filtered.length) {
      box.innerHTML = `
        <div class="cand-empty">
          <svg class="cand-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p class="cand-empty__title">Nenhum candidato neste filtro</p>
          <p class="cand-empty__text">Ajuste o filtro de status para ver outros candidatos.</p>
        </div>`;
      return;
    }
    box.innerHTML = filtered.map(buildCard).join('');
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#filter-status').addEventListener('change', renderList);
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* ===== CARGA ===== */
  async function resolveJobId() {
    if (jobId) return jobId;
    // sem id: escolhe a vaga com mais candidatos
    try {
      const res = await api('/api/jobs');
      const jobs = await res.json();
      let best = null, bestCount = -1;
      for (const j of jobs) {
        const r = await api(`/api/jobs/${j.id}/applications`).then(x => x.json()).catch(() => null);
        if (r && r.funnel.total > bestCount) { bestCount = r.funnel.total; best = j.id; }
      }
      return best || (jobs[0] && jobs[0].id);
    } catch { return null; }
  }

  async function load() {
    jobId = await resolveJobId();
    if (!jobId) { $('#cand-loading').textContent = 'Nenhuma vaga encontrada.'; return; }
    try {
      const res = await api(`/api/jobs/${jobId}/applications`);
      if (!res.ok) { $('#cand-loading').textContent = 'Vaga não encontrada.'; return; }
      const data = await res.json();
      applicants = data.applicants || [];

      $('#cand-job-title').textContent = data.job.title;
      $('#cand-job-location').textContent = data.job.location || data.job.modality || '';
      $('#cand-job-count').textContent = `${data.funnel.total} Candidato${data.funnel.total !== 1 ? 's' : ''} Aplicado${data.funnel.total !== 1 ? 's' : ''}`;
      $('#funnel-total').textContent = data.funnel.total;
      $('#funnel-analise').textContent = data.funnel.em_analise;
      $('#funnel-entrevista').textContent = data.funnel.entrevista;
      $('#funnel-recusado').textContent = data.funnel.recusado;

      renderList();
      $('#cand-loading').hidden = true;
      $('#cand-content').hidden = false;
    } catch (err) {
      if (err.message !== 'Token expirado') $('#cand-loading').textContent = 'Não foi possível carregar os candidatos.';
    }
  }

  function init() { renderIdentity(); setupEvents(); load(); }
  init();

})();
