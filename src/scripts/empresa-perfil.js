// empresa-perfil.js — Orbit · Perfil público de empresa + vagas. JS puro.

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* ===== AUTH GUARD ===== */
  const token = localStorage.getItem('orbit_token');
  if (!token) { window.location.href = '/pages/auth.html?tab=login'; return; }

  /* ===== HELPERS ===== */
  function $(s) { return document.querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  async function api(path) {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/pages/auth.html?tab=login'; throw new Error('401'); }
    return res;
  }

  const companyId = new URLSearchParams(window.location.search).get('id');

  function chips(arr) {
    return (arr || []).slice(0, 6).map(s => `<span class="emp-chip">${escapeHtml(s)}</span>`).join('');
  }

  function renderJob(j) {
    const meta = [j.level, j.modality, j.location].filter(Boolean).join(' · ');
    const active = j.status === 'active';
    return `<div class="emp-job">
      <div>
        <div class="emp-job__title">${escapeHtml(j.title)}
          <span class="emp-job__status emp-job__status--${active ? 'active' : 'closed'}">${active ? 'Aberta' : 'Encerrada'}</span>
        </div>
        <div class="emp-job__meta">${escapeHtml(meta)}${j.salaryRange ? ' · ' + escapeHtml(j.salaryRange) : ''}</div>
        <div class="emp-job__chips">${chips(j.skills)}</div>
      </div>
      <a class="emp-job__cta" href="/pages/vaga-detalhes.html?id=${encodeURIComponent(j.id)}">Ver vaga</a>
    </div>`;
  }

  function render(company, jobs) {
    $('#emp-logo').textContent = company.logoInitials || initials(company.name);
    $('#emp-name').textContent = company.name || 'Empresa';
    $('#emp-industry').textContent = company.industry || 'Empresa';
    $('#emp-location').textContent = company.location || '';

    if (company.website) {
      const site = $('#emp-site');
      site.href = /^https?:\/\//.test(company.website) ? company.website : 'https://' + company.website;
      site.hidden = false;
    }

    if (company.about) {
      $('#emp-about').textContent = company.about;
    } else {
      $('#emp-about-section').hidden = true;
    }

    $('#emp-jobs-count').textContent = jobs.length;
    $('#emp-jobs').innerHTML = jobs.length
      ? jobs.map(renderJob).join('')
      : '<p class="emp-jobs__empty">Nenhuma vaga publicada no momento.</p>';

    $('#emp-loading').hidden = true;
    $('#emp-content').hidden = false;
  }

  /* ===== INIT ===== */
  (async function init() {
    if (!companyId) { $('#emp-loading').textContent = 'Empresa não informada.'; return; }
    try {
      const res = await api('/api/companies/' + encodeURIComponent(companyId));
      if (!res.ok) { $('#emp-loading').textContent = 'Empresa não encontrada.'; return; }
      const data = await res.json();
      render(data.company, data.jobs || []);
    } catch (e) {
      if (e.message !== '401') $('#emp-loading').textContent = 'Não foi possível carregar a empresa.';
    }
  })();

})();
