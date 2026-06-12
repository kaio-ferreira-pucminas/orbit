// dashboard.js — Orbit Developer Dashboard
// JS puro, sem framework

(function () {
  'use strict';

  const API_URL = window.ORBIT_API_URL || 'http://localhost:3001';

  /* =========================================================
     AUTH GUARD
  ========================================================= */
  const token    = localStorage.getItem('orbit_token');
  const userJson = localStorage.getItem('orbit_user');

  if (!token || !userJson) {
    window.location.href = '/pages/auth.html?tab=login';
    return;
  }

  const currentUser = JSON.parse(userJson);

  // Conta empresa não usa o dashboard de dev — vai para o dashboard da empresa
  if (currentUser.type === 'company') {
    window.location.replace('/pages/empresa-dashboard.html');
    return;
  }

  /* =========================================================
     HELPERS
  ========================================================= */
  function $(s, root) { return (root || document).querySelector(s); }

  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str || '').replace(/[&<>"']/g, ch => map[ch]);
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  function profileStrength(user) {
    const fields = [user.name, user.bio, user.title, user.github, user.stack, user.avatarUrl];
    const filled  = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
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

  function toast(msg, type) { if (window.orbitToast) window.orbitToast(msg, type || 'info'); }

  /* =========================================================
     WELCOME HEADER
  ========================================================= */
  function renderWelcome(user) {
    const firstName = (user.name || '').split(' ')[0] || 'Dev';
    $('#welcome-name').textContent     = escapeHtml(firstName);
    $('#chip-name').textContent        = escapeHtml(user.name || '—');
    $('#chip-role').textContent        = escapeHtml(user.title || (user.type === 'dev' ? 'Desenvolvedor' : 'Empresa'));
    $('#chip-initials').textContent    = initials(user.name);

    if (user.avatarUrl) {
      const chipAvatar = $('#chip-avatar');
      chipAvatar.innerHTML = `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" />`;
    }
  }

  /* =========================================================
     STAT CARDS
  ========================================================= */
  function renderStats(user, projects) {
    const pct = profileStrength(user);

    $('#stat-candidaturas').textContent = String(applied.size);
    $('#stat-views').textContent        = projects.reduce((acc, p) => acc + (p.views || 0), 0) || String(projects.length * 40 || 0);
    $('#stat-perfil-pct').textContent   = pct + '%';

    const bar = $('#stat-perfil-bar');
    if (bar) {
      setTimeout(() => { bar.style.width = pct + '%'; }, 100);
    }

    if (pct >= 100) {
      $('#stat-badge-perfil').textContent = 'Completo!';
    } else if (pct >= 70) {
      $('#stat-badge-perfil').textContent = 'Quase lá!';
    } else {
      $('#stat-badge-perfil').textContent = 'Em progresso';
    }
  }

  /* =========================================================
     PROJETOS
  ========================================================= */
  const THUMB_COLORS = [
    ['#e2e7ff', '#4648d4'],
    ['#dae2fd', '#3537b8'],
    ['#f0f4ff', '#6366f1'],
    ['#e8ecff', '#4648d4'],
  ];

  function buildProjectCard(project, idx) {
    const [bg, fg] = THUMB_COLORS[idx % THUMB_COLORS.length];
    const tags     = Array.isArray(project.stack)
      ? project.stack
      : (project.stack || '').split(',').map(s => s.trim()).filter(Boolean);

    const tagsHtml = tags.slice(0, 4).map(t => `<span class="dash-tag">${escapeHtml(t)}</span>`).join('');

    const thumbHtml = project.thumbnailUrl
      ? `<img src="${escapeHtml(project.thumbnailUrl)}" alt="${escapeHtml(project.name)}" />`
      : `<span class="dash-project-card__thumb-placeholder">${escapeHtml(project.name || 'Projeto')}</span>`;

    return `
      <article class="dash-project-card">
        <div class="dash-project-card__thumb" style="background:${bg};color:${fg};">
          ${thumbHtml}
        </div>
        <div class="dash-project-card__body">
          <h3 class="dash-project-card__name">${escapeHtml(project.name || 'Projeto')}</h3>
          <p class="dash-project-card__desc">${escapeHtml(project.description || '')}</p>
          ${tagsHtml ? `<div class="dash-project-card__tags">${tagsHtml}</div>` : ''}
        </div>
      </article>`;
  }

  function renderProjects(projects) {
    const grid = $('#projects-grid');
    if (!grid) return;

    if (!projects.length) {
      grid.innerHTML = `
        <div class="dash-projects-empty">
          <svg class="dash-projects-empty__icon" width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
          <p class="dash-projects-empty__text">Nenhum projeto cadastrado ainda.</p>
          <a href="/pages/meus-projetos.html?new=1" class="dash-projects-empty__cta">Adicionar meu primeiro projeto</a>
        </div>`;
      return;
    }

    grid.innerHTML = projects.slice(0, 4).map((p, i) => buildProjectCard(p, i)).join('');
  }

  /* =========================================================
     OPORTUNIDADES RECOMENDADAS (algoritmo em grafo do backend)
  ========================================================= */
  let recs    = [];
  let applied = new Set();

  function buildJobCard(rec) {
    const job = rec.job || {};
    const initials = (job.companyName || '?').slice(0, 2).toUpperCase();
    const isApplied = applied.has(job.id);
    const loc = job.modality === 'Remoto' ? 'Remoto' : (job.location || job.modality || '');
    return `
      <div class="dash-job-card" data-job-id="${escapeHtml(job.id)}">
        <div class="dash-job-card__left">
          <div class="dash-job-card__logo">${escapeHtml(initials)}</div>
          <div class="dash-job-card__info">
            <span class="dash-job-card__title">${escapeHtml(job.title || 'Vaga')}</span>
            <div class="dash-job-card__meta">
              <span class="dash-job-card__location">
                <svg width="10" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                ${escapeHtml(loc)}
              </span>
              <span class="dash-job-card__salary">${escapeHtml(job.salaryRange || 'A combinar')}</span>
              <span class="dash-job-card__match" title="${escapeHtml(rec.reason || '')}">${rec.matchScore || 0}% match</span>
            </div>
          </div>
        </div>
        <div class="dash-job-card__actions">
          <button type="button" class="dash-btn-ghost" data-action="details">Detalhes</button>
          <button type="button" class="dash-btn-primary" data-action="apply" ${isApplied ? 'disabled' : ''}>${isApplied ? 'Candidatura enviada' : 'Candidatar-se'}</button>
        </div>
      </div>`;
  }

  function renderJobs() {
    const list = $('#jobs-list');
    if (!list) return;
    const top = recs.slice(0, 4);
    if (!top.length) {
      list.innerHTML = `<div class="dash-jobs-empty">Nenhuma vaga compatível no momento. Ajuste os <strong>Filtros Avançados</strong> ou complete suas habilidades no perfil.</div>`;
      return;
    }
    list.innerHTML = top.map(buildJobCard).join('');
  }

  async function loadRecommendations() {
    try {
      const res = await api('/api/recommendations/me');
      if (!res.ok) { recs = []; renderJobs(); return; }
      recs = await res.json();
      renderJobs();
    } catch (err) {
      if (err.message !== 'Token expirado') { recs = []; renderJobs(); }
    }
  }

  async function loadAppliedSet() {
    try {
      const res = await api('/api/applications/me');
      if (!res.ok) return;
      const list = await res.json();
      applied = new Set((list || []).map(a => a.jobId));
    } catch (e) { /* silencioso */ }
  }

  async function applyToJob(jobId, btn) {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Enviando...';
    try {
      const res = await api('/api/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
      const data = await res.json().catch(() => ({}));
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

  function setupJobsEvents() {
    const list = $('#jobs-list');
    if (list) {
      list.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-action]');
        if (!btn) return;
        const card = btn.closest('[data-job-id]');
        const jobId = card && card.getAttribute('data-job-id');
        if (!jobId) return;
        if (btn.getAttribute('data-action') === 'details') {
          window.location.href = '/pages/vaga-detalhes.html?id=' + encodeURIComponent(jobId);
        } else if (btn.getAttribute('data-action') === 'apply' && !btn.disabled) {
          applyToJob(jobId, btn);
        }
      });
    }
    // Filtros Avançados → modal compartilhado; ao salvar, recarrega as recomendações
    const adv = $('#btn-adv-filters');
    if (adv && window.OrbitJobPrefs) {
      adv.addEventListener('click', () => window.OrbitJobPrefs.open(loadRecommendations));
    }
  }

  /* =========================================================
     MINHA AGENDA (lembretes + entrevistas) — Bug 3
  ========================================================= */
  const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  function timeLabel(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  function agendaItemHtml(it) {
    const d   = new Date(it.date);
    const mon = MONTHS[d.getMonth()] || '';
    const day = String(d.getDate()).padStart(2, '0');
    return `
      <li class="dash-event">
        <div class="dash-event__date dash-event__date--${it.kind}">
          <span class="dash-event__month">${mon}</span>
          <span class="dash-event__day">${day}</span>
        </div>
        <div class="dash-event__info">
          <span class="dash-event__name">${escapeHtml(it.name)}</span>
          <span class="dash-event__meta">${escapeHtml(it.meta)}</span>
        </div>
      </li>`;
  }

  async function loadAgenda() {
    const list = $('#agenda-list');
    if (!list) return;
    try {
      const res = await api('/api/agenda/me');
      if (!res.ok) { list.innerHTML = ''; return; }
      const data = await res.json();
      const now  = Date.now();
      const items = [];
      (data.reminders || []).forEach(r => {
        items.push({ kind: 'reminder', date: r.remindAt, name: r.title, meta: 'Lembrete • ' + timeLabel(r.remindAt), ts: new Date(r.remindAt).getTime() });
      });
      (data.interviews || []).forEach(i => {
        if (!['agendada', 'remarcacao_solicitada'].includes(i.status)) return;
        const who = (i.company && i.company.name) || (i.job && i.job.title) || 'Entrevista';
        items.push({ kind: 'interview', date: i.scheduledAt, name: 'Entrevista: ' + who, meta: (i.modeLabel || 'Entrevista') + ' • ' + timeLabel(i.scheduledAt), ts: new Date(i.scheduledAt).getTime() });
      });
      // próximos primeiro (futuros ou da última hora); se não houver, mostra os mais recentes
      const upcoming = items.filter(x => x.ts >= now - 36e5).sort((a, b) => a.ts - b.ts);
      const shown = (upcoming.length ? upcoming : items.sort((a, b) => b.ts - a.ts)).slice(0, 4);
      if (!shown.length) {
        list.innerHTML = `<li class="dash-agenda-empty">Nada agendado por aqui. <a href="/pages/agenda.html">Criar um lembrete</a> ou acompanhar suas entrevistas.</li>`;
        return;
      }
      list.innerHTML = shown.map(agendaItemHtml).join('');
    } catch (err) {
      if (err.message !== 'Token expirado') list.innerHTML = '';
    }
  }

  /* =========================================================
     FAB — contraste sobre cards de cor próxima (Bug 4)
  ========================================================= */
  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
  function setupFabContrast() {
    const fab = $('#btn-fab');
    if (!fab) return;
    // Superfícies de cor próxima à do FAB (roxo sólido) — pedem o FAB claro p/ contraste
    const darkSurfaces = Array.prototype.slice.call(document.querySelectorAll('.dash-challenge-card, [data-fab-dark]'));
    if (!darkSurfaces.length) return;
    let raf = null;
    function check() {
      raf = null;
      const f = fab.getBoundingClientRect();
      const over = darkSurfaces.some(el => rectsOverlap(f, el.getBoundingClientRect()));
      fab.classList.toggle('dash-fab--on-dark', over);
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(check); }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    check();
  }

  /* =========================================================
     LOGOUT
  ========================================================= */
  function setupLogout() {
    const btn = $('#btn-logout');
    if (!btn) return;
    btn.addEventListener('click', () => {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
    });
  }

  /* =========================================================
     FAB — redireciona para feed para criar post
  ========================================================= */
  function setupFab() {
    const fab = $('#btn-fab');
    if (!fab) return;
    fab.addEventListener('click', () => {
      window.location.href = '/pages/feed.html';
    });
  }

  /* =========================================================
     INIT
  ========================================================= */
  async function init() {
    setupLogout();
    setupFab();
    setupFabContrast();
    setupJobsEvents();
    loadAgenda();

    // candidaturas (para o stat e o estado dos botões) antes de renderizar as recomendações
    await loadAppliedSet();
    loadRecommendations();

    try {
      const res = await api(`/api/users/${currentUser.id}/profile`);

      if (!res.ok) {
        renderWelcome(currentUser);
        renderStats(currentUser, []);
        renderProjects([]);
        return;
      }

      const data     = await res.json();
      const user     = data.user     || currentUser;
      const projects = data.projects || [];

      renderWelcome(user);
      renderStats(user, projects);
      renderProjects(projects);

    } catch (err) {
      if (err.message !== 'Token expirado') {
        renderWelcome(currentUser);
        renderStats(currentUser, []);
        renderProjects([]);
      }
    }
  }

  init();

})();
