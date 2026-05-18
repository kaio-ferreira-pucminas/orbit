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

  async function api(path) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      window.location.href = '/pages/auth.html?tab=login';
      throw new Error('Token expirado');
    }

    return res;
  }

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

    $('#stat-candidaturas').textContent = '0';
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
          <a href="/pages/profile.html" class="dash-projects-empty__cta">Adicionar meu primeiro projeto</a>
        </div>`;
      return;
    }

    grid.innerHTML = projects.slice(0, 4).map((p, i) => buildProjectCard(p, i)).join('');
  }

  /* =========================================================
     OPORTUNIDADES (mock — não há endpoint de vagas ainda)
  ========================================================= */
  const MOCK_JOBS = [
    {
      company:  'Stellar Tech',
      initials: 'ST',
      title:    'Desenvolvedor Frontend Jr.',
      location: 'Remoto',
      salary:   'R$ 5k – 7.5k',
    },
    {
      company:  'Lumina Design',
      initials: 'LD',
      title:    'UI/UX Developer',
      location: 'São Paulo, SP',
      salary:   'R$ 8k – 10k',
    },
  ];

  function buildJobCard(job) {
    return `
      <div class="dash-job-card">
        <div class="dash-job-card__left">
          <div class="dash-job-card__logo">${escapeHtml(job.initials)}</div>
          <div class="dash-job-card__info">
            <span class="dash-job-card__title">${escapeHtml(job.title)}</span>
            <div class="dash-job-card__meta">
              <span class="dash-job-card__location">
                <svg width="10" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                ${escapeHtml(job.location)}
              </span>
              <span class="dash-job-card__salary">${escapeHtml(job.salary)}</span>
            </div>
          </div>
        </div>
        <div class="dash-job-card__actions">
          <button type="button" class="dash-btn-ghost">Detalhes</button>
          <button type="button" class="dash-btn-primary">Candidatar-se</button>
        </div>
      </div>`;
  }

  function renderJobs() {
    const list = $('#jobs-list');
    if (!list) return;
    list.innerHTML = MOCK_JOBS.map(buildJobCard).join('');
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
    renderJobs();

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
