// empresa-vagas.js — Orbit · Gerenciar Vagas da Empresa
// JS puro. Backend: GET /api/jobs/mine + PATCH/DELETE /api/jobs/:id.

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
  if (currentUser.type !== 'company') {
    window.location.href = '/pages/dashboard.html';
    return;
  }

  /* ===== HELPERS ===== */
  function $(s, root) { return (root || document).querySelector(s); }
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => map[ch]);
  }
  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }
  function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR'); }

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

  /* ===== CONSTANTES ===== */
  const STATUS_META = {
    active: { label: 'Publicada', cls: 'active' },
    draft:  { label: 'Rascunho',  cls: 'draft'  },
    paused: { label: 'Pausada',   cls: 'paused' },
    closed: { label: 'Encerrada', cls: 'closed' },
  };
  // Ícones Feather inline (stroke currentColor)
  const ICON_USERS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const ICON_VIDEO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';

  /* ===== ESTADO ===== */
  let jobs = [];
  let company = null;
  let loaded = false; // true após o GET /api/jobs/mine concluir

  /* ===== IDENTIDADE (sidebar) ===== */
  function renderIdentity() {
    $('#sidebar-company-name').textContent = currentUser.name || 'Empresa';
  }

  /* ===== RENDER · CARD DE VAGA ===== */
  function metaLine(job) {
    const parts = [job.modality, job.level, job.contractType, job.salaryRange]
      .filter(Boolean)
      .map(p => escapeHtml(p));
    if (job.createdAt) parts.push(`criada em ${escapeHtml(fmtDate(job.createdAt))}`);
    return parts.join('<span class="ev-card__meta-sep">·</span>');
  }

  function statsLine(job) {
    const n = job.applicantsCount || 0;
    const pending = job.pendingCount || 0;
    const interviews = job.activeInterviews || 0;
    const pendingHtml = pending > 0
      ? ` <span class="ev-stat__pending">· ${pending} aguardando análise</span>`
      : '';
    let html = `<span class="ev-stat">${ICON_USERS} ${n} candidato${n !== 1 ? 's' : ''}${pendingHtml}</span>`;
    if (interviews > 0) {
      html += `<span class="ev-stat">${ICON_VIDEO} ${interviews} entrevista${interviews !== 1 ? 's' : ''} ativa${interviews !== 1 ? 's' : ''}</span>`;
    }
    return html;
  }

  function actionsHtml(job) {
    const id = encodeURIComponent(job.id);
    const btns = [];
    btns.push(`<a class="ev-btn-primary" href="/pages/empresa-candidatos.html?id=${id}">Ver candidatos</a>`);
    btns.push(`<a class="ev-btn-ghost" href="/pages/empresa-nova-vaga.html?id=${id}">Editar</a>`);
    if (job.status === 'draft' || job.status === 'paused') {
      btns.push('<button type="button" class="ev-btn-ghost" data-action="publish">Publicar</button>');
    }
    if (job.status === 'closed') {
      btns.push('<button type="button" class="ev-btn-ghost" data-action="publish">Reabrir</button>');
    }
    if (job.status === 'active') {
      btns.push('<button type="button" class="ev-btn-ghost" data-action="pause">Pausar</button>');
    }
    if (job.status === 'active' || job.status === 'paused') {
      btns.push('<button type="button" class="ev-btn-danger" data-action="close">Encerrar</button>');
    }
    if ((job.applicantsCount || 0) === 0) {
      btns.push('<button type="button" class="ev-btn-danger" data-action="delete">Excluir</button>');
    }
    if (job.status === 'active') {
      btns.push(`<a class="ev-link-dev" href="/pages/vaga-detalhes.html?id=${id}">Ver como dev</a>`);
    }
    return btns.join('');
  }

  function buildCard(job) {
    const meta = STATUS_META[job.status] || STATUS_META.draft;
    const skills = job.skills || [];
    const shown = skills.slice(0, 5).map(s => `<span class="ev-tag">${escapeHtml(s)}</span>`).join('');
    const extra = skills.length > 5 ? `<span class="ev-tag ev-tag--more">+${skills.length - 5}</span>` : '';

    return `
      <article class="ev-card ${job.status === 'closed' ? 'ev-card--closed' : ''}" data-job-id="${escapeHtml(job.id)}">
        <div class="ev-card__body">
          <h2 class="ev-card__title">${escapeHtml(job.title || 'Vaga sem título')}</h2>
          <p class="ev-card__meta">${metaLine(job)}</p>
          ${skills.length ? `<div class="ev-card__skills">${shown}${extra}</div>` : ''}
          <div class="ev-card__stats">${statsLine(job)}</div>
        </div>
        <div class="ev-card__actions">
          <span class="ev-status ev-status--${meta.cls}">${meta.label}</span>
          ${actionsHtml(job)}
        </div>
      </article>`;
  }

  /* ===== RENDER · EMPTY STATES ===== */
  function emptyNoCompany() {
    return `
      <div class="ev-empty">
        <svg class="ev-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
        <p class="ev-empty__title">Complete o perfil da sua empresa para publicar vagas.</p>
        <p class="ev-empty__text">Precisamos de algumas informações básicas antes de divulgar suas oportunidades para a comunidade.</p>
        <a class="ev-btn-primary" href="/pages/completar-perfil-empresa.html">Completar perfil da empresa</a>
      </div>`;
  }

  function emptyNoJobs() {
    return `
      <div class="ev-empty">
        <svg class="ev-empty__icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="2" y1="13" x2="22" y2="13"/></svg>
        <p class="ev-empty__title">Você ainda não publicou nenhuma vaga.</p>
        <p class="ev-empty__text">Crie sua primeira vaga e comece a receber candidaturas de desenvolvedores da órbita.</p>
        <a class="ev-btn-primary" href="/pages/empresa-nova-vaga.html">+ Criar minha primeira vaga</a>
      </div>`;
  }

  function emptyFilter() {
    return `
      <div class="ev-empty">
        <svg class="ev-empty__icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <p class="ev-empty__title">Nenhuma vaga neste filtro</p>
        <p class="ev-empty__text">Ajuste o filtro de status para ver suas outras vagas.</p>
      </div>`;
  }

  /* ===== RENDER · RESUMO (sempre global, ignora o filtro) ===== */
  function renderSummary() {
    const count = st => jobs.filter(j => j.status === st).length;
    const sum = key => jobs.reduce((acc, j) => acc + (j[key] || 0), 0);
    $('#sum-active').textContent     = count('active');
    $('#sum-draft').textContent      = count('draft');
    $('#sum-pending').textContent    = sum('pendingCount');
    $('#sum-interviews').textContent = sum('activeInterviews');
  }

  /* ===== RENDER · LISTA (com filtro client-side) ===== */
  function renderList() {
    const box = $('#ev-list');
    if (!company) { box.innerHTML = emptyNoCompany(); return; }
    if (!jobs.length) { box.innerHTML = emptyNoJobs(); return; }
    const f = $('#filter-status').value;
    const filtered = f ? jobs.filter(j => j.status === f) : jobs;
    box.innerHTML = filtered.length ? filtered.map(buildCard).join('') : emptyFilter();
  }

  /* ===== MUTAÇÕES (PATCH / DELETE) ===== */
  async function mutateJob(btn, jobId, options, okMsg) {
    btn.disabled = true;
    try {
      const res = await api(`/api/jobs/${encodeURIComponent(jobId)}`, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || 'Não foi possível concluir a ação.', 'error');
        btn.disabled = false;
        return;
      }
      toast(okMsg, 'success');
      await load(); // recarrega lista + resumo (re-fetch /api/jobs/mine)
    } catch (err) {
      if (err.message !== 'Token expirado') toast('Erro de conexão.', 'error');
      btn.disabled = false;
    }
  }

  function patchStatus(btn, jobId, status, okMsg) {
    return mutateJob(btn, jobId, { method: 'PATCH', body: JSON.stringify({ status }) }, okMsg);
  }

  /* ===== EVENTOS ===== */
  function setupEvents() {
    $('#filter-status').addEventListener('change', renderList);
    $('#btn-new-job').addEventListener('click', () => {
      // Sem perfil de empresa o backend recusaria o cadastro — orienta antes
      // de o usuário preencher um formulário inteiro à toa
      if (loaded && company === null) {
        toast('Complete o perfil da sua empresa antes de publicar vagas.', 'info');
        window.location.href = '/pages/completar-perfil-empresa.html';
        return;
      }
      window.location.href = '/pages/empresa-nova-vaga.html';
    });
    $('#btn-logout').addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });

    // Delegação: ações dos cards (publicar / pausar / encerrar / excluir)
    $('#ev-list').addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const card = btn.closest('[data-job-id]');
      if (!card) return;
      const jobId = card.getAttribute('data-job-id');
      const action = btn.getAttribute('data-action');

      if (action === 'publish') {
        await patchStatus(btn, jobId, 'active', 'Vaga publicada!');
      } else if (action === 'pause') {
        await patchStatus(btn, jobId, 'paused', 'Vaga pausada.');
      } else if (action === 'close') {
        if (!window.confirm('Encerrar esta vaga? Ela deixará de receber novas candidaturas.')) return;
        await patchStatus(btn, jobId, 'closed', 'Vaga encerrada.');
      } else if (action === 'delete') {
        if (!window.confirm('Excluir esta vaga permanentemente? Esta ação não pode ser desfeita.')) return;
        await mutateJob(btn, jobId, { method: 'DELETE' }, 'Vaga excluída.');
      }
    });
  }

  /* ===== CARGA ===== */
  async function load() {
    try {
      const res = await api('/api/jobs/mine');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        $('#ev-loading').hidden = true;
        $('#ev-list').hidden = false;
        $('#ev-list').innerHTML = `
          <div class="ev-empty">
            <p class="ev-empty__title">Não foi possível carregar suas vagas.</p>
            <p class="ev-empty__text">${escapeHtml(data.error || 'Tente novamente em instantes.')}</p>
          </div>`;
        toast(data.error || 'Não foi possível carregar suas vagas.', 'error');
        return;
      }
      company = data.company || null;
      jobs = data.jobs || [];
      loaded = true;

      $('#ev-summary').hidden = !company;
      renderSummary();
      renderList();
      $('#ev-loading').hidden = true;
      $('#ev-list').hidden = false;
    } catch (err) {
      if (err.message !== 'Token expirado') {
        $('#ev-loading').hidden = true;
        $('#ev-list').hidden = false;
        $('#ev-list').innerHTML = `
          <div class="ev-empty">
            <p class="ev-empty__title">Não foi possível carregar suas vagas.</p>
            <p class="ev-empty__text">Verifique sua conexão e tente novamente.</p>
          </div>`;
      }
    }
  }

  function init() { renderIdentity(); setupEvents(); load(); }
  init();

})();
